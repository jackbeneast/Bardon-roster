// Built-in step drawings for the Toolkit's Premium touches. A guide step's
// picture can be "art:<key>" (one of these) or a photo Jack uploads.
// Colours come from the team app's CSS variables, so they match the app.
(function(){
  var W='var(--white)', D='var(--dark)', F='var(--cd)', A='var(--tcd)', G='var(--gold)';
  function svg(body, label){
    return '<svg viewBox="0 0 240 160" role="img" aria-label="'+label+'" xmlns="http://www.w3.org/2000/svg">'+
      '<defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="'+A+'"/></marker></defs>'+body+'</svg>';
  }
  function arrow(d){ return '<path d="'+d+'" fill="none" stroke="'+A+'" stroke-width="2.5" stroke-linecap="round" marker-end="url(#ah)"/>'; }
  function poly(pts, fill, dash){ return '<polygon points="'+pts+'" fill="'+fill+'" stroke="'+D+'" stroke-width="2" stroke-linejoin="round"'+(dash?' stroke-dasharray="5 4"':'')+'/>'; }
  function line(x1,y1,x2,y2,dash,col){ return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(col||D)+'" stroke-width="2"'+(dash?' stroke-dasharray="5 4"':'')+' stroke-linecap="round"/>'; }
  function spark(x,y){ return '<path d="M'+x+' '+(y-9)+'L'+(x+2.5)+' '+(y-2.5)+'L'+(x+9)+' '+y+'L'+(x+2.5)+' '+(y+2.5)+'L'+x+' '+(y+9)+'L'+(x-2.5)+' '+(y+2.5)+'L'+(x-9)+' '+y+'L'+(x-2.5)+' '+(y-2.5)+'z" fill="'+G+'"/>'; }

  // Toilet roll on its holder, seen from the front, with the sheet hanging down.
  var roll = line(30,40,210,40) + '<rect x="56" y="18" width="128" height="44" rx="8" fill="'+W+'" stroke="'+D+'" stroke-width="2"/>' + line(66,22,66,58,false,F);
  var tail = '80,62 160,62 160,140 80,140';

  // Towel and tea towel laid flat (portrait), folded in thirds along the length.
  var flat = poly('70,10 170,10 170,150 70,150', W);

  var A_ = {
    tp1: svg(roll + poly('80,62 160,62 160,150 120,150 80,110', W) + poly('80,110 120,150 120,110', F) + arrow('M70 142 Q80 116 108 116'), 'Bottom-left corner folded up to the centre'),
    tp2: svg(roll + poly('80,62 160,62 160,110 120,150 80,110', W) + poly('80,110 120,150 120,110', F) + poly('160,110 120,150 120,110', F) + arrow('M170 142 Q160 116 132 116'), 'Bottom-right corner folded up to make a point'),
    tp3: svg(roll + poly('80,62 160,62 160,110 80,110', W) + poly('80,110 160,110 120,70', F) + poly('80,110 160,110 120,150', 'none', true) + arrow('M186 140 Q196 100 150 92'), 'Point folded straight up, covering the raw edges'),
    tp4: svg(roll + poly('80,62 160,62 160,70 120,110 80,70', W) + poly('120,70 140,90 120,110 100,90', F) + poly('80,70 80,110 120,110', 'none', true) + poly('160,70 160,110 120,110', 'none', true) + arrow('M70 104 Q58 86 78 74') + arrow('M170 104 Q182 86 162 74'), 'Left and right corners folded behind: a diamond shows'),
    tp5: svg(roll + poly('80,62 160,62 160,85 120,125 80,85', W) + poly('120,85 140,105 120,125 100,105', F) + arrow('M196 26 Q206 40 196 54') + spark(152,140) + spark(84,132), 'Paper rolled slightly so the diamond sits centred'),

    tw1: svg(flat + line(103,10,103,150,true) + line(137,10,137,150,true), 'Towel flat, face down, marked in thirds along its length'),
    tw2: svg(poly('103,10 170,10 170,150 103,150', W) + poly('103,10 137,10 137,150 103,150', F) + arrow('M58 80 Q70 58 112 70'), 'One long side folded in a third'),
    tw3: svg(poly('103,10 137,10 137,150 103,150', F) + line(108,10,108,150,false,D) + arrow('M182 80 Q170 58 128 70'), 'Other long side folded over: a long, neat strip'),
    tw4: svg('<rect x="40" y="46" width="160" height="8" rx="4" fill="'+D+'"/>' + poly('102,52 138,52 138,148 102,148', W) + poly('102,52 138,52 138,60 102,60', F) + line(84,148,156,148,true,A) + '<text x="160" y="152" font-size="12" fill="'+A+'" font-family="sans-serif">level</text>' + spark(160,30), 'Strip hung over the rail, ends level'),

    tt1: svg(flat + line(103,10,103,150,true) + line(137,10,137,150,true), 'Tea towel flat, marked in thirds along its length'),
    tt2: svg(poly('103,10 137,10 137,150 103,150', F) + line(103,57,137,57,true) + line(103,103,137,103,true) + arrow('M60 80 L94 80') + arrow('M180 80 L146 80'), 'Folded into a long strip, then marked in thirds again'),
    tt3: svg(poly('103,57 137,57 137,150 103,150', F) + poly('103,57 137,57 137,103 103,103', W) + line(103,103,137,103,true) + arrow('M150 30 Q168 50 146 80'), 'Top third folded down'),
    tt4: svg('<rect x="96" y="62" width="48" height="50" rx="3" fill="rgba(0,0,0,.08)"/>' + poly('100,57 140,57 140,105 100,105', W) + line(100,81,140,81,false,F) + line(20,112,220,112) + spark(156,46), 'Bottom third folded up into a neat pad')
  };
  // ───────────── Pass vs redo pairs ─────────────
  // Each pair is two small drawings of the same thing: how it should be left,
  // and what gets redone. Shown under "The standard" in a guide.
  var DIRT='#9C8B78', CHROME='#C9CED3', GLASS='rgba(150,185,205,.28)', OK='#3F7A4A';
  function pv(body, label){ return '<svg viewBox="0 0 160 130" role="img" aria-label="'+label+'" xmlns="http://www.w3.org/2000/svg">'+body+'</svg>'; }
  function rect(x,y,w,h,fill,rx,extra){ return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+(rx||0)+'" fill="'+fill+'" stroke="'+D+'" stroke-width="2"'+(extra||'')+'/>'; }
  function path(d,fill,sw,col,extra){ return '<path d="'+d+'" fill="'+(fill||'none')+'" stroke="'+(col||D)+'" stroke-width="'+(sw||2)+'" stroke-linecap="round" stroke-linejoin="round"'+(extra||'')+'/>'; }
  function dots(list, col, r){ return list.map(function(p){ return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(p[2]||r||2)+'" fill="'+col+'"/>'; }).join(''); }
  function shine(x,y,s){ s=s||1; return '<path d="M'+x+' '+(y-7*s)+'L'+(x+1.8*s)+' '+(y-1.8*s)+'L'+(x+7*s)+' '+y+'L'+(x+1.8*s)+' '+(y+1.8*s)+'L'+x+' '+(y+7*s)+'L'+(x-1.8*s)+' '+(y+1.8*s)+'L'+(x-7*s)+' '+y+'L'+(x-1.8*s)+' '+(y-1.8*s)+'z" fill="'+G+'"/>'; }

  // Window or mirror pane
  var pane = rect(30,14,100,102,GLASS,3) + line(80,14,80,116,false,D);
  // Mixer tap on a basin edge
  var tap = '<rect x="20" y="104" width="120" height="12" rx="3" fill="'+W+'" stroke="'+D+'" stroke-width="2"/>' +
    path('M66 104 L66 54 Q66 36 84 36 L114 36 Q122 36 122 44 L122 56 L112 56 L112 46 L86 46 Q78 46 78 56 L78 104 Z', CHROME) +
    rect(60,96,26,8,CHROME,2) + rect(64,70,18,8,CHROME,2) + path('M73 70 L73 62 L96 58', 'none', 3);
  // Stainless fridge door
  var steel = rect(42,8,76,114,'#E3E6E9',4) + line(108,30,108,70,false,D);
  // Benchtop seen low, looking toward the light
  var bench = '<polygon points="10,110 150,110 128,40 32,40" fill="'+F+'" stroke="'+D+'" stroke-width="2" stroke-linejoin="round"/>' + line(32,40,128,40,false,D) + '<circle cx="80" cy="22" r="10" fill="'+G+'" opacity=".5"/>';
  // Toilet base and floor, front view
  var toiletB = line(10,112,150,112) + path('M48 20 L112 20 L112 44 L48 44 Z', W) + path('M40 44 L120 44 Q120 72 100 82 L104 112 L56 112 L60 82 Q40 72 40 44 Z', W);
  // Tiles with grout lines
  function tiles(grout){ var s='<rect x="14" y="10" width="132" height="110" rx="3" fill="'+W+'" stroke="'+D+'" stroke-width="2"/>'; for(var x=47;x<146;x+=33) s+=line(x,10,x,120,false,grout); for(var y=37.5;y<120;y+=27.5) s+=line(14,y,146,y,false,grout); return s; }
  // Bed, side view
  var bedBase = rect(18,40,10,82,F,2) + rect(28,84,118,14,W,3) + rect(30,98,114,14,F,2) + line(36,112,36,122) + line(138,112,138,122) + line(8,122,152,122);
  // Carpet patch
  var carpet = '<rect x="10" y="10" width="140" height="110" rx="4" fill="'+F+'" stroke="'+D+'" stroke-width="2"/>';
  // Skirting along a floor, with a corner
  var skirt = line(10,12,10,12) + '<rect x="0" y="0" width="160" height="96" fill="'+W+'"/>' + rect(-4,82,124,16,W,0) + rect(120,10,40,88,F,0) + line(120,10,120,98) + rect(120,82,44,16,W,0) + '<rect x="0" y="98" width="160" height="32" fill="'+F+'"/>' + line(0,98,160,98);
  // Bath towel on a rail
  var rail = '<rect x="20" y="18" width="120" height="7" rx="3.5" fill="'+D+'"/>';
  // Oven door
  var ovenDoor = rect(16,16,128,98,'#3A3A3A',8) + rect(30,34,100,62,'#6B6E72',4) + rect(40,22,80,6,CHROME,3);
  // Cushion on a couch
  var couch = rect(8,46,144,40,F,10) + rect(4,74,152,30,F,8) + line(16,104,16,116) + line(144,104,144,116);

  var P_ = {
    pfglass: { k:'Glass and mirrors', ok:'Clear when you look across it toward the light', no:'Streaks, wipe arcs or a hazy edge',
      pass: pv(pane + path('M44 40 L66 24', 'none', 4, '#fff', ' opacity=".9"') + path('M44 56 L58 46', 'none', 3, '#fff', ' opacity=".9"') + shine(116,96) + shine(98,30,.7), 'Clear glass'),
      fail: pv(pane + path('M36 40 Q58 22 76 44', 'none', 3, DIRT, ' opacity=".7"') + path('M36 66 Q60 48 76 70', 'none', 3, DIRT, ' opacity=".7"') + path('M84 50 Q104 30 126 56', 'none', 3, DIRT, ' opacity=".7"') + path('M84 82 Q106 62 126 88', 'none', 3, DIRT, ' opacity=".7"') + path('M32 110 L78 110', 'none', 4, DIRT, ' opacity=".5"'), 'Streaky glass') },
    pftap: { k:'Taps and fixtures', ok:'Dry, shining, nothing around the base', no:'Water spots, or a scale ring at the base',
      pass: pv(tap + path('M80 50 L104 50', 'none', 3, '#fff') + shine(126,30) + shine(50,90,.7), 'Polished tap'),
      fail: pv(tap + dots([[82,48],[96,46],[108,50],[74,62],[74,80],[78,90],[90,46,1.5],[73,70,1.5]], '#fff', 2.2) + path('M54 104 Q73 98 92 104', 'none', 4, DIRT) + dots([[100,110,2.5],[110,108,2],[44,109,2]], '#B7C4CC'), 'Spotted tap') },
    pfsteel: { k:'Stainless steel', ok:'Wiped with the grain, no marks', no:'Swirls, smears or fingerprints',
      pass: pv(steel + [50,58,66,74,82,90,98].map(function(x){ return line(x,14,x,116,false,'rgba(26,26,26,.12)'); }).join('') + path('M56 20 L56 60', 'none', 3, '#fff') + shine(126,18), 'Stainless with the grain'),
      fail: pv(steel + path('M58 50 Q80 30 100 52 Q80 74 58 50', 'none', 2.5, DIRT, ' opacity=".6"') + path('M54 84 Q76 66 98 86', 'none', 2.5, DIRT, ' opacity=".6"') + dots([[100,62,3.5],[104,70,3.5],[98,78,3],[92,60,3]], DIRT) , 'Smeared stainless') },
    pfbench: { k:'Benchtops', ok:'Even sheen across the whole top, edges and back included', no:'Smears that show in the light, crumbs at the back edge',
      pass: pv(bench + '<polygon points="60,44 100,44 112,106 48,106" fill="#fff" opacity=".55"/>' + shine(122,98,.8), 'Polished benchtop'),
      fail: pv(bench + path('M30 96 Q60 70 90 96', 'none', 3, DIRT, ' opacity=".55"') + path('M70 70 Q96 52 120 74', 'none', 3, DIRT, ' opacity=".55"') + dots([[40,44],[52,45],[66,43],[100,44],[112,45],[120,43]], DIRT, 2.2), 'Smeared benchtop') },
    pftoilet: { k:'Toilet base', ok:'Base, bolt caps and the floor behind all clean', no:'A dust or hair line around the base',
      pass: pv(toiletB + shine(126,96) + shine(30,60,.7), 'Clean toilet base'),
      fail: pv(toiletB + path('M48 112 Q80 106 112 112', 'none', 5, DIRT, ' opacity=".6"') + path('M50 108 q4 -6 8 0 M96 108 q4 -6 8 0 M70 110 q5 -4 10 0', 'none', 1.5, D) + dots([[30,110],[132,109],[126,111],[22,111]], DIRT, 2), 'Dusty toilet base') },
    pfgrout: { k:'Grout', ok:'Even colour along every line', no:'Dark lines, or lines left in corners',
      pass: pv(tiles('#D9D3CC') + shine(128,24), 'Clean grout'),
      fail: pv(tiles('#7A6A58') + path('M14 120 L146 120', 'none', 5, '#6B5B49') + path('M14 92 Q30 96 47 92', 'none', 3, '#5E7A52', ' opacity=".6"'), 'Dirty grout') },
    pfbed: { k:'Bed finish', ok:'Cover taut and straight, pillows plumped', no:'Wrinkles, a crooked cover, flat pillows',
      pass: pv(bedBase + path('M30 84 L144 84 L144 96 L30 96', W) + path('M32 60 Q34 50 52 50 L68 52 Q78 56 76 70 Q74 80 56 82 L38 82 Q30 76 32 60 Z', W) + path('M58 62 Q66 58 72 66', 'none', 1.5) + shine(132,58), 'Neat bed'),
      fail: pv(bedBase + path('M30 84 Q60 78 90 86 Q116 92 146 82 L150 102 Q120 96 96 104 Q60 96 30 100 Z', W) + path('M60 88 L74 94 M100 92 L116 96 M120 88 L132 92', 'none', 1.5) + path('M36 76 Q38 70 56 70 L70 72 Q78 74 76 80 L40 84 Q34 82 36 76 Z', W, 2, D, ' transform="rotate(-8 56 77)"'), 'Messy bed') },
    pfcarpet: { k:'Vacuum lines', ok:'Even, straight lines edge to edge, walking out the door', no:'Patchy lines, missed edges, footprints',
      pass: pv(carpet + [10,38,66,94,122].map(function(x,i){ return '<rect x="'+x+'" y="10" width="28" height="110" fill="'+(i%2?'rgba(255,255,255,.55)':'rgba(26,26,26,.06)')+'"/>'; }).join('') + rect(10,10,140,110,'none',4), 'Even vacuum lines'),
      fail: pv(carpet + '<rect x="30" y="26" width="26" height="60" fill="rgba(255,255,255,.55)" transform="rotate(14 43 56)"/><rect x="78" y="40" width="26" height="74" fill="rgba(26,26,26,.06)" transform="rotate(-10 91 77)"/>' + [[118,30],[128,52],[116,74],[126,96]].map(function(p,i){ return '<ellipse cx="'+p[0]+'" cy="'+p[1]+'" rx="5" ry="8" fill="'+DIRT+'" opacity=".55" transform="rotate('+(i%2?10:-10)+' '+p[0]+' '+p[1]+')"/>'; }).join('') + dots([[16,114],[22,116],[14,104]], DIRT, 2.5), 'Patchy vacuum lines') },
    pfskirt: { k:'Skirting boards', ok:'Top edge and corners wiped clean', no:'A dust line along the top, fluff in the corner',
      pass: pv(skirt + shine(60,72,.8), 'Clean skirting'),
      fail: pv(skirt + path('M0 82 L118 82', 'none', 3, DIRT) + path('M120 82 L160 82', 'none', 3, DIRT) + '<circle cx="118" cy="92" r="6" fill="'+DIRT+'" opacity=".7"/>' + path('M114 88 q3 -5 7 1', 'none', 1.5), 'Dusty skirting') },
    pftowel: { k:'Towels', ok:'Ends level, folded edges to the wall, no hems showing', no:'Uneven ends, hems or labels on show',
      pass: pv(rail + rect(56,22,48,100,W,2) + line(56,32,104,32,false,F) + line(48,124,112,124,true,A) + shine(124,60), 'Level towel'),
      fail: pv(rail + '<polygon points="56,22 104,22 110,110 58,122" fill="'+W+'" stroke="'+D+'" stroke-width="2" stroke-linejoin="round"/>' + path('M58 116 L108 104', 'none', 2, D, ' stroke-dasharray="3 3"') + rect(92,82,10,14,G,1), 'Uneven towel') },
    pfoven: { k:'Oven door glass', ok:'You can see right through it', no:'A brown haze or drips baked on',
      pass: pv(ovenDoor + path('M44 44 L66 40', 'none', 3, '#fff', ' opacity=".7"') + shine(120,48,.8), 'Clear oven glass'),
      fail: pv(ovenDoor + '<rect x="30" y="34" width="100" height="62" rx="4" fill="#8A5A2E" opacity=".55"/>' + path('M50 34 L50 60 M70 34 L72 52 M104 34 L104 66', 'none', 4, '#6B4220', ' opacity=".7"'), 'Dirty oven glass') },
    pfcushion: { k:'Cushions', ok:'Plumped, upright, spaced evenly', no:'Squashed, slumped or crooked',
      pass: pv(couch + path('M24 44 Q22 26 40 26 L60 28 Q70 30 68 48 Q68 66 50 68 L34 68 Q24 64 24 44 Z', W) + path('M92 44 Q90 26 108 26 L128 28 Q138 30 136 48 Q136 66 118 68 L102 68 Q92 64 92 44 Z', W) + path('M46 30 L46 40 M114 30 L114 40', 'none', 1.5) + shine(80,22,.8), 'Plumped cushions'),
      fail: pv(couch + path('M22 66 Q22 52 42 50 L64 54 Q72 58 68 70 L30 74 Q22 72 22 66 Z', W, 2, D, ' transform="rotate(-14 46 62)"') + path('M98 54 Q98 40 116 40 L132 42 Q140 46 138 58 Q136 70 120 72 L104 72 Q98 66 98 54 Z', W, 2, D, ' transform="rotate(22 118 56)"'), 'Slumped cushions') }
  };

  // ───────────── Easy-to-miss maps ─────────────
  // A simple drawing of the room with numbered dots. The numbers match the
  // guide's "spots" list, which Jack edits.
  function mv(body, label){ return '<svg viewBox="0 0 320 200" role="img" aria-label="'+label+'" xmlns="http://www.w3.org/2000/svg">'+body+'</svg>'; }
  function dot(n,x,y){ return '<g class="hd" data-d="'+n+'"><circle class="hr" cx="'+x+'" cy="'+y+'" r="16" fill="'+A+'" opacity="0"/><circle cx="'+x+'" cy="'+y+'" r="10.5" fill="'+A+'" stroke="#fff" stroke-width="2.5"/><text x="'+x+'" y="'+(y+4.5)+'" text-anchor="middle" font-size="12.5" font-weight="700" fill="#fff" font-family="Inter,sans-serif">'+n+'</text></g>'; }
  var floor = line(4,186,316,186);

  var M_ = {
    mkitchen: mv(floor +
      rect(18,22,90,48,W,3) + line(63,22,63,70) + line(56,58,56,64,false,D) + line(70,58,70,64,false,D) +
      rect(172,22,76,48,W,3) + line(210,22,210,70) + line(203,58,203,64) + line(217,58,217,64) +
      '<rect x="130" y="8" width="20" height="30" fill="'+F+'" stroke="'+D+'" stroke-width="2"/><polygon points="118,38 162,38 170,64 110,64" fill="'+F+'" stroke="'+D+'" stroke-width="2" stroke-linejoin="round"/>' +
      rect(14,108,240,9,F,2) + rect(112,103,56,5,D,1) + '<ellipse cx="126" cy="102" rx="7" ry="2" fill="'+D+'"/><ellipse cx="154" cy="102" rx="7" ry="2" fill="'+D+'"/>' +
      path('M188 108 L190 116 L232 116 L234 108', 'none', 2, D, ' stroke-dasharray="4 3"') +
      path('M224 108 L224 86 Q224 80 218 80 L208 80 L208 88', 'none', 4, CHROME) + path('M224 108 L224 86 Q224 80 218 80 L208 80 L208 88', 'none', 1.5) + rect(219,104,10,5,CHROME,1) +
      rect(16,117,236,58,W,0) + line(75,117,75,175) + line(134,117,134,175) + line(193,117,193,175) + [45,104,163,222].map(function(x){ return line(x-8,128,x+8,128); }).join('') +
      rect(16,175,236,11,F,0) +
      rect(262,30,52,156,'#E3E6E9',4) + line(262,82,314,82) + line(270,92,270,132) + line(270,48,270,72) + path('M266 34 L266 182', 'none', 1.5, D, ' stroke-dasharray="3 3"') +
      dot(1,140,40) + dot(2,111,104) + dot(3,48,181) + dot(4,266,150) + dot(5,224,98), 'Kitchen: spots that get missed'),

    mbath: mv(floor +
      rect(16,26,108,160,GLASS,2) + '<rect x="16" y="26" width="108" height="7" fill="'+CHROME+'" stroke="'+D+'" stroke-width="2"/>' + line(70,33,70,186,false,D) + path('M34 46 L34 58 M28 58 L40 58', 'none', 3) + '<rect x="16" y="180" width="108" height="6" fill="'+F+'"/>' +
      rect(146,102,46,34,W,4) + rect(162,98,14,4,CHROME,1) + path('M142 136 L196 136 Q196 160 180 168 L182 186 L156 186 L158 168 Q142 160 142 136 Z', W) +
      rect(228,30,70,58,GLASS,3) + rect(220,118,92,7,F,1) + rect(226,125,80,61,W,2) + line(266,125,266,186) + line(258,150,258,160) + line(274,150,274,160) + '<ellipse cx="266" cy="118" rx="22" ry="3" fill="'+W+'" stroke="'+D+'" stroke-width="1.5"/>' +
      path('M266 116 L266 104 L256 104', 'none', 4, CHROME) + path('M266 116 L266 104 L256 104', 'none', 1.5) +
      dot(1,206,174) + dot(2,96,30) + dot(3,272,110) + dot(4,70,150), 'Bathroom: spots that get missed'),

    mtoilet: mv(floor + line(70,10,70,186) + '<rect x="10" y="10" width="60" height="176" fill="'+F+'" opacity=".5"/>' +
      rect(72,64,48,62,W,4) + rect(92,58,20,6,CHROME,1) +
      path('M108 126 L232 126 Q232 156 196 168 L194 186 L132 186 L134 168 Q108 156 108 136 Z', W) +
      path('M112 124 L236 124', 'none', 6, D) + path('M118 120 L124 72', 'none', 5, D) + '<circle cx="118" cy="122" r="5" fill="'+CHROME+'" stroke="'+D+'" stroke-width="2"/>' +
      path('M142 186 Q142 176 150 176 Q158 176 158 186 Z', CHROME) + path('M172 186 Q172 176 180 176 Q188 176 188 186 Z', CHROME) +
      dot(1,118,104) + dot(2,165,168) + dot(3,98,176), 'Toilet: spots that get missed'),

    mbed: mv(floor + line(4,10,316,10) +
      line(112,10,112,28) + '<ellipse cx="112" cy="31" rx="10" ry="5" fill="'+W+'" stroke="'+D+'" stroke-width="2"/>' + '<ellipse cx="72" cy="33" rx="32" ry="3.5" fill="'+F+'" stroke="'+D+'" stroke-width="2"/><ellipse cx="152" cy="33" rx="32" ry="3.5" fill="'+F+'" stroke="'+D+'" stroke-width="2"/>' +
      rect(230,40,4,146,F,0) + rect(290,40,4,146,F,0) + rect(230,36,64,4,F,0) +
      '<polygon points="234,40 262,52 262,192 234,186" fill="'+W+'" stroke="'+D+'" stroke-width="2" stroke-linejoin="round"/>' + '<circle cx="256" cy="118" r="2.5" fill="'+D+'"/>' +
      rect(20,104,12,82,F,2) + rect(32,134,150,22,W,4) + rect(34,156,146,16,F,2) + line(42,172,42,186) + line(172,172,172,186) +
      path('M38 120 Q40 112 56 112 L72 114 Q80 118 78 128 Q76 134 62 134 L44 134 Q36 130 38 120 Z', W) +
      rect(4,177,226,9,W,0) + rect(294,177,22,9,W,0) +
      dot(1,72,24) + dot(2,248,32) + dot(3,108,180) + dot(4,240,172), 'Bedroom: spots that get missed'),

    mliving: mv(floor +
      rect(18,104,124,34,F,10) + rect(24,134,58,20,W,6) + rect(82,134,58,20,W,6) + rect(10,118,14,46,F,6) + rect(136,118,14,46,F,6) + rect(18,154,124,14,F,4) + line(26,168,26,186) + line(134,168,134,186) +
      rect(152,148,72,32,W,3) + line(188,148,188,180) + line(158,180,158,186) + line(218,180,218,186) + rect(162,98,52,40,D,3) + rect(184,138,8,10,D,0) +
      line(232,146,258,146) + line(256,104,256,146) + line(234,146,234,186) + line(256,146,256,186) +
      rect(266,22,48,158,GLASS,2) + line(290,22,290,180) + '<rect x="262" y="180" width="54" height="6" fill="'+D+'"/>' +
      dot(1,82,136) + dot(2,219,144) + dot(3,245,174) + dot(4,290,178), 'Living room: spots that get missed'),

    mhall: mv(floor +
      '<polygon points="16,186 16,168 40,168 40,150 64,150 64,132 88,132 88,114 112,114 112,96 136,96 136,78 168,78 168,186" fill="'+F+'" stroke="'+D+'" stroke-width="2" stroke-linejoin="round"/>' +
      line(24,140,172,58,false,D) + line(36,162,36,134) + line(84,126,84,108) + line(132,90,132,72) +
      rect(214,32,72,154,F,0) + rect(220,38,60,148,W,2) + rect(236,54,28,40,GLASS,2) + '<circle cx="270" cy="122" r="3" fill="'+D+'"/>' +
      '<rect x="206" y="182" width="88" height="6" rx="2" fill="'+A+'" opacity=".5"/>' +
      dot(1,40,167) + dot(2,250,36) + dot(3,250,174), 'Hallway: spots that get missed'),

    mlaundry: mv(floor +
      rect(24,74,110,112,W,6) + line(24,92,134,92) + '<circle cx="40" cy="83" r="3" fill="'+D+'"/><circle cx="52" cy="83" r="3" fill="'+D+'"/>' + rect(100,79,24,8,F,2) +
      '<circle cx="79" cy="140" r="32" fill="'+CHROME+'" stroke="'+D+'" stroke-width="2"/><circle cx="79" cy="140" r="23" fill="'+GLASS+'" stroke="'+D+'" stroke-width="2"/>' +
      rect(144,74,110,112,W,6) + line(144,92,254,92) + '<circle cx="160" cy="83" r="3" fill="'+D+'"/>' +
      '<circle cx="199" cy="140" r="32" fill="'+F+'" stroke="'+D+'" stroke-width="2"/>' + rect(184,156,30,8,W,2) +
      rect(264,96,46,8,F,1) + rect(268,104,38,82,W,2) + path('M287 96 L287 82 L278 82', 'none', 3, CHROME) +
      dot(1,199,160) + dot(2,79,108) + dot(3,139,176), 'Laundry: spots that get missed')
  };

  // ───────────── Science drawings (guide hero pictures) ─────────────
  function hv(body,label){ return '<svg viewBox="0 0 320 190" role="img" aria-label="'+label+'" xmlns="http://www.w3.org/2000/svg" font-family="Inter,-apple-system,sans-serif">'+body+'</svg>'; }
  function tx(x,y,t,o){ o=o||{}; return '<text x="'+x+'" y="'+y+'" font-size="'+(o.s||11)+'" font-weight="'+(o.w||500)+'" fill="'+(o.c||D)+'" text-anchor="'+(o.a||'middle')+'">'+t+'</text>'; }
  var PHC=['#B8412E','#C8553D','#D4693A','#DE8537','#E6A236','#E9BF3C','#C9C64A','#8FB55A','#5FA36B','#4C9A86','#3F8DA0','#3D7DB0','#4569B4','#5558AE','#62489F'];
  var phBar='', x0=20, cw=280/15;
  for (var pi=0; pi<15; pi++) phBar+='<rect x="'+(x0+pi*cw).toFixed(1)+'" y="58" width="'+(cw+.5).toFixed(1)+'" height="30" fill="'+PHC[pi]+'"/>'+tx((x0+pi*cw+cw/2).toFixed(1),77,pi,{c:'#fff',s:10.5,w:600});
  function phx(v){ return (x0+v*cw+cw/2).toFixed(1); }
  function mark(v,label,row){ var x=phx(v), y=row?150:118; return '<path d="M'+x+' 92 L'+x+' '+(y-12)+'" stroke="'+D+'" stroke-width="1.2" stroke-dasharray="2 3"/><circle cx="'+x+'" cy="'+(y-12)+'" r="3" fill="'+D+'"/>'+tx(x,y,label,{s:10.5}); }
  var H_ = {
    phscale: hv(
      '<rect x="20" y="58" width="280" height="30" rx="8" fill="none"/>' + '<clipPath id="phc"><rect x="20" y="58" width="280" height="30" rx="8"/></clipPath><g clip-path="url(#phc)">'+phBar+'</g>' +
      tx(20,30,'ACID',{a:'start',w:700,s:11.5,c:'#B8412E'}) + tx(160,30,'NEUTRAL',{w:700,s:11.5,c:'#5FA36B'}) + tx(300,30,'ALKALINE',{a:'end',w:700,s:11.5,c:'#5558AE'}) +
      tx(20,46,'← stronger',{a:'start',s:10,c:'var(--body)'}) + tx(300,46,'stronger →',{a:'end',s:10,c:'var(--body)'}) +
      mark(2.5,'Vinegar',0) + mark(8.3,'Bicarb',0) + mark(12.5,'Bleach',0) + mark(7,'Water',1) +
      tx(160,182,'Each step is 10× stronger than the one next to it',{s:10.5,c:'var(--body)'}), 'The pH scale from 0, strong acid, to 14, strong alkaline, with 7 neutral'),
    phsoil: hv(
      [[0,'ACID','#B8412E','Limescale','Water spots','Soap scum','Rust'],[1,'NEUTRAL','#5FA36B','Dust','Fingerprints','Light dirt','Daily wipes'],[2,'ALKALINE','#5558AE','Grease','Burnt food','Body oils','Hand marks']].map(function(c){ var x=10+c[0]*102;
        return '<rect x="'+x+'" y="10" width="96" height="170" rx="12" fill="'+W+'" stroke="'+F+'" stroke-width="2"/><rect x="'+x+'" y="10" width="96" height="34" rx="12" fill="'+c[2]+'"/><rect x="'+x+'" y="32" width="96" height="12" fill="'+c[2]+'"/>' +
          tx(x+48,32,c[1],{c:'#fff',w:700,s:11.5}) + tx(x+48,62,'Lifts',{s:10,c:'var(--body)'}) + [3,4,5,6].map(function(k,i){ return '<circle cx="'+(x+12)+'" cy="'+(84+i*26)+'" r="3" fill="'+c[2]+'"/>'+tx(x+20,88+i*26,c[k],{a:'start',s:10.5}); }).join(''); }).join(''),
      'Which mess each type lifts: acid for minerals, neutral for everyday dirt, alkaline for grease'),
    sinner: hv(
      '<circle cx="110" cy="95" r="80" fill="'+F+'"/>' +
      '<path d="M110 95 L110 15 A80 80 0 0 1 190 95 Z" fill="'+A+'"/><path d="M110 95 L190 95 A80 80 0 0 1 110 175 Z" fill="'+G+'"/><path d="M110 95 L110 175 A80 80 0 0 1 30 95 Z" fill="'+D+'"/><path d="M110 95 L30 95 A80 80 0 0 1 110 15 Z" fill="'+W+'" stroke="'+F+'" stroke-width="2"/>' +
      tx(140,58,'Chemistry',{c:'#fff',w:600}) + tx(140,72,'the product',{c:'#fff',s:9.5}) + tx(140,124,'Time',{w:600}) + tx(140,138,'dwell',{s:9.5}) +
      tx(80,124,'Scrubbing',{c:'#fff',w:600}) + tx(80,138,'agitation',{c:'#fff',s:9.5}) + tx(80,58,'Heat',{w:600}) + tx(80,72,'warm water',{s:9.5}) +
      tx(206,70,'Less of one?',{a:'start',w:600,s:12}) + tx(206,88,'Add more of',{a:'start',s:11}) + tx(206,103,'another.',{a:'start',s:11}) + tx(206,128,'Gentle product?',{a:'start',s:10,c:'var(--body)'}) + tx(206,142,'Give it more time.',{a:'start',s:10,c:'var(--body)'}),
      'Four things that clean: chemistry, time, heat and scrubbing. Less of one needs more of another'),
    dilute: hv(
      [[0,'Too weak','Dirt stays',0.25],[1,'Label rate','Clean, no residue',0.55],[2,'Too strong','Sticky, streaky film',0.95]].map(function(c){ var x=20+c[0]*100, h=110*c[3];
        return '<path d="M'+(x+14)+' 30 h52 v118 a8 8 0 0 1 -8 8 h-36 a8 8 0 0 1 -8 -8 z" fill="'+W+'" stroke="'+D+'" stroke-width="2"/>' +
          '<rect x="'+(x+16)+'" y="'+(154-h).toFixed(0)+'" width="48" height="'+h.toFixed(0)+'" rx="6" fill="'+A+'" opacity="'+(0.25+c[3]*0.7).toFixed(2)+'"/>' +
          tx(x+40,172,c[1],{w:600}) + tx(x+40,186,c[2],{s:9.5,c:'var(--body)'}) + (c[0]===1?spark(x+70,30):''); }).join(''),
      'Dilution: too weak leaves dirt, the label rate cleans, too strong leaves a sticky film')
  };
  for (var hk in H_) A_[hk] = H_[hk];
  for (var pk in P_) A_[pk] = P_[pk].pass;
  for (var mk in M_) A_[mk] = M_[mk];

  window.TKART = {
    get: function(k){ return A_[k] || ''; },
    keys: Object.keys(A_),
    pair: function(k){ return P_[k] || null; },
    pairs: Object.keys(P_),
    map: function(k){ return M_[k] || ''; },
    maps: Object.keys(M_),
    heroes: Object.keys(H_)
  };
})();
