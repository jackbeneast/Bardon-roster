// Bardon Clean icons and illustrations, shared across the hub, the team app
// and the client pages. One drawing style: 24px line icons on a 1.75 stroke,
// and larger two-tone spot illustrations in the brand palette.
//
//   BCART.icon('kitchen')            line icon, inherits the text colour
//   BCART.icon('kitchen', 28)        at a set size
//   BCART.badge('kitchen')           icon in a soft rounded square
//   BCART.area('Main bathroom')      picks the right area icon from a name
//   BCART.section('safety')          icon for a Toolkit section
//   BCART.service('Pre-sale clean')  icon for a service
//   BCART.spot('allclear')           spot illustration (empty states, headers)
(function(){
  // Works on every page: team app tokens first, then client page tokens, then plain hex.
  var TC='var(--tcd,var(--terracotta-dark,#A55830))', DK='var(--dark,#1A1A1A)', CR='var(--cd,var(--cream-dark,#EDE6DE))',
      CM='var(--cream,#F5F0EB)', GD='var(--gold,#F4B942)', WH='#fff', WA='#CFE0E8';

  var P = {
    // ── Areas ──
    kitchen:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16"/><rect x="7.5" y="12" width="9" height="6" rx="1"/><path d="M8 6h.01M12 6h.01M16 6h.01"/>',
    bath:'<path d="M3 12h18v2.5a5.5 5.5 0 0 1-5.5 5.5h-7A5.5 5.5 0 0 1 3 14.5z"/><path d="M6 12V6a2 2 0 0 1 4 0"/><path d="M7 20l-1 1.5M17 20l1 1.5"/>',
    shower:'<path d="M5 21V7a4 4 0 0 1 8 0"/><path d="M10 7h6"/><path d="M11 11v1M14 11v1M17 11v1M12.5 14v1M15.5 14v1M14 17v1"/>',
    toilet:'<rect x="6" y="3" width="9" height="6" rx="1.5"/><path d="M4 9h15a7 6 0 0 1-6.5 6H10A6 6 0 0 1 4 9z"/><path d="M8.5 15L8 21h7l-.5-6"/>',
    bed:'<path d="M3 19V6"/><path d="M3 14h18v5"/><rect x="5" y="9.5" width="5" height="4.5" rx="1.2"/><path d="M11 14v-4h7a3 3 0 0 1 3 3v1"/>',
    living:'<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M5 18v2M19 18v2"/>',
    dining:'<path d="M3 10h18"/><path d="M5 10v10M19 10v10"/><path d="M8 4v3a2 2 0 0 0 4 0V4M10 7v3M16 4c-1.5 1-2 2.5-2 4h2V4z"/>',
    study:'<rect x="5" y="4.5" width="14" height="10" rx="1.2"/><path d="M2.5 19.5h19L19 14.5H5z"/>',
    hall:'<path d="M3 3l6 5v8l-6 5M21 3l-6 5v8l6 5"/><path d="M9 8h6v8H9z"/><path d="M12 16v-3"/>',
    door:'<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M4 21h16"/><path d="M14.5 12h.01"/>',
    laundry:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 7.5h16"/><circle cx="12" cy="14" r="4.5"/><path d="M7.5 5.3h.01M10 5.3h.01"/><path d="M9.5 14.5c1.2-1 3.8 1 5 0"/>',
    outdoor:'<path d="M7.5 15h9l-1.2 6H8.7z"/><path d="M12 15V9"/><path d="M12 11.5C8.5 11.5 6.5 9 6.5 5.5 10 5.5 12 8 12 11.5z"/><path d="M12 9c0-3.5 2-6 5.5-6 0 3.5-2 6-5.5 6z"/>',
    garage:'<path d="M3 9.5L12 4l9 5.5V21H3z"/><path d="M7 21v-8h10v8M7 16h10M7 18.5h10"/>',
    window:'<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/><path d="M7 6l2-.01M7 8.5l3.5-3.5"/>',
    stairs:'<path d="M3 20h5v-4h4v-4h4V8h5"/><path d="M3 20h18"/>',
    pantry:'<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 9h14M5 15h14"/><rect x="8" y="5" width="3" height="4"/><rect x="13" y="11" width="3" height="4"/>',
    // ── Services ──
    regular:'<path d="M20 12a8 8 0 1 1-2.35-5.65"/><path d="M20 4v5h-5"/><path d="M9 12l2 2 4-4"/>',
    deep:'<rect x="4" y="11" width="16" height="5" rx="1.5"/><path d="M7 16v3.5M10 16v3.5M14 16v3.5M17 16v3.5"/><path d="M9 11V6.5a3 3 0 0 1 6 0V11"/>',
    presale:'<path d="M6 21V3.5"/><path d="M4 21h4"/><rect x="6" y="6" width="13" height="7.5" rx="1"/><path d="M9.5 9.75h6"/>',
    bond:'<circle cx="8" cy="15.5" r="4.5"/><path d="M11.2 12.3L20 3.5"/><path d="M16.5 7l2.5 2.5M14.5 9l2 2"/>',
    // ── Toolkit sections and everyday things ──
    rooms:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M12 21v-7M3 14h9"/>',
    star:'<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M8.5 12l1.5 1.5 3-3M8.5 17h7"/>',
    layers:'<path d="M12 3.5l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    bucket:'<path d="M5 9h14l-1.6 11a1 1 0 0 1-1 .9H7.6a1 1 0 0 1-1-.9z"/><path d="M4 9h16"/><path d="M6.5 9a5.5 5 0 0 1 11 0"/>',
    tag:'<path d="M3 12.5V4a1 1 0 0 1 1-1h8.5L21 11.5 12.5 20z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    team:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.6 3.5-5.5 6.5-5.5s5.5 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.7.8 2.9 2.5 3.5 5.2"/>',
    shield:'<path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    alert:'<path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    flask:'<path d="M9 3h6"/><path d="M10 3v6.2L5.2 17.8A2.2 2.2 0 0 0 7.1 21h9.8a2.2 2.2 0 0 0 1.9-3.2L14 9.2V3"/><path d="M7.4 15h9.2"/>',
    spray:'<path d="M8 10h6.5l1 2.5V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-7.5z"/><path d="M9 10V7h4.5v3"/><path d="M8.5 7V4.5h6l1.5 1.5"/><path d="M19 4.5h.01M19 7.5h.01M21 6h.01M19 10h.01"/>',
    sparkle:'<path d="M11 3l1.7 4.8L17.5 9.5l-4.8 1.7L11 16l-1.7-4.8L4.5 9.5l4.8-1.7z"/><path d="M18 14l.8 1.9 1.9.8-1.9.8L18 19.4l-.8-1.9-1.9-.8 1.9-.8z"/>',
    drop:'<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    cloth:'<path d="M4 6.5c2.7-1.8 5.3 1.8 8 0s5.3 1.8 8 0V18c-2.7 1.8-5.3-1.8-8 0s-5.3-1.8-8 0z"/><path d="M8 10.5c1.3.7 2.7.7 4 0M12 13.5c1.3.7 2.7.7 4 0"/>',
    sponge:'<rect x="3.5" y="8" width="17" height="9" rx="2.5"/><path d="M3.5 12h17"/><path d="M7 14.6h.01M10.5 15h.01M14 14.6h.01M17.5 15h.01"/>',
    gloves:'<path d="M8 21v-5.5L5.2 11a1.5 1.5 0 0 1 2.4-1.8L9 11V5a1.5 1.5 0 0 1 3 0v5M12 9.5V4a1.5 1.5 0 0 1 3 0v6M15 9V5.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-2 4.5V21"/>',
    vacuum:'<path d="M8 3v12"/><path d="M8 15c0 2 1.3 3 3 3h3"/><rect x="13" y="15" width="8" height="5" rx="2.5"/><path d="M4 21h8"/><path d="M8 21v-3"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    timer:'<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M10 2.5h4M12 2.5V6M18.5 6.5l1.5-1.5"/>',
    calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/>',
    key:'<circle cx="8" cy="15.5" r="4.5"/><path d="M11.2 12.3L20 3.5"/><path d="M16.5 7l2.5 2.5M14.5 9l2 2"/>',
    camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    chat:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    heart:'<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    leaf:'<path d="M5 19C5 10 10 5 20 4c-.5 9.5-5.5 15-14 15z"/><path d="M5 19c3.5-4.5 6.5-7.5 10-10"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9.5"/>',
    home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    pin:'<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    car:'<path d="M5 16V11.5L7 6.5h10l2 5V16"/><path d="M3.5 16h17v3H3.5z"/><path d="M5 11.5h14"/><path d="M7 19v1.5M17 19v1.5"/>',
    paw:'<circle cx="7" cy="10" r="1.8"/><circle cx="10.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12.5 12c-3 0-5.5 3.5-5.5 5.5 0 1.8 1.5 2.5 3 2.2 1-.2 1.7-.5 2.5-.5s1.5.3 2.5.5c1.5.3 3-.4 3-2.2 0-2-2.5-5.5-5.5-5.5z"/>',
    wall:'<rect x="3.5" y="4" width="17" height="16" rx="1"/><path d="M3.5 9.3h17M3.5 14.7h17M9 4v5.3M15 4v5.3M6.5 9.3v5.4M12 9.3v5.4M17.5 9.3v5.4M9 14.7V20M15 14.7V20"/>',
    oven:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16"/><rect x="7" y="11" width="10" height="7" rx="1"/><path d="M7.5 5.5h.01M10.5 5.5h.01"/>',
    fridge:'<rect x="5.5" y="2.5" width="13" height="19" rx="2"/><path d="M5.5 10h13M8.5 5.5v2M8.5 12.5v3"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    bolt:'<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    ladder:'<path d="M7 21L9.5 3M17 21L14.5 3"/><path d="M8.7 8h6.6M8 13h8M7.3 18h9.4"/>',
    receipt:'<path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.2z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
    money:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
    send:'<path d="M21 3L3 10.5l7 2.5 2.5 7z"/><path d="M10 13l11-10"/>',
    video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/>',
    flag:'<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
    eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    ph:'<path d="M3.5 18.5h17"/><path d="M5 18.5V14M9 18.5V11M12 18.5V8M15 18.5V11M19 18.5V14"/><path d="M12 3.5l-1.5 2h3z"/>'
  };
  // Aliases so a name from anywhere in the hub finds its icon.
  var ALIAS = { ensuite:'bath', bathroom:'bath', powder:'toilet', wc:'toilet', bedroom:'bed', lounge:'living', office:'study', hallway:'hall', entry:'door',
    balcony:'outdoor', deck:'outdoor', patio:'outdoor', windows:'window', glass:'window', premium:'star', tasks:'clipboard', surfaces:'layers',
    kit:'bucket', services:'tag', how:'team', safety:'shield', wrong:'alert', science:'flask', products:'spray', tracks:'window' };

  function icon(name, size, sw){
    var k = P[name] ? name : (ALIAS[name] || 'sparkle'), s = size || 20;
    return '<svg class="bci" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(sw||1.75)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+P[k]+'</svg>';
  }
  function badge(name, size, tone){
    var s = size || 40, bg = tone==='dark' ? DK : tone==='gold' ? GD : CM, fg = tone==='dark' ? GD : TC;
    return '<span class="bcb" aria-hidden="true" style="width:'+s+'px;height:'+s+'px;border-radius:'+Math.round(s*0.3)+'px;background:'+bg+';color:'+fg+';display:inline-flex;align-items:center;justify-content:center;flex:none">'+icon(name, Math.round(s*0.52))+'</span>';
  }
  function areaKey(n){
    n = String(n||'').toLowerCase();
    var R = [[/powder|toilet|\bwc\b|loo/,'toilet'],[/ensuite|bath|shower/,'bath'],[/kitchen|kitchenette|scullery/,'kitchen'],[/pantry/,'pantry'],[/laundry/,'laundry'],
      [/bed|nursery|guest|kids/,'bed'],[/dining/,'dining'],[/living|lounge|family|rumpus|media|theatre/,'living'],[/study|office/,'study'],
      [/stair/,'stairs'],[/hall|landing|corridor/,'hall'],[/entry|foyer|front door/,'door'],[/balcony|deck|patio|veranda|alfresco|outdoor|courtyard|yard/,'outdoor'],
      [/garage|carport/,'garage'],[/window|glass|track/,'window'],[/wall/,'wall'],[/oven/,'oven'],[/fridge/,'fridge']];
    for (var i=0;i<R.length;i++) if (R[i][0].test(n)) return R[i][1];
    return 'sparkle';
  }
  function serviceKey(n){
    n = String(n||'').toLowerCase();
    if (/pre.?sale|sale|listing|open home/.test(n)) return 'presale';
    if (/bond|end.?of.?lease|vacate|move.?out/.test(n)) return 'bond';
    if (/deep|spring|detail/.test(n)) return 'deep';
    if (/regular|maint|weekly|fortnight|recurring|standard/.test(n)) return 'regular';
    return 'sparkle';
  }

  // ── Spot illustrations: two-tone, 160 × 120 ──
  function sv(body, label){ return '<svg class="bcs" viewBox="0 0 160 120" role="img" aria-label="'+label+'" xmlns="http://www.w3.org/2000/svg">'+body+'</svg>'; }
  var o = ' stroke="'+DK+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
  function blob(){ return '<path d="M30 70c-6-30 18-52 50-52s58 18 52 48-26 40-56 38-40-8-46-34z" fill="'+CR+'"/>'; }
  function star4(x,y,r,f){ r=r||8; return '<path d="M'+x+' '+(y-r)+'L'+(x+r*.28)+' '+(y-r*.28)+'L'+(x+r)+' '+y+'L'+(x+r*.28)+' '+(y+r*.28)+'L'+x+' '+(y+r)+'L'+(x-r*.28)+' '+(y+r*.28)+'L'+(x-r)+' '+y+'L'+(x-r*.28)+' '+(y-r*.28)+'z" fill="'+(f||GD)+'"/>'; }
  var S = {
    spray: sv(blob() +
      '<path d="M66 54h26l5 12v38a4 4 0 0 1-4 4H65a4 4 0 0 1-4-4V66z" fill="'+WH+'"'+o+'/><rect x="65" y="74" width="28" height="18" rx="3" fill="'+TC+'"/>' +
      '<path d="M70 54V40h18v14" fill="'+CM+'"'+o+'/><path d="M66 40V30h30l8 6" fill="'+WH+'"'+o+'/><path d="M80 40v-6" '+o+' fill="none"/>' +
      '<circle cx="114" cy="30" r="2.5" fill="'+TC+'"/><circle cx="121" cy="38" r="2" fill="'+TC+'"/><circle cx="118" cy="22" r="2" fill="'+TC+'"/><circle cx="126" cy="28" r="1.6" fill="'+TC+'"/>' +
      star4(40,40,9) + star4(126,82,7), 'Spray bottle with sparkles'),
    home: sv(blob() +
      '<path d="M40 64l40-32 40 32v42H40z" fill="'+WH+'"'+o+'/><path d="M32 68l48-40 48 40" fill="none"'+o+'/>' +
      '<rect x="70" y="80" width="20" height="26" rx="2" fill="'+TC+'"/><rect x="50" y="72" width="14" height="14" rx="2" fill="'+WA+'"'+o+'/><rect x="96" y="72" width="14" height="14" rx="2" fill="'+WA+'"'+o+'/>' +
      '<circle cx="86" cy="94" r="1.8" fill="'+GD+'"/>' + star4(124,40,9) + star4(36,46,6) + star4(132,96,5), 'A fresh, clean home'),
    bucket: sv(blob() +
      '<path d="M52 58a28 24 0 0 1 56 0" fill="none"'+o+'/><path d="M46 58h68l-7 46a4 4 0 0 1-4 3.4H57a4 4 0 0 1-4-3.4z" fill="'+TC+'"'+o+'/>' +
      '<path d="M44 58h72" '+o+' fill="none"/><path d="M60 58c4-8 14-12 22-6 6-6 16-4 18 6" fill="'+WA+'"'+o+'/>' +
      '<path d="M100 26l12 30" '+o+' fill="none"/><rect x="104" y="18" width="10" height="12" rx="3" transform="rotate(-22 109 24)" fill="'+GD+'"'+o+'/>' +
      star4(34,40,7) + star4(130,74,7), 'Bucket, cloth and brush'),
    keys: sv(blob() +
      '<circle cx="62" cy="70" r="18" fill="'+GD+'"'+o+'/><circle cx="62" cy="70" r="6" fill="'+CR+'"'+o+'/>' +
      '<path d="M76 58l40-30M106 36l8 9M98 42l7 8" fill="none"'+o+'/>' +
      '<rect x="88" y="66" width="30" height="20" rx="4" fill="'+WH+'"'+o+'/><path d="M94 76h18" fill="none" stroke="'+TC+'" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M80 70c4 0 6 4 8 6" fill="none"'+o+'/>' + star4(128,30,7) + star4(40,40,6), 'Keys and tag ready for handover'),
    allclear: sv(blob() +
      '<rect x="52" y="26" width="56" height="78" rx="6" fill="'+WH+'"'+o+'/><rect x="66" y="20" width="28" height="12" rx="3" fill="'+TC+'"'+o+'/>' +
      '<path d="M63 52l4 4 8-8M63 70l4 4 8-8M63 88l4 4 8-8" fill="none" stroke="'+TC+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M82 52h16M82 70h16M82 88h12" fill="none" stroke="'+CR+'" stroke-width="4" stroke-linecap="round"/>' +
      star4(122,40,9) + star4(38,84,6), 'Clipboard with everything ticked'),
    calendar: sv(blob() +
      '<rect x="44" y="32" width="72" height="68" rx="8" fill="'+WH+'"'+o+'/><path d="M44 50h72" '+o+'/><rect x="44" y="32" width="72" height="18" rx="8" fill="'+TC+'"/>' +
      '<path d="M60 26v12M100 26v12" '+o+'/>' +
      '<circle cx="62" cy="66" r="3" fill="'+CR+'"/><circle cx="80" cy="66" r="3" fill="'+CR+'"/><circle cx="98" cy="66" r="3" fill="'+CR+'"/><circle cx="62" cy="84" r="3" fill="'+CR+'"/>' +
      '<circle cx="80" cy="84" r="9" fill="'+GD+'"/><path d="M76 84l3 3 5-6" fill="none" stroke="'+DK+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      star4(128,36,7), 'Calendar with a booked day'),
    beaker: sv(blob() +
      '<path d="M68 24h24M71 24v26l-22 40a6 6 0 0 0 5.3 9h51.4a6 6 0 0 0 5.3-9L89 50V24" fill="'+WH+'"'+o+'/>' +
      '<path d="M58 78h44l9 16a3 3 0 0 1-2.6 4.5H51.6A3 3 0 0 1 49 94z" fill="'+TC+'"/>' +
      '<circle cx="72" cy="88" r="3" fill="'+WH+'" opacity=".7"/><circle cx="86" cy="84" r="2" fill="'+WH+'" opacity=".7"/>' +
      '<path d="M114 30s10 10 10 18a10 10 0 0 1-20 0c0-8 10-18 10-18z" fill="'+WA+'"'+o+'/>' + star4(40,44,7), 'Beaker and drop: the science of clean'),
    team: sv(blob() +
      '<circle cx="62" cy="48" r="13" fill="'+GD+'"'+o+'/><path d="M38 104c2-20 12-30 24-30s22 10 24 30z" fill="'+TC+'"'+o+'/>' +
      '<circle cx="100" cy="52" r="11" fill="'+CM+'"'+o+'/><path d="M80 104c2-17 10-25 20-25s18 8 20 25z" fill="'+WH+'"'+o+'/>' +
      star4(128,34,7) + star4(36,30,5), 'Two team members'),
    sparkle: sv(blob() + star4(80,62,34,TC) + star4(118,32,10) + star4(42,88,8) + star4(124,92,6), 'Sparkle'),
    shield: sv(blob() +
      '<path d="M80 22l34 13v24c0 22-15 36-34 42-19-6-34-20-34-42V35z" fill="'+WH+'"'+o+'/><path d="M80 34l22 8v17c0 14-9 23-22 28z" fill="'+TC+'"/>' +
      '<path d="M66 62l9 9 18-18" fill="none" stroke="'+DK+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' + star4(126,34,7), 'Shield: covered and safe'),
    message: sv(blob() +
      '<path d="M42 34h64a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6H66l-16 14V80h-8a6 6 0 0 1-6-6V40a6 6 0 0 1 6-6z" fill="'+WH+'"'+o+'/>' +
      '<path d="M52 50h44M52 62h30" fill="none" stroke="'+CR+'" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="114" cy="78" r="14" fill="'+TC+'"'+o+'/><path d="M108 78l4 4 8-8" fill="none" stroke="'+WH+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' + star4(126,30,7), 'Message sent'),
    camera: sv(blob() +
      '<path d="M44 46h16l6-10h28l6 10h16v50H44z" fill="'+WH+'"'+o+'/><circle cx="80" cy="70" r="16" fill="'+WA+'"'+o+'/><circle cx="80" cy="70" r="7" fill="'+TC+'"/>' +
      '<rect x="102" y="52" width="8" height="5" rx="1.5" fill="'+GD+'"/>' + star4(128,32,7) + star4(36,96,6), 'Camera for before and after photos')
  };

  window.BCART = {
    icon: icon, badge: badge,
    area: function(n, size){ return icon(areaKey(n), size); }, areaKey: areaKey,
    service: function(n, size){ return icon(serviceKey(n), size); }, serviceKey: serviceKey,
    section: function(id, size){ return icon(id, size); },
    spot: function(k){ return S[k] || S.sparkle; },
    icons: Object.keys(P), spots: Object.keys(S)
  };
})();
