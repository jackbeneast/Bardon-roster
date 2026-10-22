// Public demo of the client job link and agent portal, for the website.
//   /demo        a pre-sale clean (seller)
//   /demo/rent   a bond clean (tenant)
//   /demo/agent  the agent portal with three sample listings
// Everything here is made up and built in the browser. Nothing is read from or
// saved to the hub, so strangers can tap every button safely.
(function(){
  // Jack's best after photos (Tools › Website photos), loaded from /api/demo: { room: url }.
  // The demo shows afters only; rooms without one show a labelled placeholder.
  var PHOTOS = {};   // room -> [after urls] from Jack's picked website photos
  var REPORTS = {};  // presale|bond|deep -> a real finished job Jack picked: { rooms, photos:[{room,kind,url}], ticked }
  // Real jobs name rooms their own way ("Main bedroom", "Ensuite"); fold them into the demo's six.
  function demoRoom(r){ r = String(r || '');
    return /bath|ensuite|powder|toilet/i.test(r) ? 'Bathrooms' : /bed|robe|nursery|guest/i.test(r) ? 'Bedrooms' : /kitchen|pantry/i.test(r) ? 'Kitchen'
      : /laundry/i.test(r) ? 'Laundry' : /window|track/i.test(r) ? 'Windows & tracks' : /living|dining|lounge|family|rumpus|media|study|hall|entry/i.test(r) ? 'Living & dining' : ''; }

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
  // Photos for one finished room: the sample report's real befores and afters if Jack picked one,
  // else his picked website afters, else a labelled placeholder.
  function roomPhotos(room, date, hm, rep){
    var out = [], n = 0;
    if (rep) rep.photos.forEach(function(x){ if (demoRoom(x.room) === room) out.push({ id: 'p' + (n++) + '-' + room, room: room, kind: x.kind, at: at(date, hm), src: x.url }); });
    if (!out.some(function(x){ return x.kind === 'after'; })) {
      var urls = PHOTOS[room] || [];
      if (urls.length) urls.forEach(function(u){ out.push({ id: 'p' + (n++) + '-' + room, room: room, kind: 'after', at: at(date, hm), src: u }); });
      else out.push({ id: 'p-after-' + room, room: room, kind: 'after', at: at(date, hm), src: placeholder(room, 'after') });
    }
    return out;
  }
  // Ticked checks: the real job's ticks for that room if there are any, else the full list for the service.
  function ticks(room, service, rep){
    var all = window.CHECKLISTS ? window.CHECKLISTS.itemsFor(room, service).map(function(i){ return i.id; }) : [];
    if (rep && rep.ticked) {
      var got = {}; Object.keys(rep.ticked).forEach(function(r){ if (demoRoom(r) === room) rep.ticked[r].forEach(function(id){ got[id] = 1; }); });
      var real = all.filter(function(id){ return got[id]; });
      if (real.length >= Math.min(8, all.length)) return real;
    }
    return all;
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
  function job(cfg, id, phase, step, dayOffset, rep){
    var date = day(dayOffset || 0);
    var j = { id: id, date: phase === 'before' ? day(1) : date, start: '08:00', end: '14:30',
      address: cfg.address, suburb: cfg.suburb, service: cfg.service, readyBy: cfg.readyBy, rooms: ROOMS.slice(), team: TEAM.slice(),
      live: { arrived: {}, rooms: {}, flags: [], photos: [], lock: {}, eta: '', done: '', updated: '', checks: {}, ticked: {} } };
    if (phase === 'before') return j;
    var L = j.live, n = phase === 'done' ? ROOMS.length : Math.min(step, ROOMS.length);
    L.arrived = { dj: at(date, '07:56'), dm: at(date, '08:02') };
    L.eta = '14:30';
    for (var i = 0; i < n; i++) {
      L.rooms[ROOMS[i]] = { s: 'd', at: at(date, DONE_AT[i]) };
      L.ticked[ROOMS[i]] = ticks(ROOMS[i], cfg.service, rep);
      L.checks[ROOMS[i]] = L.ticked[ROOMS[i]].length || CHECKS[i];
      L.photos = L.photos.concat(roomPhotos(ROOMS[i], date, DONE_AT[i], rep));
    }
    if (n < ROOMS.length) {
      L.rooms[ROOMS[n]] = { s: 'p', at: at(date, n ? DONE_AT[n - 1] : '08:20') };
      // The room underway: about half its list ticked, and its befores taken.
      var half = ticks(ROOMS[n], cfg.service, rep); L.ticked[ROOMS[n]] = half.slice(0, Math.ceil(half.length / 2)); L.checks[ROOMS[n]] = L.ticked[ROOMS[n]].length;
      L.photos = L.photos.concat(roomPhotos(ROOMS[n], date, '09:00', rep).filter(function(x){ return x.kind === 'before'; }));
    }
    cfg.flags.forEach(function(f){ if (phase === 'done' || n >= f.after) L.flags.push({ id: f.id, t: f.t, d: f.d, at: at(date, DONE_AT[f.after - 1] || '09:30') }); });
    var locked = phase === 'done' || step > ROOMS.length;
    if (locked) Object.keys(LOCK).forEach(function(k){ L.lock[k] = at(date, '14:15'); });
    if (phase === 'done') L.done = at(date, '14:20');
    L.updated = L.done || (locked ? at(date, '14:15') : n ? at(date, DONE_AT[n - 1]) : at(date, '08:02'));
    return j;
  }

  // Sample prices for the demo's Price & billing. Placeholders: made up for the demo.
  var bill = function(price, depositPaid, paidInFull, quoteState){
    var dep = Math.round(price / 2), items = [{ kind: 'quote', num: 'S1', state: quoteState || 'accepted', total: price, paid: 0, due: 0, gst: true }];
    if (quoteState !== 'sent') items.push({ kind: 'invoice', num: 'S2', deposit: true, state: depositPaid ? 'paid' : 'sent', total: dep, paid: depositPaid ? dep : 0, due: depositPaid ? 0 : dep, dueDate: day(0), gst: true });
    if (paidInFull) items.push({ kind: 'invoice', num: 'S3', state: 'paid', total: price - dep, paid: price - dep, due: 0, gst: true });
    var paid = items.filter(function(x){ return x.kind === 'invoice'; }).reduce(function(n, x){ return n + x.paid; }, 0);
    return { price: price, paid: paid, owing: Math.max(0, price - paid), items: items };
  };
  function data(aud, phase, step, saved){
    var base = { lock: LOCK, phone: '0406 216 212', demo: true, biz: { abn: '46 426 437 394', legal: 'Jack East T/A Bardon Clean' } };
    var R = function(k){ return REPORTS[k] || REPORTS.presale || REPORTS.deep || REPORTS.bond || null; };
    if (aud === 'agent') {
      // Sample prices and a sample conversation, so the Price & billing and Messages parts show.
      // Every figure here is made up for the demo.

      if (!saved.chat) saved.chat = { on: true, msgs: [
        { id: 'c1', dir: 'in', via: 'portal', text: 'Re 21 Example St: Vendor loved the report. They\'re replacing the oven seal before photos, thanks for flagging it.', at: at(day(-1), '16:12') },
        { id: 'c2', dir: 'out', text: 'Great to hear. Photos are all in the report if the photographer wants a look first.', at: at(day(-1), '16:20') },
        { id: 'c3', dir: 'in', via: 'portal', text: 'Re 7 Latrobe Tce: Keys are in the lockbox by the side gate. Photographer is booked 9am tomorrow.', at: at(day(0), '07:34') },
        { id: 'c4', dir: 'out', text: 'Got them, thanks. Team is on site now. You\'ll see each room tick off as it\'s done.', at: at(day(0), '07:58') }
      ] };
      var out = Object.assign(base, { mode: 'agent', agent: { name: 'Sample agent', agency: 'Demo listings' }, chat: saved.chat, jobs: [
        Object.assign(job(CFG.sell, 'demo-live', 'day', step, 0, REPORTS.deep || R('presale')), { billing: bill(690, true, false) }),
        Object.assign(job({ address: 'Sample: 3 Preview Ave', suburb: 'Ashgrove', service: 'Deep clean', readyBy: 'Photography 9am next day', flags: [] }, 'demo-next', 'before', 0), { date: day(3), billing: bill(480, false, false) }),
        job({ address: 'Sample: 21 Example St', suburb: 'Bardon', service: 'Pre-sale clean', readyBy: 'Open home Saturday 10am', flags: [
          { id: 'f1', t: 'Oven door seal cracked', d: 'Cleaned fully, but the seal is split along the bottom edge. Worth replacing before photos if the oven will be shown open.', after: 1 },
          { id: 'f2', t: 'Mould returning through shower silicone', d: 'Main bathroom. Treated and cleaned, but it\'s under the silicone, so it will come back. A re-seal would fix it properly.', after: 2 }
        ] }, 'demo-done', 'done', 0, -1, R('presale'))
      ] });
      var fr = [], d0 = new Date(); for (var k = 2; fr.length < 6 && k < 30; k++) { var dd = new Date(d0); dd.setDate(d0.getDate() + k); if (dd.getDay() && dd.getDay() !== 6 && k % 3) fr.push(day(k)); }
      out.free = fr;
      out.jobs[2].billing = bill(560, true, true);
      return out;
    }
    var cfg = CFG[aud] || CFG.sell;
    var vj = job(cfg, 'demo-' + aud, phase, step, 0, R(cfg.kind));
    vj.billing = bill(aud === 'rent' ? 520 : 690, true, phase === 'done');
    return Object.assign(base, { mode: 'vendor', agent: null, jobs: [vj],
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
    if (aud === 'agent') h += '<b>This is the agent portal.</b> Every listing we clean for you, live: progress, photos, prices and messages with Jack in one place. Everything here is made up, and nothing you tap is sent.';
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
        .then(function(d){
          // Jack's best afters: each demo room gets an after from that room, then any left over fill the gaps.
          var list = (d && d.afters) || [], map = {};
          list.forEach(function(x){ var r = demoRoom(x.room); if (r) (map[r] = map[r] || []).push(x.url); });
          PHOTOS = map;
          REPORTS = (d && d.reports) || {};
        }).catch(function(){});
    }
  };
})();
