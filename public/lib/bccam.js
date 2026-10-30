// In-hub camera: a live viewfinder that stays open so you can take shot after shot,
// like the camera app. Each shot goes straight into the background upload queue
// (lib/phq.js) via onShot, so nothing waits and nothing is lost if you switch apps.
//
//   BCCam.open({ title, kind:'before'|'after', kinds:true, ghosts:[{id,url,done}], onShot(file, kind, pairId), onClose(count) })
//   shots: [{l, how}] the before shot list for this area (lib/shots.js); taken: {index:1} already done.
//     On "before", the camera steps through it; each shot is tagged { i, l } (4th onShot argument).
//   ghosts: this area's before photos. On "after", the current one shows faded over the camera so the
//   after can be lined up from the same spot. Each shot is linked to that before (pairId) and the
//   camera moves on to the next before. "done" ones (already lined up) are skipped to start with.
//   BCCam.supported() -> false if this browser can't show a live camera (use the file picker)
(function () {
  var css = '' +
    '.bccam{position:fixed;inset:0;z-index:200;background:#000;color:#fff;display:flex;flex-direction:column;font:500 15px/1.2 Inter,system-ui,sans-serif;-webkit-user-select:none;user-select:none;touch-action:manipulation}' +
    '.bccam video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000}' +
    '.bccam .top,.bccam .bot{position:relative;z-index:2;display:flex;align-items:center;gap:10px;padding:12px 16px}' +
    '.bccam .top{padding-top:calc(12px + env(safe-area-inset-top,0px));background:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,0))}' +
    '.bccam .bot{margin-top:auto;justify-content:space-between;padding-bottom:calc(18px + env(safe-area-inset-bottom,0px));background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.6))}' +
    '.bccam h4{margin:0;flex:1;font:600 17px/1.2 inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.bccam button{font:inherit;color:#fff;border:0;background:rgba(255,255,255,.18);border-radius:999px;padding:10px 16px;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.bccam .done{background:#fff;color:#1a1a1a;font-weight:600}' +
    '.bccam .seg{display:flex;background:rgba(0,0,0,.45);border-radius:999px;padding:3px}' +
    '.bccam .seg button{background:none;padding:8px 14px}.bccam .seg button[aria-pressed=true]{background:#fff;color:#1a1a1a}' +
    '.bccam .shut{width:78px;height:78px;border-radius:50%;padding:0;background:transparent;border:4px solid #fff;display:grid;place-items:center}' +
    '.bccam .shut i{display:block;width:62px;height:62px;border-radius:50%;background:#fff;transition:transform .08s}' +
    '.bccam .shut:active i{transform:scale(.88)}' +
    '.bccam .last{width:56px;height:56px;border-radius:10px;overflow:hidden;background:rgba(255,255,255,.15);position:relative;padding:0}' +
    '.bccam .last img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.bccam .last b{position:absolute;right:-2px;top:-2px;min-width:22px;height:22px;border-radius:11px;background:#c06b3e;color:#fff;font:700 12px/22px inherit;text-align:center;padding:0 5px}' +
    '.bccam .side{width:56px;display:flex;justify-content:center}' +
    '.bccam .lens{padding:8px 0;width:48px;font-weight:600}' +
    '.bccam .flash{position:absolute;inset:0;z-index:3;background:#fff;opacity:0;pointer-events:none;transition:opacity .25s}' +
    '.bccam .flash.on{opacity:.7;transition:none}' +
    '.bccam .msg{position:absolute;z-index:2;left:24px;right:24px;top:40%;text-align:center;font-size:16px;line-height:1.4}' +
    '.bccam .msg button{margin-top:14px}' +
    '.bccam .ghost{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:1;opacity:.42;transition:opacity .15s}' +
    '.bccam .sbar{margin:auto 12px 6px;position:relative;z-index:2;display:flex;align-items:center;gap:8px;padding:8px;background:rgba(0,0,0,.6);border-radius:14px}' +
    '.bccam .sbar .st{flex:1;min-width:0}.bccam .sbar .st b{display:block;font:600 15px/1.25 inherit}.bccam .sbar .st small{display:block;font:400 12.5px/1.35 inherit;opacity:.85;margin-top:3px}.bccam .sbar .st i{font-style:normal;font:600 11px/1 inherit;letter-spacing:.06em;text-transform:uppercase;color:#f4b942}' +
    '.bccam .sbar button{padding:10px 13px;flex:none}' +
    '.bccam .rot{position:absolute;z-index:3;left:50%;top:42%;transform:translate(-50%,-50%);background:rgba(0,0,0,.75);border-radius:16px;padding:16px 20px;text-align:center;font:600 16px/1.35 inherit;max-width:80%;pointer-events:none}.bccam .rot span{display:block;font-size:34px;margin-bottom:6px}' +
    '.bccam .sbar:not([hidden])+.gbar{margin-top:0}' +
    '.bccam [hidden]{display:none!important}.bccam .gbar:not([hidden])~.bot,.bccam .sbar:not([hidden])~.bot{margin-top:0}' +
    '.bccam .gbar{position:relative;z-index:2;display:flex;align-items:center;gap:8px;margin:auto 12px 6px;padding:6px;background:rgba(0,0,0,.55);border-radius:14px}' +
    '.bccam .gbar .gt{flex:1;min-width:0;font:600 13px/1.25 inherit;text-align:center}.bccam .gbar .gt small{display:block;font-weight:400;opacity:.8;font-size:11.5px}' +
    '.bccam .gbar button{padding:9px 12px;font-size:14px}.bccam .gbar .gth{width:44px;height:44px;border-radius:8px;overflow:hidden;padding:0;position:relative;flex:none}' +
    '.bccam .gbar{flex-wrap:wrap}.bccam .gfade{order:9;flex:1 0 100%;display:flex;align-items:center;gap:10px;padding:2px 8px 4px;font:600 13px/1 inherit}.bccam .gfade input{flex:1;height:36px;margin:0;accent-color:#fff;touch-action:auto}' +
    '.bccam .gbar .gth img{width:100%;height:100%;object-fit:cover;display:block}.bccam .gbar .gth b{position:absolute;inset:0;display:grid;place-items:center;background:rgba(47,90,53,.6);font-size:18px}';

  function supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

  // Which way up the phone is, so sideways shots save sideways even with rotation lock on.
  // iOS reports gravity with the opposite sign to the spec, so flip it there.
  var grav = { x: 0, y: 0 }, motionOn = false, flipSign = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function onMotion(e) { var g = e.accelerationIncludingGravity; if (!g || g.x == null) return; var s = flipSign ? -1 : 1; grav.x = grav.x * 0.6 + g.x * s * 0.4; grav.y = grav.y * 0.6 + g.y * s * 0.4; }
  function startMotion() {
    if (motionOn) return; motionOn = true;
    var go = function () { window.addEventListener('devicemotion', onMotion); };
    if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then(function (r) { if (r === 'granted') go(); }).catch(function () {});
    } else go();
  }
  // Degrees to turn the camera frame clockwise so it's the right way up
  function turn() {
    if (window.innerWidth > window.innerHeight) return 0; // screen already turned with the phone
    var ax = Math.abs(grav.x), ay = Math.abs(grav.y);
    if (Math.max(ax, ay) < 4) return 0;                    // lying flat-ish: keep as is
    if (ax > ay) return grav.x > 0 ? -90 : 90;             // right edge up: turn left; left edge up: turn right
    return grav.y < 0 ? 180 : 0;
  }

  function open(o) {
    o = o || {};
    if (!document.getElementById('bccam-css')) { var st = document.createElement('style'); st.id = 'bccam-css'; st.textContent = css; document.head.appendChild(st); }
    startMotion(); // must be called straight from the tap so iOS can ask
    var kind = o.kind || 'after', count = 0, stream = null, lensWide = false, wideId = '', mainId = '', closed = false, lastUrl = '';
    var el = document.createElement('div'); el.className = 'bccam'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Camera');
    var ghosts = (o.ghosts || []).filter(function (g) { return g && g.url; }), gi = 0, gOn = true, gOpv = 0.65, linked = {};
    try { var sv = parseFloat(localStorage.getItem('bccam_fade')); if (sv >= 0.15 && sv <= 0.95) gOpv = sv; } catch (e) {}
    ghosts.forEach(function (g) { if (g.done) linked[g.id] = 1; });
    for (gi = 0; gi < ghosts.length && linked[ghosts[gi].id]; gi++) {} if (gi >= ghosts.length) gi = 0;
    el.innerHTML = '<video playsinline muted autoplay></video><img class="ghost" alt="" hidden><div class="flash"></div>' +
      '<div class="top"><h4></h4>' + (o.kinds !== false ? '<div class="seg"><button type="button" data-k="before">Before</button><button type="button" data-k="after">After</button></div>' : '') + '<button type="button" class="done">Done</button></div>' +
      '<div class="msg" hidden></div>' +
      '<div class="rot" hidden><span>↻</span>Turn your phone sideways</div>' +
      '<div class="sbar" hidden><button type="button" data-s="prev" aria-label="Previous shot">‹</button><div class="st"></div><button type="button" data-s="next" aria-label="Skip to the next shot">Skip</button></div>' +
      '<div class="gbar" hidden><button type="button" data-g="prev" aria-label="Previous before photo">‹</button><button type="button" class="gth" data-g="vis" aria-label="Show or hide the before photo"></button><div class="gt"></div><label class="gfade"><span>Show before</span><input type="range" min="15" max="95" step="5" aria-label="How strongly the before photo shows"></label><button type="button" data-g="next" aria-label="Next before photo">›</button></div>' +
      '<div class="bot"><button type="button" class="last" aria-label="Photos taken"></button><button type="button" class="shut" aria-label="Take photo"><i></i></button><div class="side"><button type="button" class="lens" hidden aria-label="Switch lens">0.5×</button></div></div>';
    document.body.appendChild(el);
    var ghost = el.querySelector('.ghost'), gbar = el.querySelector('.gbar'), sbar = el.querySelector('.sbar'), rot = el.querySelector('.rot');
    var shots = o.shots || [], took = {}, si = 0;
    Object.keys(o.taken || {}).forEach(function (k) { took[k] = 1; });
    for (si = 0; si < shots.length && took[si]; si++) {}
    function paintShot() {
      var show = kind === 'before' && shots.length > 0; sbar.hidden = !show; if (!show) return;
      var n = Object.keys(took).length;
      if (si >= shots.length) { sbar.querySelector('.st').innerHTML = '<b>All ' + shots.length + ' shots done</b><small>Take extras of anything else worth showing, then tap Done.</small>'; return; }
      var x = shots[si];
      sbar.querySelector('.st').innerHTML = '<i>Shot ' + (si + 1) + ' of ' + shots.length + (took[si] ? ' · taken' : '') + (n ? ' · ' + n + ' done' : '') + '</i><b></b><small></small>';
      sbar.querySelector('.st b').textContent = x.l; sbar.querySelector('.st small').textContent = x.how || '';
    }
    function nextShot() { for (var k = si + 1; k < shots.length; k++) if (!took[k]) { si = k; return paintShot(); } for (k = 0; k < shots.length; k++) if (!took[k]) { si = k; return paintShot(); } si = shots.length; paintShot(); }
    // Sideways check: shots are taken landscape. Only shown when the phone's sensor says it's upright.
    function upright() { var ax = Math.abs(grav.x), ay = Math.abs(grav.y); return window.innerWidth < window.innerHeight && Math.max(ax, ay) >= 4 && ay > ax * 1.3; }
    function fitGhost() {
      // With rotation lock on and the phone sideways, photos are saved turned upright, so turn the ghost back to match the screen.
      var r = turn();
      if (r === 90 || r === -90) { ghost.style.width = el.clientHeight + 'px'; ghost.style.height = el.clientWidth + 'px'; ghost.style.left = '50%'; ghost.style.top = '50%'; ghost.style.inset = 'auto'; ghost.style.transform = 'translate(-50%,-50%) rotate(' + (-r) + 'deg)'; }
      else { ghost.style.cssText = 'opacity:' + ghost.style.opacity; }
    }
    var poll = setInterval(function () { rot.hidden = !((kind === 'before' && shots.length) || (kind === 'after' && ghosts.length)) || !upright(); if (!ghost.hidden) fitGhost(); }, 400);
    var video = el.querySelector('video'), msg = el.querySelector('.msg'), flash = el.querySelector('.flash'), last = el.querySelector('.last'), lens = el.querySelector('.lens');
    el.querySelector('h4').textContent = o.title || 'Photos';
    var prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    function paintKind() { Array.prototype.forEach.call(el.querySelectorAll('[data-k]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.k === kind)); }); }
    // Line-up: the before photo, faded over the live camera
    function paintGhost() {
      var show = kind === 'after' && ghosts.length > 0;
      gbar.hidden = !show; ghost.hidden = !(show && gOn);
      if (!show) return;
      var g = ghosts[gi]; if (ghost.getAttribute('src') !== g.url) ghost.src = g.url;
      ghost.style.opacity = gOpv; fitGhost();
      var rg = gbar.querySelector('input'); if (rg && +rg.value !== Math.round(gOpv * 100)) rg.value = Math.round(gOpv * 100);
      gbar.querySelector('.gth').innerHTML = '<img alt="" src="' + g.url + '">' + (linked[g.id] ? '<b>✓</b>' : '');
      var n = Object.keys(linked).length;
      gbar.querySelector('.gt').innerHTML = (gOn ? 'Line up ' : 'Before hidden · ') + (gi + 1) + ' of ' + ghosts.length + (g.l ? ': <span></span>' : '') + '<small>' + (gOn ? 'Match the faded shot, then take it' : 'Tap the photo to show it again') + (n ? ' · ' + n + ' lined up' : '') + '</small>';
      if (g.l) gbar.querySelector('.gt span').textContent = g.l;
    }
    function nextGhost() { for (var i = 1; i <= ghosts.length; i++) { var k = (gi + i) % ghosts.length; if (!linked[ghosts[k].id]) { gi = k; return paintGhost(); } } gi = (gi + 1) % ghosts.length; paintGhost(); }
    var _paintKind = paintKind; paintKind = function () { _paintKind(); paintGhost(); paintShot(); };
    paintKind();
    function say(t, retry) { msg.hidden = !t; msg.innerHTML = ''; if (!t) return; var p = document.createElement('div'); p.textContent = t; msg.appendChild(p); if (retry) { var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Try again'; b.onclick = start; msg.appendChild(b); } }

    function stop() { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; video.srcObject = null; }
    function start() {
      if (closed) return; stop(); say('');
      var id = lensWide ? wideId : mainId;
      var v = { width: { ideal: 4032 }, height: { ideal: 3024 } };
      if (id) v.deviceId = { exact: id }; else v.facingMode = { ideal: 'environment' };
      navigator.mediaDevices.getUserMedia({ video: v, audio: false }).then(function (s) {
        if (closed) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s; video.srcObject = s; var pp = video.play(); if (pp && pp.catch) pp.catch(function () {});
        if (!mainId) { var tr = s.getVideoTracks()[0], st = tr && tr.getSettings ? tr.getSettings() : {}; mainId = st.deviceId || ''; findWide(); }
      }).catch(function (e) {
        var n = e && e.name;
        say(n === 'NotAllowedError' ? 'The hub isn’t allowed to use the camera. Allow camera access for this site in Settings, then try again.' : 'Couldn’t start the camera.', true);
      });
    }
    // iPhones with an ultra wide lens get a 0.5× button (handy for whole-room shots)
    function findWide() {
      if (!navigator.mediaDevices.enumerateDevices) return;
      navigator.mediaDevices.enumerateDevices().then(function (ds) {
        var w = ds.filter(function (d) { return d.kind === 'videoinput' && /ultra ?wide/i.test(d.label) && !/front/i.test(d.label); })[0];
        if (w) { wideId = w.deviceId; lens.hidden = false; }
      }).catch(function () {});
    }

    function shoot() {
      if (!stream || !video.videoWidth) return;
      var w = video.videoWidth, h = video.videoHeight, r = turn(), max = 2048, sc = Math.min(1, max / Math.max(w, h));
      var dw = Math.round(w * sc), dh = Math.round(h * sc), c = document.createElement('canvas'), side = r === 90 || r === -90;
      c.width = side ? dh : dw; c.height = side ? dw : dh;
      var x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(r * Math.PI / 180); x.drawImage(video, -dw / 2, -dh / 2, dw, dh);
      flash.classList.add('on'); setTimeout(function () { flash.classList.remove('on'); }, 40);
      var k = kind, at = Date.now(), pair = k === 'after' && ghosts.length && gOn ? ghosts[gi].id : '';
      var shot = k === 'before' && shots.length && si < shots.length ? { i: si, l: shots[si].l } : null;
      if (shot) { took[si] = 1; setTimeout(nextShot, 350); }
      if (pair) { linked[pair] = 1; if (ghosts.length > 1) setTimeout(nextGhost, 350); else paintGhost(); }
      c.toBlob(function (b) {
        c.width = c.height = 0; if (!b) return;
        var f; try { f = new File([b], 'photo-' + at + '.jpg', { type: 'image/jpeg', lastModified: at }); } catch (e) { f = b; f.lastModified = at; f.name = 'photo.jpg'; }
        count++; if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = URL.createObjectURL(b);
        last.innerHTML = '<img alt="" src="' + lastUrl + '"><b>' + count + '</b>';
        if (o.onShot) o.onShot(f, k, pair, shot);
      }, 'image/jpeg', 0.9);
    }
    function close() {
      if (closed) return; closed = true; stop(); clearInterval(poll); el.remove(); document.body.style.overflow = prevOverflow;
      document.removeEventListener('visibilitychange', vis); if (lastUrl) URL.revokeObjectURL(lastUrl);
      if (o.onClose) o.onClose(count);
    }
    // iOS turns the camera off when you leave the app; turn it back on when you're back
    function vis() { if (document.visibilityState === 'visible') start(); else stop(); }
    document.addEventListener('visibilitychange', vis);

    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('shut')) return shoot();
      if (b.classList.contains('done') || b.classList.contains('last')) return close();
      if (b.dataset.k) { kind = b.dataset.k; paintKind(); return; }
      if (b.dataset.s === 'prev') { si = Math.max(0, Math.min(si, shots.length) - 1); return paintShot(); }
      if (b.dataset.s === 'next') { si = Math.min(shots.length, si + 1); return paintShot(); }
      if (b.dataset.g === 'prev') { gi = (gi - 1 + ghosts.length) % ghosts.length; gOn = true; return paintGhost(); }
      if (b.dataset.g === 'next') { gi = (gi + 1) % ghosts.length; gOn = true; return paintGhost(); }
      if (b.dataset.g === 'vis') { gOn = !gOn; return paintGhost(); }
      if (b === lens) { lensWide = !lensWide; lens.textContent = lensWide ? '1×' : '0.5×'; start(); }
    });
    // Slider: how strongly the before shows. Remembered on this phone.
    var rg = gbar.querySelector('input');
    function onFade() { gOpv = Math.max(0.15, Math.min(0.95, (+rg.value || 65) / 100)); gOn = true; ghost.hidden = kind !== 'after'; ghost.style.opacity = gOpv; try { localStorage.setItem('bccam_fade', String(gOpv)); } catch (e) {} }
    rg.addEventListener('input', onFade); rg.addEventListener('change', function () { onFade(); paintGhost(); });
    start();
    return { close: close };
  }

  // This area's before photos as line-up ghosts, oldest first; ones already lined up are marked done.
  function ghostsFor(photos, room, src) {
    var ps = (photos || []).filter(function (p) { return p.room === room; }), paired = {};
    ps.forEach(function (p) { if (p.kind === 'after' && p.pair) paired[p.pair] = 1; });
    var key = function (p) { return (p.sh != null ? 1000 + p.sh : 9999) + '|' + String(p.tk || p.at || ''); };
    return ps.filter(function (p) { return p.kind === 'before'; }).sort(function (a, b) { return key(a).localeCompare(key(b)); })
      .map(function (p) { return { id: p.id, url: src(p), done: !!paired[p.id], l: p.sl || '' }; });
  }
  // Which shots on this area's list already have a before photo: { index: 1 }
  function takenFor(photos, room) {
    var t = {}; (photos || []).forEach(function (p) { if (p.room === room && p.kind === 'before' && p.sh != null) t[p.sh] = 1; }); return t;
  }

  window.BCCam = { open: open, supported: supported, ghostsFor: ghostsFor, takenFor: takenFor };
})();
