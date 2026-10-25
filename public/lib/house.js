// The live house on the client link and agent portal: an outline of the home, built from the
// job's own areas, where each area fills with colour once the team finishes it.
//   Top floor: bedrooms, bathrooms, study. Bottom floor: kitchen, living, laundry and the rest.
//   A row holds at most five tiles; past two rows it becomes a two-storey house.
//   Garage sits under the house, a deck is a side verandah, outdoor is the garden strip,
//   windows and tracks is the gable window, and the roof fills at lock-up.
(function(){
  var css = '.house{display:block;width:100%;height:auto;margin:2px 0 6px}' +
    '.house .hz{fill:#FFFFFF;stroke:#DDD3C8;stroke-width:1}' +
    '.house .hf{fill:url(#bch-fill);transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(0)}' +
    '.house .done .hf{transform:scaleY(1)}' +
    '.house .rise .hf{animation:bch-rise 1.1s cubic-bezier(.65,0,.25,1) both}@keyframes bch-rise{from{transform:scaleY(0)}to{transform:scaleY(1)}}' +
    '.house .hh{opacity:0;transition:opacity .5s}.house .now .hh{opacity:1}' +
    '.house .hl{font:600 7.2px Inter,-apple-system,sans-serif;letter-spacing:.14em;fill:#6B635B;}' +
    '.house .rise .hl,.house .rise .ht,.house .rise .hrib{animation:bch-in .5s .6s both}@keyframes bch-in{from{opacity:0}}' +
    '.house .now .hl{fill:#A55830}.house .done .hl{fill:#FFFFFF}' +
    '.house .ht{font:400 7px Inter,-apple-system,sans-serif;fill:#FFFFFF;opacity:0;letter-spacing:.04em}' +
    '.house .done .ht{opacity:.8}' +
    '.house .hline{fill:none;stroke:#1A1A1A;stroke-width:1.2;stroke-linejoin:round;stroke-linecap:round}' +
    '.house .hrib{fill:none;stroke:#DDD3C8;stroke-width:.8;}.house .done .hrib{stroke:rgba(255,255,255,.35)}' +
    '@media (prefers-reduced-motion:reduce){.house *{transition:none!important;animation:none!important}}';

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
  function clock(t){ if (!t) return ''; var d = new Date(t); if (isNaN(d)) return ''; var h = d.getHours(), m = d.getMinutes();
    return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h >= 12 ? 'pm' : 'am'); }
  function kindOf(n){ n = String(n || '');
    if (/window|track/i.test(n)) return 'win';
    if (/garage|carport/i.test(n)) return 'garage';
    if (/deck|balcon|patio|verandah|veranda/i.test(n)) return 'deck';
    if (/outdoor|garden|yard|exterior/i.test(n)) return 'outdoor';
    if (/powder|toilet|\bwc\b/i.test(n)) return 'dn';
    if (/bath|ensuite|shower/i.test(n)) return 'bath';
    if (/bed|nursery|guest|robe/i.test(n)) return 'bed';
    if (/study|office/i.test(n)) return 'study';
    return 'dn';
  }
  function weight(n, k){ if (k === 'bed') return /bedrooms/i.test(n) ? 1.4 : 1; if (k === 'bath') return /bathrooms/i.test(n) ? 1 : .75; if (k === 'study') return .85;
    return /living|lounge|family|rumpus/i.test(n) ? 2 : /kitchen/i.test(n) ? 1.3 : /dining/i.test(n) ? 1.2 : .85; }
  function shortName(n){ n = String(n); if (/^living/i.test(n)) return 'Living'; if (/^powder/i.test(n)) return 'Powder'; if (/^hall/i.test(n)) return 'Hallway';
    if (/window/i.test(n)) return 'Windows'; return n.length > 12 ? n.split(/[\s&]+/)[0] : n; }

  // Split a floor into rows of at most five tiles, keeping reading order and balancing row widths.
  function rows(items){ if (!items.length) return []; var n = Math.ceil(items.length / 5), best = null;
    (function go(i, left, acc){
      if (left === 1) { var last = items.slice(i); if (!last.length || last.length > 5) return; var c = acc.concat([last]);
        var ws = c.map(function(r){ return r.reduce(function(s, x){ return s + x.w; }, 0); }), sp = Math.max.apply(null, ws) - Math.min.apply(null, ws);
        if (!best || sp < best.sp) best = { sp: sp, rows: c }; return; }
      for (var j = i + 1; j <= Math.min(items.length - 1, i + 5); j++) go(j, left - 1, acc.concat([items.slice(i, j)]));
    })(0, n, []);
    return best ? best.rows : [items];
  }

  var SEEN = {};  // job id + area -> state last drawn, so only areas that just finished animate
  // job: { rooms:[names], beds, baths, live:{ rooms:{ name:{s:'d'|'p', at} }, lock:{}, done } }, lockKeys: the lock-up items.
  function svg(job, lockKeys){
    var L = job.live || {}, R = L.rooms || {}, tiles = [];
    (job.rooms || []).forEach(function(n){
      var st = R[n] || {}, s = st.s === 'd' ? 'done' : st.s === 'p' ? 'now' : '', k = kindOf(n);
      // A grouped area ("Bedrooms") splits into one tile per room when the job knows its size; they share its state.
      var count = k === 'bed' && /bedrooms/i.test(n) ? +job.beds || 0 : k === 'bath' && /bathrooms/i.test(n) ? +job.baths || 0 : 0;
      if (count > 1) for (var i = 1; i <= count; i++) tiles.push({ n: (k === 'bed' ? 'Bed ' : 'Bath ') + i, k: k, w: k === 'bed' ? 1 : .75, s: s, at: st.at });
      else tiles.push({ n: n, k: k, w: weight(n, k), s: s, at: st.at });
    });
    var take = function(k){ for (var i = 0; i < tiles.length; i++) if (tiles[i].k === k) return tiles.splice(i, 1)[0]; return null; };
    var wins = take('win'), garage = take('garage'), deck = take('deck'), outdoor = take('outdoor');
    tiles.forEach(function(t){ if (t.k === 'win' || t.k === 'garage' || t.k === 'deck' || t.k === 'outdoor') t.k = 'dn'; });
    var up = rows(tiles.filter(function(t){ return t.k === 'bed' || t.k === 'bath' || t.k === 'study'; })),
      dn = rows(tiles.filter(function(t){ return t.k === 'dn'; }));
    if (!up.length && !dn.length) return '';
    var lock = L.lock || {}, keys = lockKeys || Object.keys(lock), allDone = (job.rooms || []).every(function(n){ return (R[n] || {}).s === 'd'; }),
      locked = !!L.done || (keys.length && keys.every(function(k){ return lock[k]; })), roofS = locked ? 'done' : allDone ? 'now' : '';

    var all = up.concat(dn), two = up.length && dn.length && all.length > 2, RH = 50, BX = 38, BR = deck ? 256 : 302, BT = 104,
      bodyH = all.length * RH + 6, BB = BT + bodyH, uid = 0;
    function label(t, x, y, w, h){
      var s = shortName(t.n).toUpperCase(), fs = Math.min(7.2, (w - 6) / (s.length * 0.92)), cx = (x + w / 2).toFixed(1), tm = clock(t.at);
      return '<text class="hl" x="' + cx + '" y="' + (y + h / 2 + 1).toFixed(1) + '" text-anchor="middle" style="font-size:' + fs.toFixed(2) + 'px">' + esc(s) + '</text>' +
        (h > 26 && w > 38 && tm && t.s === 'done' ? '<text class="ht" x="' + cx + '" y="' + (y + h / 2 + 10.5).toFixed(1) + '" text-anchor="middle">' + tm + '</text>' : '');
    }
    function cls(key, s){ var was = SEEN[job.id + '|' + key]; SEEN[job.id + '|' + key] = s || '';
      return (s || '') + (s === 'done' && was !== undefined && was !== 'done' ? ' rise' : ''); }
    function tile(t, x, y, w, h, extra){ var a = 'x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"';
      return '<g class="' + cls(t.n, t.s) + '"><title>' + esc(t.n) + (t.s === 'done' ? ' done' : t.s === 'now' ? ' underway' : '') + '</title><rect class="hz" ' + a + '/><rect class="hf" ' + a + '/><rect class="hh" ' + a + ' fill="url(#bch-hatch)"/>' + (extra || '') + label(t, x, y, w, h) + '</g>'; }

    var out = '<defs><linearGradient id="bch-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C06B3C"/><stop offset="1" stop-color="#A55830"/></linearGradient>' +
      '<pattern id="bch-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#C06B3C" stroke-width="1" opacity=".35"/></pattern>' +
      '<clipPath id="bch-roof"><polygon points="26,100 170,30 314,100"/></clipPath></defs>';
    var ribs = ''; for (var x = 32; x < 312; x += 7) ribs += '<line class="hrib" x1="' + x + '" y1="28" x2="' + x + '" y2="100"/>';
    out += '<g class="' + cls('_roof', roofS) + '"><title>Lock-up and final check' + (roofS === 'done' ? ' done' : '') + '</title><polygon points="26,100 170,30 314,100" fill="#FFFFFF"/><g clip-path="url(#bch-roof)"><rect class="hf" x="20" y="28" width="300" height="72"/><rect class="hh" x="20" y="28" width="300" height="72" fill="url(#bch-hatch)"/>' + ribs + '</g>' +
      '<text class="hl" x="170" y="96" text-anchor="middle" style="font-size:6.4px">LOCK-UP &amp; FINAL CHECK</text></g>';
    if (wins) out += tile(wins, 146, 58, 48, 28, '<path class="hrib" d="M170 58 V86"/>') + '<rect class="hline" x="146" y="58" width="48" height="28" rx="2"/>';
    else out += '<polygon class="hline" points="152,78 170,64 188,78"/>';
    out += '<polygon class="hline" points="26,100 170,30 314,100"/><path class="hline" d="M170 30 V22"/><circle cx="170" cy="20.5" r="1.8" fill="#1A1A1A"/><path class="hline" d="M18 100 H322"/>';
    all.forEach(function(row, k){
      var y = BT + 3 + k * RH, tw = row.reduce(function(s, r){ return s + r.w; }, 0), x = BX + 3, span = BR - BX - 6;
      row.forEach(function(r){ var w = span * r.w / tw; out += tile(r, x + 2.5, y + 2.5, w - 5, RH - 5); x += w; });
    });
    out += '<rect class="hline" x="' + BX + '" y="' + BT + '" width="' + (BR - BX) + '" height="' + bodyH + '" rx="1"/>';
    if (two) { var fy = BT + 3 + up.length * RH; out += '<path class="hline" d="M' + (BX - 4) + ' ' + fy + ' H' + (BR + (deck ? 0 : 4)) + '"/>'; }
    if (deck) { var dh = (two ? up.length : all.length) * RH + (two ? 3 : 6), dx = 260, dw = 42, bal = '';
      for (var bx = dx + 5; bx < dx + dw - 2; bx += 5) bal += '<line class="hrib" x1="' + bx + '" y1="' + (BT + dh - 16) + '" x2="' + bx + '" y2="' + (BT + dh - 3) + '"/>';
      bal += '<line class="hrib" x1="' + (dx + 2) + '" y1="' + (BT + dh - 16) + '" x2="' + (dx + dw - 2) + '" y2="' + (BT + dh - 16) + '"/>';
      out += tile(deck, dx, BT, dw, dh - 18) + '<g class="' + (deck.s || '') + '">' + bal + '</g><path class="hline" d="M' + (dx + dw) + ' ' + BT + ' V' + (BT + dh) + ' H' + BR + '"/>'; }
    var G0 = BB + 1, under = garage ? 40 : 14, ground = G0 + under;
    out += '<path class="hline" d="M' + (BX - 4) + ' ' + BB + ' H' + ((deck ? 302 : BR) + 4) + '"/>';
    (deck ? [52, 120, 220, 298] : [52, 120, 220, 288]).forEach(function(px){ out += '<path class="hline" d="M' + px + ' ' + G0 + ' V' + ground + '"/>'; });
    if (garage) { var door = ''; for (var gy = G0 + 8; gy < ground - 2; gy += 4) door += '<line class="hrib" x1="128" y1="' + gy + '" x2="212" y2="' + gy + '"/>';
      out += tile(garage, 124, G0 + 4, 92, under - 4, door); }
    out += '<path d="M14 ' + ground + ' H326" stroke="#DDD3C8" stroke-width="1"/>';
    var H = ground + 10;
    if (outdoor) { var shrubs = ''; [32, 48, 286, 304].forEach(function(sx){ shrubs += '<circle class="hrib" cx="' + sx + '" cy="' + (ground + 12) + '" r="6"/>'; });
      out += tile(outdoor, 20, ground + 3, 300, 20, shrubs); H = ground + 30; }
    return '<svg class="house" viewBox="0 0 340 ' + H + '" role="img" aria-label="Outline of the home. Each area fills with colour once the team finishes it.">' + out + '</svg>';
  }
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  window.BCHouse = { svg: svg };
})();
