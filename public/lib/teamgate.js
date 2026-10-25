// Team passcode gate for the roster (/) and the team app (/me).
// Loaded in <head> before the page's own script. It:
//  - adds the team session to every /api/ request
//  - covers the page with a login screen until the person logs in with their
//    mobile number + 4-digit passcode (or Jack logs in with his password)
// The server refuses all data without a valid login, so this screen is the
// front door, not the lock.
(function () {
  var TK = 'bc_team_session', PK = 'bc_team_pid';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return ''; } }
  var isAdmin = function () { return !!ls('roster_admin_key'); };
  var onMe = /^\/me(\/|$)/.test(location.pathname);

  // Team app: always show the logged-in person, never someone else's link.
  if (!isAdmin() && ls(TK) && ls(PK) && onMe) {
    ls('me_pid', ls(PK));
    var m = location.pathname.match(/^\/me\/([\w-]+)/);
    if (m && m[1] !== ls(PK)) try { history.replaceState(null, '', '/me/' + location.search + location.hash); } catch (e) {}
  }

  var shown = false;
  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var same = url.charAt(0) === '/' || url.indexOf(location.origin + '/') === 0;
    if (same && /\/api\//.test(url) && ls(TK)) {
      init = init || {};
      var h = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
      h.set('x-team-session', ls(TK));
      init.headers = h;
    }
    return _fetch(input, init).then(function (r) {
      if (r.status === 401 && same && /\/api\//.test(url) && !isAdmin()) {
        r.clone().json().then(function (d) { if (d && d.teamLogin) { ls(TK, null); ls(PK, null); show(); } }).catch(function () {});
      }
      return r;
    });
  };

  var CSS = '#bcg{position:fixed;inset:0;z-index:2147483000;background:#F5F0EB;display:flex;align-items:flex-start;justify-content:center;overflow:auto;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#1A1A1A;-webkit-text-size-adjust:100%}' +
    '#bcg .w{width:100%;max-width:400px;padding:56px 20px calc(32px + env(safe-area-inset-bottom))}' +
    '#bcg .lg{font-family:"Playfair Display",Georgia,serif;font-weight:700;font-size:26px;margin:0 0 28px}#bcg .lg i{color:#C06B3C;font-weight:500}' +
    '#bcg h1{font-family:"Playfair Display",Georgia,serif;font-size:28px;line-height:1.15;margin:0 0 8px}' +
    '#bcg p{font-size:15px;line-height:1.5;color:#4A4A4A;margin:0 0 22px}' +
    '#bcg label{display:block;font-size:13px;font-weight:600;margin:0 0 6px}' +
    '#bcg input{display:block;width:100%;box-sizing:border-box;font:inherit;font-size:18px;padding:14px 14px;border:1.5px solid #E4DBD1;border-radius:10px;background:#fff;color:#1A1A1A;margin:0 0 16px;outline:none}' +
    '#bcg input:focus{border-color:#C06B3C}#bcg input.pin{letter-spacing:.6em;font-size:24px;text-align:center}' +
    '#bcg button.go{width:100%;font:inherit;font-weight:600;font-size:16px;padding:15px;border:0;border-radius:10px;background:#C06B3C;color:#fff;cursor:pointer}' +
    '#bcg button.go:disabled{opacity:.6}#bcg .err{color:#B3261E;font-size:14px;min-height:20px;margin:-4px 0 14px}' +
    '#bcg .alt{display:block;margin:26px auto 0;background:none;border:0;font:inherit;font-size:13px;color:#8A7F75;text-decoration:underline;cursor:pointer}' +
    '#bcg .help{font-size:13px;color:#8A7F75;margin-top:22px;text-align:center}#bcg .help a{color:#C06B3C}';

  function show() {
    if (shown || isAdmin()) return; shown = true;
    var go = function () {
      var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      var d = document.createElement('div'); d.id = 'bcg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
      document.body.appendChild(d); document.documentElement.style.overflow = 'hidden';
      team(d);
    };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }

  function team(d) {
    d.innerHTML = '<div class="w"><div class="lg">Bardon <i>Clean</i></div><h1>Team login</h1><p>Enter your mobile number and the 4-digit passcode Jack gave you.</p>' +
      '<form autocomplete="on"><label for="bcg-ph">Mobile number</label><input id="bcg-ph" type="tel" inputmode="tel" autocomplete="tel" placeholder="04xx xxx xxx" required>' +
      '<label for="bcg-pin">Passcode</label><input id="bcg-pin" class="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="current-password" placeholder="••••" required>' +
      '<div class="err" aria-live="polite"></div><button class="go" type="submit">Log in</button></form>' +
      '<p class="help">No passcode, or locked out? Text Jack on <a href="sms:+61406216212">0406 216 212</a>.</p>' +
      (onMe ? '' : '<button class="alt" type="button">I\'m Jack</button>') + '</div>';
    var f = d.querySelector('form'), ph = d.querySelector('#bcg-ph'), pin = d.querySelector('#bcg-pin'), er = d.querySelector('.err'), btn = d.querySelector('.go');
    try { var lastPh = localStorage.getItem('bc_team_phone'); if (lastPh) { ph.value = lastPh; } } catch (e) {}
    (ph.value ? pin : ph).focus();
    pin.addEventListener('input', function () { pin.value = pin.value.replace(/\D/g, '').slice(0, 4); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (pin.value.length !== 4) { er.textContent = 'Your passcode is 4 digits.'; return; }
      btn.disabled = true; btn.textContent = 'Checking…'; er.textContent = '';
      _fetch('/api/team-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: ph.value, pin: pin.value }), cache: 'no-store' })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'That didn\'t work. Try again.'); return j; }); })
        .then(function (j) { ls(TK, j.token); ls(PK, j.pid); ls('me_pid', j.pid); ls('bc_team_phone', ph.value); location.replace(onMe ? '/me/' : location.pathname + location.search); })
        .catch(function (x) { btn.disabled = false; btn.textContent = 'Log in'; pin.value = ''; er.textContent = x.message; pin.focus(); });
    });
    var alt = d.querySelector('.alt'); if (alt) alt.addEventListener('click', function () { jack(d); });
  }

  function jack(d) {
    d.innerHTML = '<div class="w"><div class="lg">Bardon <i>Clean</i></div><h1>Jack\'s login</h1><p>Your hub password.</p>' +
      '<form><label for="bcg-pw">Password</label><input id="bcg-pw" type="password" autocomplete="current-password" required>' +
      '<div class="err" aria-live="polite"></div><button class="go" type="submit">Log in</button></form><button class="alt" type="button">Back to team login</button></div>';
    var f = d.querySelector('form'), pw = d.querySelector('#bcg-pw'), er = d.querySelector('.err'), btn = d.querySelector('.go');
    pw.focus();
    f.addEventListener('submit', function (e) {
      e.preventDefault(); btn.disabled = true; btn.textContent = 'Checking…'; er.textContent = '';
      _fetch('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': pw.value }, body: '{}', cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (!j.ok) throw new Error('That password isn\'t right.'); ls('roster_admin_key', pw.value); ls(TK, null); ls(PK, null); location.reload(); })
        .catch(function (x) { btn.disabled = false; btn.textContent = 'Log in'; er.textContent = x.message; });
    });
    d.querySelector('.alt').addEventListener('click', function () { team(d); });
  }

  window.bcTeamLogout = function () {
    var t = ls(TK);
    var done = function () { ls(TK, null); ls(PK, null); ls('me_pid', null); location.replace(onMe ? '/me/' : '/'); };
    if (!t) return done();
    _fetch('/api/team-login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-team-session': t }, body: '{"action":"logout"}' }).then(done, done);
  };

  // Logged-in team members get a small "Log out" at the very bottom of the page.
  function outLink() {
    if (isAdmin() || !ls(TK) || document.getElementById('bcg-out')) return;
    var o = document.createElement('div'); o.id = 'bcg-out';
    o.style.cssText = 'text-align:center;padding:28px 16px calc(96px + env(safe-area-inset-bottom));font:13px Inter,-apple-system,sans-serif;color:#8A7F75';
    o.innerHTML = 'Logged in on this phone · <button type="button" style="background:none;border:0;font:inherit;color:#C06B3C;text-decoration:underline;cursor:pointer;padding:0">Log out</button>';
    o.querySelector('button').addEventListener('click', window.bcTeamLogout);
    document.body.appendChild(o);
  }

  // Start: Jack's password on this phone = no team gate. Otherwise check the session.
  if (isAdmin()) return;
  if (!ls(TK)) { show(); return; }
  _fetch('/api/team-login', { headers: { 'x-team-session': ls(TK) }, cache: 'no-store' }).then(function (r) {
    if (r.status === 401) { ls(TK, null); ls(PK, null); show(); return; }
    if (document.body) outLink(); else document.addEventListener('DOMContentLoaded', outLink);
  }).catch(function () {});
})();
