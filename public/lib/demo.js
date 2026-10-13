// Public demo of the client job link and agent portal, for the website.
//   /demo        a pre-sale clean (seller)
//   /demo/rent   a bond clean (tenant)
//   /demo/agent  the agent portal with three sample listings
// Everything here is made up and built in the browser. Nothing is read from or
// saved to the hub, so strangers can tap every button safely.
(function(){
  // Real job photos Jack picks in the hub (Tools › Website demo photos), loaded from /api/demo.
  // Rooms without a pick show a labelled placeholder.
  var PHOTOS = {};

  var TEAM = [{ id: 'dj', name: 'Jack', owner: true }, { id: 'dm', name: 'Mariam' }];
  var LOCK = { doors: 'Windows and doors locked', lights: 'Lights and fans off', ac: 'Air-con off', keys: 'Keys returned or lockbox set' };
  var ROOMS = ['Kitchen', 'Bathrooms', 'Bedrooms', 'Living & dining', 'Laundry', 'Windows & tracks'];
  var DONE_AT = ['09:40', '10:25', '11:10', '11:50', '12:30', '13:35'];
  var CHECKS = [14, 11, 9, 8, 6, 7];

  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function day(n){ var d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function at(date, hm){ var p = date.split('-'), t = hm.split(':'); return new Date(+p[0], +p[1] - 1, +p[2], +t[0], +t[1]).toISOString(); }

  function placeholder(room, kind){
    var bg = kind === 'before' ? '#8E8379' : '#EDE6DE', fg = kind === 'before' ? '#F5F0EB' : '#5E554C';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="' + bg + '"/>' +
      '<text x="400" y="290" text-anchor="middle" font-family="Georgia, serif" font-size="46" font-weight="700" fill="' + fg + '">' + room.replace(/&/g, '&amp;') + '</text>' +
      '<text x="400" y="345" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="' + fg + '">' + (kind === 'before' ? 'Before' : 'After') + ' · sample photo</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function photo(room, kind, date, hm){
    var real = PHOTOS[room] && PHOTOS[room][kind];
    return { id: 'p-' + kind + '-' + room, room: room, kind: kind, at: at(date, hm), src: real || placeholder(room, kind) };
  }

  var CFG = {
    sell: {
      address: 'Sample: 7 Latrobe Tce', suburb: 'Paddington', service: 'Pre-sale clean', readyBy: 'Photography 9am tomorrow', kind: 'presale',
      flags: [{ id: 'f1', t: 'Scuff marks on the hallway wall', d: 'Light scuffs at hand height that won\'t wipe off without lifting the paint. A touch-up would help before photos.', after: 1 }]
    },
    rent: {
      address: 'Sample: Unit 4, 12 Park Rd', suburb: 'Milton', service: 'Bond clean', readyBy: 'Bond inspection Friday', kind: 'bond',
      flags: [{ id: 'f1', t: 'Carpet stain in bedroom 2', d: 'Treated twice. It has lightened but hasn\'t lifted fully. A carpet steam clean would be the next step if the agent raises it.', after: 2 }]
    }
  };

  // One job's live state. phase: 'before' | 'day' | 'done'. step (day only): rooms finished so far, 0..6, then 7 = locked up.
  function job(cfg, id, phase, step, dayOffset){
    var date = day(dayOffset || 0);
    var j = { id: id, date: phase === 'before' ? day(1) : date, start: '08:00', end: '14:30',
      address: cfg.address, suburb: cfg.suburb, service: cfg.service, readyBy: cfg.readyBy, rooms: ROOMS.slice(), team: TEAM.slice(),
      live: { arrived: {}, rooms: {}, flags: [], photos: [], lock: {}, eta: '', done: '', updated: '', checks: {} } };
    if (phase === 'before') return j;
    var L = j.live, n = phase === 'done' ? ROOMS.length : Math.min(step, ROOMS.length);
    L.arrived = { dj: at(date, '07:56'), dm: at(date, '08:02') };
    L.eta = '14:30';
    ROOMS.forEach(function(r){ L.photos.push(photo(r, 'before', date, '08:15')); });
    for (var i = 0; i < n; i++) {
      L.rooms[ROOMS[i]] = { s: 'd', at: at(date, DONE_AT[i]) };
      L.checks[ROOMS[i]] = CHECKS[i];
      L.photos.push(photo(ROOMS[i], 'after', date, DONE_AT[i]));
    }
    if (n < ROOMS.length) L.rooms[ROOMS[n]] = { s: 'p', at: at(date, n ? DONE_AT[n - 1] : '08:20') };
    cfg.flags.forEach(function(f){ if (phase === 'done' || n >= f.after) L.flags.push({ id: f.id, t: f.t, d: f.d, at: at(date, DONE_AT[f.after - 1] || '09:30') }); });
    var locked = phase === 'done' || step > ROOMS.length;
    if (locked) Object.keys(LOCK).forEach(function(k){ L.lock[k] = at(date, '14:15'); });
    if (phase === 'done') L.done = at(date, '14:20');
    L.updated = L.done || (locked ? at(date, '14:15') : n ? at(date, DONE_AT[n - 1]) : at(date, '08:02'));
    return j;
  }

  function data(aud, phase, step, saved){
    var base = { lock: LOCK, phone: '0406 216 212', demo: true };
    if (aud === 'agent') {
      return Object.assign(base, { mode: 'agent', agent: { name: 'Sample agent', agency: 'Demo listings' }, jobs: [
        job(CFG.sell, 'demo-live', 'day', step, 0),
        Object.assign(job({ address: 'Sample: 3 Preview Ave', suburb: 'Ashgrove', service: 'Deep clean', readyBy: 'Photography 9am next day', flags: [] }, 'demo-next', 'before', 0), { date: day(3) }),
        job({ address: 'Sample: 21 Example St', suburb: 'Bardon', service: 'Pre-sale clean', readyBy: 'Open home Saturday 10am', flags: [
          { id: 'f1', t: 'Oven door seal cracked', d: 'Cleaned fully, but the seal is split along the bottom edge. Worth replacing before photos if the oven will be shown open.', after: 1 },
          { id: 'f2', t: 'Mould returning through shower silicone', d: 'Main bathroom. Treated and cleaned, but it\'s under the silicone, so it will come back. A re-seal would fix it properly.', after: 2 }
        ] }, 'demo-done', 'done', 0, -1)
      ] });
    }
    var cfg = CFG[aud] || CFG.sell;
    return Object.assign(base, { mode: 'vendor', agent: null, jobs: [job(cfg, 'demo-' + aud, phase, step)],
      client: { access: saved.access || null, feedback: saved.feedback || null, reviewLink: '', kind: cfg.kind } });
  }

  // ---- the bar above the page ----
  var css = '#demobar{padding-top:14px}' +
    '#demobar .db{background:var(--dark);color:var(--cream);border-radius:10px;padding:14px 16px;display:grid;gap:12px}' +
    '#demobar .db p{margin:0;font-size:14px;line-height:1.5;color:#CFC6BC}' +
    '#demobar .db b{color:var(--cream);font-weight:600}' +
    '#demobar .tag{display:inline-block;background:var(--gold);color:var(--dark);font:600 11px/1 var(--sans);letter-spacing:.08em;text-transform:uppercase;padding:5px 8px;border-radius:999px;margin-right:6px;vertical-align:1px}' +
    '#demobar .ph{display:flex;gap:6px;flex-wrap:wrap}' +
    '#demobar .ph button{flex:1 1 auto;min-height:40px;border-radius:8px;border:1px solid #4A4A4A;background:transparent;color:var(--cream);font:500 14px var(--sans);padding:0 12px}' +
    '#demobar .ph button[aria-pressed="true"]{background:var(--cream);border-color:var(--cream);color:var(--dark)}' +
    '#demobar .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}' +
    '#demobar .row a{color:var(--cream);font:600 14px var(--sans)}' +
    '#demobar .go{background:var(--terracotta);color:#fff!important;text-decoration:none;border-radius:8px;min-height:40px;display:inline-flex;align-items:center;padding:0 14px}';

  function bar(aud, phase, playing){
    var h = '<div class="db"><p><span class="tag">Sample</span>';
    if (aud === 'agent') h += '<b>This is the agent portal.</b> Every listing we clean for you, live. The jobs here are made up, and nothing you tap is sent.';
    else h += '<b>This is the page every Bardon Clean client gets.</b> The job is made up, and nothing you tap is sent.';
    h += '</p>';
    if (aud !== 'agent') {
      h += '<div class="ph" role="group" aria-label="Show the clean">' +
        [['before', 'Before'], ['day', playing ? 'On the day ▸' : 'On the day'], ['done', 'Finished']].map(function(x){
          return '<button type="button" data-demo-phase="' + x[0] + '" aria-pressed="' + (phase === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    }
    h += '<div class="row">' + (aud === 'agent'
      ? '<a href="sms:+61468193772">Text Jack about the portal</a><a class="go" href="/quote?src=demo-agent">Book a clean</a>'
      : '<a href="/demo' + (aud === 'rent' ? '' : '/rent') + '">' + (aud === 'rent' ? 'See a pre-sale clean' : 'See a bond clean') + '</a><a class="go" href="/quote?src=demo">Get a quote</a>') + '</div></div>';
    return h;
  }

  window.BCDemo = {
    match: function(path){ var m = /^\/demo(?:\/(sell|rent|agent))?\/?$/.exec(path); return m ? (m[1] || 'sell') : null; },
    data: data, bar: bar, css: css, steps: ROOMS.length + 1,
    loadPhotos: function(){
      return fetch('/api/demo').then(function(r){ return r.ok ? r.json() : {}; })
        .then(function(d){ PHOTOS = (d && d.photos) || {}; }).catch(function(){});
    }
  };
})();
