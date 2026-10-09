// Room checklists for each service type. One list per room; each item says which
// services it applies to:
//   a = every clean, d = deep, pre-sale and bond, r = regular only,
//   p = pre-sale only, b = bond only.
// Top to bottom, the way the team works the room (high to low, dry then wet).
(function(){
  var C = {
    'Kitchen': [
      ['k_tidy','Benches cleared, dishes into sink or dishwasher','a'],
      ['k_high','Cobwebs and high spots dusted','a'],
      ['k_hood','Rangehood outside wiped, no grease film','a'],
      ['k_filt','Rangehood filters degreased','d'],
      ['k_splash','Splashback and wall tiles wiped, grout clean','a'],
      ['k_cook','Cooktop degreased, knobs and edges clean','a'],
      ['k_oven','Oven inside, racks, trays and door glass','d'],
      ['k_micro','Microwave inside and out','a'],
      ['k_fronts','Cupboard and drawer fronts and handles wiped','a'],
      ['k_inside','Inside cupboards and drawers wiped out','d'],
      ['k_fridge','Fridge outside and handles','a'],
      ['k_fridgein','Fridge and freezer inside (if left in the property)','b'],
      ['k_dish','Dishwasher filter, door and seals','d'],
      ['k_bench','Benchtops cleaned and buffed dry, no streaks','a'],
      ['k_sink','Sink and tapware descaled and polished dry','a'],
      ['k_switch','Light switches, power points and light fittings','d'],
      ['k_kick','Kickboards and skirting','d'],
      ['k_style','Benches clear and styled for photos','p'],
      ['k_bin','Bin emptied and wiped','a'],
      ['k_floor','Floor vacuumed and mopped, edges and corners done','a']
    ],
    'Bathrooms': [
      ['b_prep','Surfaces cleared, fan on or window open, problem areas pre-treated','a'],
      ['b_high','Exhaust fan cover, cobwebs and high spots','a'],
      ['b_walls','Shower walls and grout, no soap scum','a'],
      ['b_glass','Shower glass streak-free, frame and tracks clean','a'],
      ['b_grout','Grout and silicone detailed, mould treated','d'],
      ['b_bath','Bath, taps and overflow descaled','a'],
      ['b_toilet','Toilet: cistern, seat, hinges, under rim and base','a'],
      ['b_vanity','Vanity, basin and tapware polished dry','a'],
      ['b_inside','Inside vanity cupboards and drawers','d'],
      ['b_mirror','Mirror streak-free','a'],
      ['b_fix','Doors, frames, switches and towel rails','d'],
      ['b_skirt','Skirting','d'],
      ['b_style','Towels hung neatly, surfaces clear for photos','p'],
      ['b_floor','Floor mopped dry, corners and behind the toilet','a'],
      ['b_final','Final check: fixtures dry, no streaks, no slip hazard, smells fresh','a']
    ],
    'Bedrooms': [
      ['r_high','Cobwebs, fans and light fittings dusted','a'],
      ['r_beds','Beds made (linen changed if requested)','r'],
      ['r_surf','Bedsides, dressers and shelves dusted','a'],
      ['r_mirror','Mirrors and glass streak-free','a'],
      ['r_robe','Wardrobes: shelves, rails, drawers and door tracks','d'],
      ['r_walls','Walls spot-cleaned: marks and scuffs','d'],
      ['r_doors','Doors, frames, handles, switches and power points','d'],
      ['r_vents','Blinds and air-con vents dusted','d'],
      ['r_skirt','Skirting','d'],
      ['r_style','Beds made neatly and styled for photos','p'],
      ['r_floor','Floor vacuumed incl. under beds and edges, hard floors mopped','a']
    ],
    'Living & dining': [
      ['l_tidy','Tidy: cushions and throws straightened','r'],
      ['l_high','Cobwebs, fans and light fittings','a'],
      ['l_surf','Shelves, TV unit, table and chairs dusted and wiped','a'],
      ['l_glass','Glass and mirrors streak-free','a'],
      ['l_walls','Walls spot-cleaned','d'],
      ['l_doors','Doors, frames, switches and power points','d'],
      ['l_vents','Blinds and air-con vents dusted','d'],
      ['l_under','Under and behind furniture that can be moved','d'],
      ['l_skirt','Skirting','d'],
      ['l_style','Cushions plumped, surfaces clear, room ready for photos','p'],
      ['l_floor','Floors vacuumed and mopped, edges done','a']
    ],
    'Laundry': [
      ['n_tub','Tub and tapware descaled and polished','a'],
      ['n_bench','Bench and cupboard fronts wiped','a'],
      ['n_inside','Inside cupboards','d'],
      ['n_mach','Washer and dryer outsides, dryer lint filter cleared','a'],
      ['n_drawer','Washing machine detergent drawer and door seal','d'],
      ['n_behind','Behind and between machines where reachable','d'],
      ['n_floor','Floor vacuumed and mopped','a']
    ],
    'Windows & tracks': [
      ['w_glass','Inside glass streak-free','a'],
      ['w_sills','Sills and frames wiped','a'],
      ['w_slide','Sliding door glass both sides','a'],
      ['w_tracks','Window and door tracks vacuumed and wiped out','d'],
      ['w_screens','Fly screens dusted or washed','d'],
      ['w_out','Outside glass within safe reach','d']
    ],
    'Outdoor & garage': [
      ['o_entry','Front door, handle, step and doormat','a'],
      ['o_cobweb','Cobwebs on eaves, doors and outdoor lights','a'],
      ['o_deck','Balcony or patio swept and mopped','a'],
      ['o_furn','Outdoor furniture wiped','a'],
      ['o_street','Street appeal check: entry path, letterbox, nothing left out','p'],
      ['o_garage','Garage swept and cobwebs cleared','d']
    ]
  };
  var NAMES = { regular:'Regular clean', deep:'Deep clean', presale:'Pre-sale clean', bond:'Bond clean' };
  function kindOf(service){
    var s = String(service||'').toLowerCase();
    if (/bond|end of lease|end-of-lease|vacate|move.?out/.test(s)) return 'bond';
    if (/pre.?sale|presale|open home|listing/.test(s)) return 'presale';
    if (/deep|spring|detail/.test(s)) return 'deep';
    return 'regular';
  }
  function applies(code, kind){
    if (code === 'a') return true;
    if (code === 'd') return kind !== 'regular';
    if (code === 'r') return kind === 'regular';
    if (code === 'p') return kind === 'presale';
    if (code === 'b') return kind === 'bond';
    return false;
  }
  // Items for one room on one job.
  function itemsFor(room, service){
    var k = kindOf(service);
    return (C[room] || []).filter(function(i){ return applies(i[2], k); }).map(function(i){ return { id:i[0], t:i[1] }; });
  }
  window.CHECKLISTS = { itemsFor:itemsFor, kindOf:kindOf, name:function(service){ return NAMES[kindOf(service)]; } };
})();
