// Background photo uploads for the hub (/) and the team app (/me).
//
// Picked photos are saved on the phone (IndexedDB) the moment they're chosen, then shrunk
// and sent from that saved copy. So the screen never has to wait, you can keep using the
// hub, and if you switch to the camera or another app (iOS pauses the page) nothing is lost:
// the queue picks up where it left off as soon as the hub is open again, even after a reload.
//
//   BCPhotoQ.add(files, {jobId, pid, room, kind}) -> Promise<number saved>
//   BCPhotoQ.on(fn)       fn({type:'change'|'added'|'error'|'done', ...})
//   BCPhotoQ.pending(jobId, room?, kind?) -> [{qid, url}]  (url = local thumbnail once ready)
//   BCPhotoQ.count(jobId?) -> photos still to go
//   BCPhotoQ.kick()       try again now
(function () {
  var DB = 'bc-photoq', ST = 'items', WORKERS = 3, BATCH = 5;
  var mem = {};          // qid -> record without the big blobs {qid, ctx, taken, url, binId, ready}
  var subs = [], running = false, timer = null, wait = 4000, done = { added: 0, failed: 0, msg: '' };
  var dbp = null, noDb = false, memBlobs = {}; // memBlobs used only if IndexedDB is unavailable

  function emit(e) { subs.forEach(function (f) { try { f(e); } catch (x) { if (window.console) console.error(x); } }); }
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no idb'));
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST, { keyPath: 'qid' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    }).catch(function (e) { noDb = true; throw e; });
    return dbp;
  }
  function tx(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(ST, mode), s = t.objectStore(ST), out; out = fn(s);
        t.oncomplete = function () { res(out && 'result' in out ? out.result : out); };
        t.onerror = t.onabort = function () { rej(t.error || new Error('Storage failed')); };
      });
    });
  }
  function put(rec) { if (noDb) { memBlobs[rec.qid] = rec; return Promise.resolve(); } return tx('readwrite', function (s) { s.put(rec); }).catch(function () { memBlobs[rec.qid] = rec; }); }
  function get(qid) { if (memBlobs[qid]) return Promise.resolve(memBlobs[qid]); if (noDb) return Promise.resolve(null); return tx('readonly', function (s) { return s.get(qid); }).catch(function () { return null; }); }
  function del(qid) { delete memBlobs[qid]; if (noDb) return Promise.resolve(); return tx('readwrite', function (s) { s.delete(qid); }).catch(function () {}); }
  function all() { if (noDb) return Promise.resolve(Object.keys(memBlobs).map(function (k) { return memBlobs[k]; })); return tx('readonly', function (s) { return s.getAll(); }).catch(function () { return []; }); }

  function forget(qid) { var m = mem[qid]; if (m && m.url) URL.revokeObjectURL(m.url); delete mem[qid]; return del(qid); }
  function list() { return Object.keys(mem).sort().map(function (k) { return mem[k]; }); }

  // ---------- shrinking (one at a time keeps iPhone memory low) ----------
  function toJpeg(c, q) { return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error("Couldn't read that photo")); }, 'image/jpeg', q); }); }
  function scaled(src, w, h, max) { var sc = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c; }
  function shrink(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { var c = scaled(img, img.naturalWidth, img.naturalHeight, 1600), t = scaled(c, c.width, c.height, 420); img.onerror = null; URL.revokeObjectURL(url);
        Promise.all([toJpeg(c, 0.82), toJpeg(t, 0.72)]).then(function (r) { c.width = c.height = t.width = t.height = 0; res({ full: r[0], thumb: r[1] }); }, rej); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Couldn't read that photo")); };
      img.src = url;
    });
  }
  var decoding = Promise.resolve();
  function shrinkQueued(f) { var p = decoding.then(function () { return shrink(f); }); decoding = p.catch(function () {}); return p; }

  // ---------- network ----------
  function hdrs(json) { var h = {}, k = ''; try { k = localStorage.getItem('roster_admin_key') || ''; } catch (e) {} if (k) h['x-admin-key'] = k; if (json) h['content-type'] = 'application/json'; return h; }
  function url(ctx, stage) { return '/api/photo?job=' + encodeURIComponent(ctx.jobId) + '&person=' + encodeURIComponent(ctx.pid || '') + '&stage=' + stage; }
  // fatal = retrying won't help (job gone, not allowed, bad file)
  // A request iOS froze while the hub was in the background gets cut off after a while and retried.
  function call(u, opt) {
    var ac = window.AbortController ? new AbortController() : null, to = ac && setTimeout(function () { ac.abort(); }, 60000);
    if (ac) opt.signal = ac.signal;
    return fetch(u, opt).finally(function () { clearTimeout(to); }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.ok) return d;
        var e = new Error(d.error || ('Upload failed (' + r.status + ')'));
        e.fatal = r.status === 400 || r.status === 403 || r.status === 404 || r.status === 413; e.status = r.status;
        throw e;
      });
    });
  }

  // Make sure one photo is shrunk and stored on the server; resolves when it has a bin id.
  function prep(m) {
    if (m.binId) return Promise.resolve();
    return get(m.qid).then(function (rec) {
      if (!rec) throw Object.assign(new Error('Photo was lost on the phone'), { fatal: true });
      var step = rec.full ? Promise.resolve(rec) : shrinkQueued(rec.file).then(function (r) {
        rec.full = r.full; rec.thumb = r.thumb; delete rec.file; // swap the big original for the small copies
        if (!m.url) m.url = URL.createObjectURL(r.thumb); m.ready = true; emit({ type: 'change' });
        return put(rec).then(function () { return rec; });
      }, function (e) { e.fatal = true; throw e; });
      return step.then(function (rec) {
        return call(url(m.ctx, 'bin') + '&tl=' + rec.thumb.size, { method: 'POST', headers: hdrs(), body: new Blob([rec.thumb, rec.full], { type: 'application/octet-stream' }) })
          .then(function (d) { if (!d.id) throw new Error('Upload failed'); m.binId = rec.binId = d.id; return put(rec); });
      });
    });
  }

  // Put uploaded photos on their job, grouped by job/person/area/kind. Safe to repeat.
  var flushing = Promise.resolve();
  function flush(force) {
    flushing = flushing.then(function () {
      var groups = {};
      list().forEach(function (m) { if (!m.binId) return; var k = JSON.stringify([m.ctx.jobId, m.ctx.pid || '', m.ctx.room || '', m.ctx.kind || '']); (groups[k] = groups[k] || []).push(m); });
      return Object.keys(groups).reduce(function (p, k) {
        var ms = groups[k]; if (!force && ms.length < BATCH) return p;
        return p.then(function () {
          var ctx = ms[0].ctx, b = { ids: ms.map(function (m) { return m.binId; }), taken: {} };
          ms.forEach(function (m) { if (m.taken) b.taken[m.binId] = m.taken; });
          if (ctx.room) { b.room = ctx.room; b.kind = ctx.kind; }
          return call(url(ctx, 'add'), { method: 'POST', headers: hdrs(true), body: JSON.stringify(b) }).then(function (d) {
            done.added += d.added || 0; done.failed += d.missing || 0;
            return Promise.all(ms.map(function (m) { return forget(m.qid); })).then(function () { emit({ type: 'added', jobId: ctx.jobId, ctx: ctx, data: d, n: d.added || 0 }); emit({ type: 'change' }); });
          }, function (e) {
            if (e.fatal) { done.failed += ms.length; done.msg = e.message; return Promise.all(ms.map(function (m) { return forget(m.qid); })).then(function () { emit({ type: 'change' }); }); }
            throw e;
          });
        });
      }, Promise.resolve());
    });
    var p = flushing; flushing = flushing.catch(function () {}); return p;
  }

  // Only one open copy of the hub works the queue at a time, so nothing goes up twice.
  function run() {
    if (running || !list().length) return;
    if (document.visibilityState === 'hidden') return; // iOS would cut it off anyway; resume on return
    running = true; clearTimeout(timer); timer = null;
    if (navigator.locks && navigator.locks.request) {
      navigator.locks.request('bc-photoq', { ifAvailable: true }, function (lock) {
        if (!lock) { running = false; timer = setTimeout(run, 5000); return; }
        return new Promise(work);
      }).catch(function () { running = false; });
    } else new Promise(work);
  }
  function work(finish) {
    var queue = list().slice(), hadErr = false;
    function worker() {
      var m = queue.shift(); if (!m) return Promise.resolve();
      if (!mem[m.qid]) return worker();
      return prep(m).then(function () { return flush(false).catch(function (e) { hadErr = true; done.msg = e.message; }); }, function (e) {
        if (e.fatal) { done.failed++; done.msg = e.message; return forget(m.qid).then(function () { emit({ type: 'change' }); }); }
        hadErr = true; done.msg = e.message;
      }).then(worker);
    }
    var ws = []; for (var i = 0; i < WORKERS; i++) ws.push(worker());
    Promise.all(ws).then(function () { return flush(true); }).catch(function (e) { hadErr = true; done.msg = e.message; }).then(function () {
      running = false; finish(); emit({ type: 'change' });
      if (list().length) { // something didn't go (no signal, page paused): try again shortly
        if (hadErr) wait = Math.min(wait * 2, 60000);
        timer = setTimeout(run, hadErr ? wait : 500);
        if (hadErr) emit({ type: 'error', msg: done.msg, left: list().length });
      } else {
        wait = 4000; var r = done; done = { added: 0, failed: 0, msg: '' };
        if (r.added || r.failed) emit({ type: 'done', added: r.added, failed: r.failed, msg: r.msg });
      }
    });
  }
  function kick() { wait = 4000; if (!running) restore().then(run); }

  function add(files, ctx) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length || !ctx || !ctx.jobId) return Promise.resolve(0);
    var base = String(Date.now()).padStart(15, '0'), saved = 0;
    var c = { jobId: ctx.jobId, pid: ctx.pid || '', room: ctx.room || '', kind: ctx.room ? (ctx.kind || 'after') : '' };
    // Save each photo to the phone straight away, in order, so nothing depends on the page staying open.
    return files.reduce(function (p, f, i) {
      return p.then(function () {
        var qid = base + '-' + String(i).padStart(5, '0') + Math.random().toString(36).slice(2, 6);
        var m = { qid: qid, ctx: c, taken: f.lastModified || 0 };
        return put({ qid: qid, ctx: c, taken: m.taken, file: f }).then(function () { if (!mem[qid]) mem[qid] = m; saved++; if (i === 0 || i % 5 === 4) { emit({ type: 'change' }); kick(); } });
      });
    }, Promise.resolve()).then(function () { emit({ type: 'change' }); kick(); return saved; });
  }

  function pending(jobId, room, kind) {
    return list().filter(function (m) { return m.ctx.jobId === jobId && (room === undefined || m.ctx.room === room) && (kind === undefined || m.ctx.kind === kind); });
  }
  function count(jobId) { return list().filter(function (m) { return !jobId || m.ctx.jobId === jobId; }).length; }

  // Pick up anything left from last time (page closed or reloaded mid-upload).
  function restore() {
    return all().then(function (recs) {
      recs.forEach(function (r) {
        if (mem[r.qid]) return;
        mem[r.qid] = { qid: r.qid, ctx: r.ctx, taken: r.taken, binId: r.binId || '', ready: !!r.thumb, url: r.thumb ? URL.createObjectURL(r.thumb) : '' };
      });
      if (recs.length) emit({ type: 'change' });
    }).catch(function () {});
  }

  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') kick(); });
  window.addEventListener('pageshow', kick);
  window.addEventListener('online', kick);
  window.addEventListener('focus', kick);

  window.BCPhotoQ = {
    add: add, pending: pending, count: count, kick: kick,
    on: function (f) { subs.push(f); }, ready: restore().then(run)
  };
})();
