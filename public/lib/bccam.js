// In-hub camera: a live viewfinder that stays open so you can take shot after shot,
// like the camera app. Each shot goes straight into the background upload queue
// (lib/phq.js) via onShot, so nothing waits and nothing is lost if you switch apps.
//
//   BCCam.open({ title, kind:'before'|'after', kinds:true, onShot(file, kind), onClose(count) })
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
    '.bccam .msg button{margin-top:14px}';

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
    el.innerHTML = '<video playsinline muted autoplay></video><div class="flash"></div>' +
      '<div class="top"><h4></h4>' + (o.kinds !== false ? '<div class="seg"><button type="button" data-k="before">Before</button><button type="button" data-k="after">After</button></div>' : '') + '<button type="button" class="done">Done</button></div>' +
      '<div class="msg" hidden></div>' +
      '<div class="bot"><button type="button" class="last" aria-label="Photos taken"></button><button type="button" class="shut" aria-label="Take photo"><i></i></button><div class="side"><button type="button" class="lens" hidden aria-label="Switch lens">0.5×</button></div></div>';
    document.body.appendChild(el);
    var video = el.querySelector('video'), msg = el.querySelector('.msg'), flash = el.querySelector('.flash'), last = el.querySelector('.last'), lens = el.querySelector('.lens');
    el.querySelector('h4').textContent = o.title || 'Photos';
    var prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    function paintKind() { Array.prototype.forEach.call(el.querySelectorAll('[data-k]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.k === kind)); }); }
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
      var k = kind, at = Date.now();
      c.toBlob(function (b) {
        c.width = c.height = 0; if (!b) return;
        var f; try { f = new File([b], 'photo-' + at + '.jpg', { type: 'image/jpeg', lastModified: at }); } catch (e) { f = b; f.lastModified = at; f.name = 'photo.jpg'; }
        count++; if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = URL.createObjectURL(b);
        last.innerHTML = '<img alt="" src="' + lastUrl + '"><b>' + count + '</b>';
        if (o.onShot) o.onShot(f, k);
      }, 'image/jpeg', 0.9);
    }
    function close() {
      if (closed) return; closed = true; stop(); el.remove(); document.body.style.overflow = prevOverflow;
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
      if (b === lens) { lensWide = !lensWide; lens.textContent = lensWide ? '1×' : '0.5×'; start(); }
    });
    start();
    return { close: close };
  }

  window.BCCam = { open: open, supported: supported };
})();
