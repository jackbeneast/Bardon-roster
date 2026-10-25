// The live house on the client link and agent portal: a Brisbane Queenslander drawn from the
// job's own areas, where each area fills with colour once the team finishes it.
//   Top floor: bedrooms, bathrooms, study. Bottom floor: kitchen, living, laundry and the rest.
//   A row holds at most five rooms; past two rows it becomes a two-storey house.
//   Each room carries its own icon from the shared Bardon set (BCART) so it reads at a glance.
//   Windows and tracks is the gable window, a deck is the front verandah, the garage sits
//   between the stumps, outdoor is the garden strip, and the roof fills at lock-up.
(function(){
  var css = '.house{display:block;width:100%;height:auto;margin:2px 0 6px}' +
    '.house .hz{fill:#FFFFFF;stroke:#DDD3C8;stroke-width:1}' +
    '.house .hf{fill:url(#bch-fill);transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(0)}' +
    '.house .done .hf{transform:scaleY(1)}' +
    '.house .rise .hf{animation:bch-rise 1.1s cubic-bezier(.65,0,.25,1) both}@keyframes bch-rise{from{transform:scaleY(0)}to{transform:scaleY(1)}}' +
    '.house .hh{opacity:0;transition:opacity .5s}.house .now .hh{opacity:1}' +
    '.house .hl{font:600 7.4px Inter,-apple-system,sans-serif;letter-spacing:.12em;fill:#6B635B;}' +
    '.house .hic{color:#B4A698}.house .now .hic{color:#A55830}.house .done .hic{color:#FFFFFF}' +
    '.house .rise .hl,.house .rise .ht,.house .rise .hrib,.house .rise .hic{animation:bch-in .5s .6s both}@keyframes bch-in{from{opacity:0}}' +
    '.house .now .hl{fill:#A55830}.house .done .hl{fill:#FFFFFF}' +
    '.house .ht{font:400 6.8px Inter,-apple-system,sans-serif;fill:#FFFFFF;opacity:0;letter-spacing:.04em}' +
    '.house .done .ht{opacity:.85}' +
    '.house .hline{fill:none;stroke:#1A1A1A;stroke-width:1.2;stroke-linejoin:round;stroke-linecap:round}' +
    '.house .hthin{fill:none;stroke:#1A1A1A;stroke-width:.8;stroke-linecap:round}' +
    '.house .hrib{fill:none;stroke:#DDD3C8;stroke-width:.8;}.house .done .hrib{stroke:rgba(255,255,255,.35)}' +
    '.house .hg{fill:none;stroke:#B9AC9E;stroke-width:1;stroke-linecap:round;stroke-linejoin:round}' +
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

  // Split a floor into rows of at most five rooms, keeping reading order and balancing row widths.
  function rows(items){ if (!items.length) return []; var n = Math.ceil(items.length / 5), best = null;
    (function go(i, left, acc){
      if (left === 1) { var last = items.slice(i); if (!last.length || last.length > 5) return; var c = acc.concat([last]);
        var ws = c.map(function(r){ return r.reduce(function(s, x){ return s + x.w; }, 0); }), sp = Math.max.apply(null, ws) - Math.min.apply(null, ws);
        if (!best || sp < best.sp) best = { sp: sp, rows: c }; return; }
      for (var j = i + 1; j <= Math.min(items.length - 1, i + 5); j++) go(j, left - 1, acc.concat([items.slice(i, j)]));
    })(0, n, []);
    return best ? best.rows : [items];
  }

  // The room's own icon, from the shared set, placed inside the house drawing.
  function areaIcon(name, x, y, size){
    if (!window.BCART || !BCART.icon) return '';
    var s = BCART.icon(BCART.areaKey(name), size, 1.9).replace('<svg ', '<svg x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" ');
    return '<g class="hic">' + s + '</g>';
  }

  var SEEN = {};  // job id + area -> state last drawn, so only areas that just finished animate
  // job: { rooms:[names], beds, baths, live:{ rooms:{ name:{s:'d'|'p', at} }, lock:{}, done } }, lockKeys: the lock-up items.
  function svg(job, lockKeys){
    var L = job.live || {}, R = L.rooms || {}, tiles = [];
    (job.rooms || []).forEach(function(n){
      var st = R[n] || {}, s = st.s === 'd' ? 'done' : st.s === 'p' ? 'now' : '', k = kindOf(n);
      // A grouped area ("Bedrooms") splits into one room per bedroom when the job knows its size; they share its state.
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

    var all = up.concat(dn), two = up.length && dn.length && all.length > 2, RH = 56, BX = 38, BR = 302, BT = 100,
      bodyH = all.length * RH + 6, BB = BT + bodyH;

    function label(t, x, y, w, h){
      var s = shortName(t.n).toUpperCase(), fs = Math.min(7.4, (w - 6) / (s.length * 0.92)), cx = x + w / 2, tm = clock(t.at),
        ico = h >= 34 && w >= 24, ly = ico ? y + h / 2 + 8 : y + h / 2 + 2.5, out = '';
      if (ico) out += areaIcon(t.n, cx - 7, y + h / 2 - 14, 14);
      out += '<text class="hl" x="' + cx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" style="font-size:' + fs.toFixed(2) + 'px">' + esc(s) + '</text>';
      if (ico && h >= 46 && w > 34 && tm && t.s === 'done') out += '<text class="ht" x="' + cx.toFixed(1) + '" y="' + (ly + 9).toFixed(1) + '" text-anchor="middle">' + tm + '</text>';
      return out;
    }
    function cls(key, s){ var was = SEEN[job.id + '|' + key]; SEEN[job.id + '|' + key] = s || '';
      return (s || '') + (s === 'done' && was !== undefined && was !== 'done' ? ' rise' : ''); }
    function tile(t, x, y, w, h, extra, noLabel){ var a = 'x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"';
      return '<g class="' + cls(t.n, t.s) + '"><title>' + esc(t.n) + (t.s === 'done' ? ' done' : t.s === 'now' ? ' underway' : '') + '</title><rect class="hz" ' + a + '/><rect class="hf" ' + a + '/><rect class="hh" ' + a + ' fill="url(#bch-hatch)"/>' + (extra || '') + (noLabel ? '' : label(t, x, y, w, h)) + '</g>'; }

    var HIP = '22,100 102,58 238,58 318,100';
    var out = '<defs><linearGradient id="bch-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C06B3C"/><stop offset="1" stop-color="#A55830"/></linearGradient>' +
      '<pattern id="bch-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#C06B3C" stroke-width="1" opacity=".35"/></pattern>' +
      '<pattern id="bch-lat" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V6M0 0H6" stroke="#CFC4B8" stroke-width=".7"/></pattern>' +
      '<clipPath id="bch-roof"><polygon points="' + HIP + '"/></clipPath></defs>';

    // ── Garden either side: a frangipani on the left, a rounded shrub on the right ──
    var VH = deck ? 34 : 26, VF = BB + VH, under = garage ? 42 : 24, ground = VF + under;
    var G = ground;
    out += '<g class="hg"><path d="M22 ' + G + 'C21 ' + (G - 16) + ' 24 ' + (G - 28) + ' 18 ' + (G - 40) + 'M22 ' + (G - 24) + 'C27 ' + (G - 30) + ' 30 ' + (G - 34) + ' 31 ' + (G - 44) + '" style="stroke-width:1.4"/>';
    [[17, G - 42, 5.5], [31, G - 47, 5], [24, G - 54, 4.5], [11, G - 50, 4]].forEach(function(f){
      for (var q = 0; q < 5; q++) { var an = (q * 72 - 90) * Math.PI / 180; out += '<ellipse cx="' + (f[0] + Math.cos(an) * f[2] * .55).toFixed(1) + '" cy="' + (f[1] + Math.sin(an) * f[2] * .55).toFixed(1) + '" rx="' + (f[2] * .48).toFixed(1) + '" ry="' + (f[2] * .3).toFixed(1) + '" transform="rotate(' + (q * 72) + ' ' + (f[0] + Math.cos(an) * f[2] * .55).toFixed(1) + ' ' + (f[1] + Math.sin(an) * f[2] * .55).toFixed(1) + ')" fill="#FFFFFF"/>'; }
    });
    out += '<path d="M318 ' + G + 'V' + (G - 16) + '" style="stroke-width:1.4"/><circle cx="318" cy="' + (G - 26) + '" r="11" fill="#EDE6DE"/><path d="M306 ' + G + 'a7 6 0 0 1 14 0z" fill="#F5F0EB"/></g>';
    [[17, G - 42], [31, G - 47], [24, G - 54], [11, G - 50]].forEach(function(f){ out += '<circle cx="' + f[0] + '" cy="' + f[1] + '" r="1.5" fill="#F4B942"/>'; });

    // ── Roof: corrugated iron hip roof, filled at lock-up ──
    var ribs = ''; for (var rx = 26; rx < 316; rx += 6) ribs += '<line class="hrib" x1="' + rx + '" y1="56" x2="' + rx + '" y2="100"/>';
    out += '<g class="' + cls('_roof', roofS) + '"><title>Lock-up and final check' + (roofS === 'done' ? ' done' : '') + '</title><polygon points="' + HIP + '" fill="#FFFFFF"/><g clip-path="url(#bch-roof)"><rect class="hf" x="20" y="56" width="300" height="44"/><rect class="hh" x="20" y="56" width="300" height="44" fill="url(#bch-hatch)"/>' + ribs + '</g>' +
      '<text class="hl" x="74" y="93" text-anchor="middle" style="font-size:6.2px">LOCK-UP</text><text class="hl" x="266" y="93" text-anchor="middle" style="font-size:6.2px">FINAL CHECK</text></g>';
    out += '<polygon class="hline" points="' + HIP + '"/>';

    // ── Front gable with its finial: windows and tracks live here, or a sunburst vent ──
    out += '<polygon points="122,100 170,48 218,100" fill="#F5F0EB"/><polygon class="hthin" points="131,97 170,55 209,97" stroke="#B9AC9E"/>';
    if (wins) out += tile(wins, 151, 74, 38, 22, '<path class="hrib" d="M170 74 V96"/>') + '<rect class="hline" x="151" y="74" width="38" height="22" rx="2"/>';
    else { var sun = '<path class="hthin" d="M156 97 A14 14 0 0 1 184 97"/>'; for (var a = 20; a <= 160; a += 20) { var rr = a * Math.PI / 180;
        sun += '<line class="hthin" x1="' + (170 - Math.cos(rr) * 5).toFixed(1) + '" y1="' + (97 - Math.sin(rr) * 5).toFixed(1) + '" x2="' + (170 - Math.cos(rr) * 12).toFixed(1) + '" y2="' + (97 - Math.sin(rr) * 12).toFixed(1) + '"/>'; }
      out += sun; }
    out += '<polygon class="hline" points="122,100 170,48 218,100"/><path class="hline" d="M170 48 V40"/><circle cx="170" cy="38.4" r="1.8" fill="#1A1A1A"/><path class="hline" d="M16 100 H324" style="stroke-width:1.6"/>';

    // ── The rooms ──
    all.forEach(function(row, k){
      var y = BT + 3 + k * RH, tw = row.reduce(function(s, r){ return s + r.w; }, 0), x = BX + 3, span = BR - BX - 6;
      row.forEach(function(r){ var w = span * r.w / tw; out += tile(r, x + 2.5, y + 2.5, w - 5, RH - 5); x += w; });
    });
    out += '<rect class="hline" x="' + BX + '" y="' + BT + '" width="' + (BR - BX) + '" height="' + bodyH + '" rx="1"/>';
    if (two) { var fy = BT + 3 + up.length * RH; out += '<path class="hline" d="M' + (BX - 4) + ' ' + fy + ' H' + (BR + 4) + '"/>'; }

    // ── Front verandah: bullnose awning, posts and balustrade; a deck area fills it ──
    var AW = BB + 8;
    out += '<path class="hline" d="M' + (BX - 10) + ' ' + AW + 'Q' + (BX - 10) + ' ' + BB + ' ' + (BX - 2) + ' ' + BB + 'H' + (BR + 2) + 'Q' + (BR + 10) + ' ' + BB + ' ' + (BR + 10) + ' ' + AW + 'Z" fill="#F5F0EB"/>';
    if (deck) out += tile(deck, BX + 1, AW + 1, BR - BX - 2, VF - AW - 2, '', true) +
      '<g class="' + (deck.s || '') + '"><text class="hl" x="' + (BX + (BR - BX) / 8).toFixed(1) + '" y="' + (AW + 8.6) + '" text-anchor="middle" style="font-size:6.4px">' + esc(shortName(deck.n).toUpperCase()) + '</text></g>';
    var bal = '', posts = [BX, BX + (BR - BX) / 4, 158, 182, BR - (BR - BX) / 4, BR], hr = VF - 12;
    for (var bx = BX + 4; bx < BR - 2; bx += 4) if (bx < 156 || bx > 184) bal += '<line class="hthin" x1="' + bx + '" y1="' + hr + '" x2="' + bx + '" y2="' + VF + '"/>';
    out += '<g class="' + (deck ? deck.s || '' : '') + '">' + bal + '</g>';
    out += '<path class="hline" d="M' + BX + ' ' + hr + 'H158M182 ' + hr + 'H' + BR + '"/>';
    posts.forEach(function(px){ out += '<path class="hline" d="M' + px + ' ' + AW + 'V' + VF + '"/>'; });
    out += '<path class="hline" d="M' + (BX - 6) + ' ' + VF + 'H' + (BR + 6) + '" style="stroke-width:1.6"/>';

    // ── Under the house: stumps, timber lattice, front stairs and the garage bay ──
    out += '<rect x="' + (BX + 1) + '" y="' + (VF + 1) + '" width="' + (BR - BX - 2) + '" height="' + (under - 2) + '" fill="url(#bch-lat)"/>';
    out += '<rect x="157" y="' + (VF + 1) + '" width="26" height="' + (under - 1) + '" fill="#FFFFFF"/>';
    var tr = ''; for (var sy = VF + 5; sy < ground - 1; sy += 5) tr += '<path class="hthin" d="M158 ' + sy + 'H182"/>';
    out += tr + '<path class="hline" d="M158 ' + hr + 'V' + ground + 'M182 ' + hr + 'V' + ground + '"/>';
    (garage ? [BX + 10, 140, 200, BR - 10] : [BX + 10, 104, 140, 200, 236, BR - 10]).forEach(function(px){ out += '<path class="hline" d="M' + px + ' ' + VF + 'V' + ground + '"/>'; });
    if (garage) { var door = ''; for (var gy = VF + 10; gy < ground - 2; gy += 4) door += '<line class="hrib" x1="208" y1="' + gy + '" x2="' + (BR - 18) + '" y2="' + gy + '"/>';
      out += tile(garage, 204, VF + 4, BR - 18 - 200, under - 4, door); }
    out += '<path d="M8 ' + ground + ' H332" stroke="#B9AC9E" stroke-width="1"/>';

    var H = ground + 8;
    if (outdoor) { var shrubs = ''; [34, 50, 290, 306].forEach(function(sx){ shrubs += '<circle class="hrib" cx="' + sx + '" cy="' + (ground + 13) + '" r="6"/>'; });
      out += tile(outdoor, 20, ground + 4, 300, 22, shrubs); H = ground + 32; }
    return '<svg class="house" viewBox="0 30 340 ' + (H - 30) + '" role="img" aria-label="A drawing of the home. Each area fills with colour once the team finishes it.">' + out + '</svg>';
  }
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  window.BCHouse = { svg: svg };
})();
