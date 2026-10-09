// Room checklists for each service type. One action per item, so a new starter
// can follow them without being told. Grouped in the order the team works the
// room: prep, high to low, dry before wet, floor last.
// Each item's code says which services it applies to (any letter matches):
//   a = every clean, d = deep, pre-sale and bond, r = regular,
//   p = pre-sale, b = bond.
(function(){
  var C = {
    'Kitchen': [
      ['Prep', [
        ['k_clear','Clear everything off the benchtops','a'],
        ['k_dishes','Wash or load any dishes left in the sink','r'],
        ['k_vent','Turn on the rangehood fan or open a window','a'],
        ['k_ovtreat','Spray the oven with oven cleaner and leave it to soak','d'],
        ['k_filtsoak','Take out the rangehood filters and soak them in hot degreaser','d'],
        ['k_mwsteam','Heat a bowl of water in the microwave for 3 minutes to loosen grime','a']
      ]],
      ['Up high', [
        ['k_cobweb','Cobwebs from the ceiling corners','a'],
        ['k_light','Ceiling light fittings dusted','a'],
        ['k_cuptop','Tops of the overhead cupboards wiped','d']
      ]],
      ['Rangehood', [
        ['k_hoodtop','Rangehood canopy and top degreased','a'],
        ['k_hoodfront','Rangehood front and buttons','a'],
        ['k_hoodunder','Rangehood underside around the filters','a'],
        ['k_hoodlight','Rangehood light covers','d'],
        ['k_hoodfilt','Filters scrubbed, rinsed, dried and put back','d']
      ]],
      ['Splashback and walls', [
        ['k_splash','Splashback wiped top to bottom','a'],
        ['k_splgrout','Splashback grout lines scrubbed','d'],
        ['k_power','Power points along the bench','a'],
        ['k_switch','Light switches','a'],
        ['k_walls','Walls spot-cleaned for marks and splashes','d']
      ]],
      ['Overhead cupboards', [
        ['k_ohfront','Overhead cupboard doors, outside','a'],
        ['k_ohhandle','Overhead cupboard handles','a'],
        ['k_ohedge','Overhead door edges and hinges','d'],
        ['k_ohin','Overhead cupboards inside: every shelf wiped','d']
      ]],
      ['Cooktop', [
        ['k_ckgrate','Gas grates or trivets lifted off and scrubbed','a'],
        ['k_ckburn','Gas burner caps and rings scrubbed','a'],
        ['k_cksurf','Cooktop surface degreased','a'],
        ['k_ckglass','Glass or induction top polished streak-free','a'],
        ['k_ckknob','Control knobs and dials','a'],
        ['k_ckedge','Cooktop edges and the gap to the bench','d']
      ]],
      ['Oven', [
        ['k_ovdoor','Oven door outside and handle','a'],
        ['k_ovctrl','Oven control panel and display','a'],
        ['k_ovglass','Oven door inside glass','d'],
        ['k_ovpane','Between the door glass panes, if they come apart','pb'],
        ['k_ovin','Oven inside: roof, walls and floor wiped out','d'],
        ['k_ovrack','Oven racks scrubbed','d'],
        ['k_ovtray','Oven trays scrubbed','d'],
        ['k_ovseal','Oven door seal wiped','d'],
        ['k_ovdraw','Drawer under the oven, inside and out','d']
      ]],
      ['Microwave', [
        ['k_mwin','Microwave inside: roof, walls and floor','a'],
        ['k_mwplate','Turntable plate washed','a'],
        ['k_mwdoor','Microwave door inside and out','a'],
        ['k_mwctrl','Microwave buttons and handle','a'],
        ['k_mwtop','Microwave top and sides','d']
      ]],
      ['Fridge', [
        ['k_frdoor','Fridge doors outside, streak-free','a'],
        ['k_frhand','Fridge handles','a'],
        ['k_frtop','Fridge top','d'],
        ['k_frseal','Fridge door seals','d'],
        ['k_frshelf','Fridge shelves and walls inside (if empty)','pb'],
        ['k_frcrisp','Fridge crisper drawers (if empty)','pb'],
        ['k_frz','Freezer inside (if empty)','b']
      ]],
      ['Dishwasher', [
        ['k_dwfront','Dishwasher front and controls','a'],
        ['k_dwedge','Dishwasher door edges and seal','d'],
        ['k_dwfilt','Dishwasher filter taken out and rinsed','d'],
        ['k_dwin','Dishwasher inside walls and racks','b']
      ]],
      ['Lower cupboards and drawers', [
        ['k_lofront','Lower cupboard doors, outside','a'],
        ['k_drfront','Drawer fronts','a'],
        ['k_lohand','Lower cupboard and drawer handles','a'],
        ['k_loin','Lower cupboards inside: every shelf wiped','d'],
        ['k_drin','Drawers inside: crumbs out, wiped','d'],
        ['k_usink','Under-sink cupboard','d'],
        ['k_pantdoor','Pantry door and handle','a'],
        ['k_pantin','Pantry shelves wiped (if empty)','pb']
      ]],
      ['Benchtops', [
        ['k_appl','Kettle, toaster and coffee machine wiped and put back','r'],
        ['k_bench','Benchtops wiped with the right product for the surface','a'],
        ['k_bnchback','Back edge where the bench meets the splashback','a'],
        ['k_bnchedge','Bench front edges','a'],
        ['k_bnchbuff','Benchtops buffed dry, no streaks','a']
      ]],
      ['Sink', [
        ['k_sink','Sink bowls scrubbed','a'],
        ['k_plug','Plug holes and drain covers','a'],
        ['k_drainer','Drainer and sink edges','a'],
        ['k_tapbase','Tap descaled around the base and spout','a'],
        ['k_tapdry','Tap polished dry','a'],
        ['k_sinkdry','Sink buffed dry, no water spots','a']
      ]],
      ['Floor and finish', [
        ['k_bin','Bin emptied and new liner in','a'],
        ['k_binwash','Bin washed inside and out','d'],
        ['k_kick','Kickboards wiped','d'],
        ['k_skirt','Skirting boards wiped','d'],
        ['k_door','Door, frame and handle','d'],
        ['k_vac','Floor vacuumed, including edges and under the kickboards','a'],
        ['k_mop','Floor mopped, working back toward the door','a'],
        ['k_style','Benches clear and styled for photos','p'],
        ['k_final','Final look from the doorway: no streaks, smears or crumbs','a']
      ]]
    ],

    'Bathrooms': [
      ['Prep', [
        ['b_clear','Take every product and item off the surfaces','a'],
        ['b_vent','Exhaust fan on or window open','a'],
        ['b_bin','Bin emptied and new liner in','a'],
        ['b_mats','Bath mats and used towels out of the room','a'],
        ['b_spray','Spray shower walls, glass and bath, leave to soak','a'],
        ['b_tgel','Toilet cleaner under the rim, leave to soak','a']
      ]],
      ['Up high', [
        ['b_cobweb','Cobwebs from the ceiling corners','a'],
        ['b_fan','Exhaust fan cover dusted','a'],
        ['b_fanwash','Exhaust fan cover taken down and washed','d'],
        ['b_light','Light fittings','a'],
        ['b_ceil','Ceiling above the shower checked and treated for mould','d']
      ]],
      ['Shower', [
        ['b_shwall','Shower walls scrubbed top to bottom','a'],
        ['b_shgrout','Shower grout lines scrubbed','a'],
        ['b_shniche','Shower niche and shelves','a'],
        ['b_shhead','Shower head descaled','a'],
        ['b_shmix','Shower mixer, rail and fittings','a'],
        ['b_shglin','Shower glass, inside','a'],
        ['b_shglout','Shower glass, outside','a'],
        ['b_shframe','Shower screen frame and seals','a'],
        ['b_shtrack','Shower screen track and bottom seal','d'],
        ['b_shdoor','Shower door handle and hinges','a'],
        ['b_shfloor','Shower floor scrubbed','a'],
        ['b_shdrain','Shower drain: hair out, cover cleaned','a'],
        ['b_shsil','Silicone joins treated for mould','d'],
        ['b_shrinse','Shower rinsed down','a'],
        ['b_shsqueeg','Glass squeegeed and buffed streak-free','a']
      ]],
      ['Bath', [
        ['b_bathin','Bath inside scrubbed','a'],
        ['b_bathrim','Bath rim and ledge','a'],
        ['b_bathtap','Bath tap and spout descaled','a'],
        ['b_bathplug','Bath plug and overflow','a'],
        ['b_bathside','Bath front panel','a'],
        ['b_bathdry','Bath rinsed and dried','a']
      ]],
      ['Toilet (clean to dirty)', [
        ['b_tcis','Cistern top and flush button','a'],
        ['b_tcisf','Cistern front and sides','a'],
        ['b_tlid','Lid, top','a'],
        ['b_tlidu','Lid, underside','a'],
        ['b_tseat','Seat, top','a'],
        ['b_tseatu','Seat, underside','a'],
        ['b_thinge','Seat hinges and bolts','a'],
        ['b_tbowl','Bowl scrubbed, including under the rim','a'],
        ['b_tout','Bowl outside','a'],
        ['b_tbase','Base and pedestal','a'],
        ['b_tpipe','Water pipe and tap behind the toilet','a'],
        ['b_tfloor','Floor and wall behind the toilet','a'],
        ['b_troll','Toilet roll holder','a'],
        ['b_gloves','Change gloves before moving on','a']
      ]],
      ['Vanity', [
        ['b_mirror','Mirror wiped streak-free','a'],
        ['b_mirredge','Mirror edges and frame','a'],
        ['b_cabin','Mirror cabinet shelves inside','d'],
        ['b_basin','Basin scrubbed','a'],
        ['b_bplug','Basin plug and overflow hole','a'],
        ['b_vtap','Vanity tap descaled at the base','a'],
        ['b_vtapdry','Vanity tap polished dry','a'],
        ['b_vtop','Vanity top wiped and dried','a'],
        ['b_vfront','Vanity doors and drawer fronts','a'],
        ['b_vhand','Vanity handles','a'],
        ['b_vin','Vanity cupboards and drawers inside','d'],
        ['b_vkick','Vanity kickboard','a']
      ]],
      ['Fittings and walls', [
        ['b_rail','Towel rails and hooks','a'],
        ['b_switch','Light switches and power points','a'],
        ['b_tiles','Wall tiles outside the shower spot-cleaned','a'],
        ['b_window','Window glass and sill','a'],
        ['b_heat','Heat lamps or wall heater','d'],
        ['b_door','Door, both sides','d'],
        ['b_dframe','Door frame and handle','a'],
        ['b_skirt','Skirting or skirting tiles','d']
      ]],
      ['Floor and finish', [
        ['b_vac','Floor vacuumed or swept, hair out of the corners','a'],
        ['b_fgrout','Floor grout scrubbed','d'],
        ['b_mop','Floor mopped, corners and behind the door','a'],
        ['b_fdry','Floor dry, no slip hazard','a'],
        ['b_return','Products put back neatly','r'],
        ['b_towels','Fresh towels hung neatly','rp'],
        ['b_style','Surfaces clear and styled for photos','p'],
        ['b_fglass','Final check: glass and mirrors streak-free','a'],
        ['b_ftap','Final check: tapware dry and shining','a'],
        ['b_smell','Final check: smells fresh','a']
      ]]
    ],

    'Bedrooms': [
      ['Prep', [
        ['r_open','Open blinds or curtains for light','a'],
        ['r_tidy','Items on surfaces placed neatly','r'],
        ['r_strip','Bed stripped (if changing linen)','r']
      ]],
      ['Up high', [
        ['r_cobweb','Cobwebs from the ceiling corners','a'],
        ['r_fan','Ceiling fan blades','a'],
        ['r_light','Light fittings','a'],
        ['r_aircon','Air-con unit and vents','a'],
        ['r_robetop','Top of the wardrobe','d']
      ]],
      ['Wardrobe', [
        ['r_robedoor','Wardrobe doors, outside','a'],
        ['r_robemirr','Wardrobe mirror doors streak-free','a'],
        ['r_robetrack','Wardrobe door tracks vacuumed','d'],
        ['r_robeshelf','Wardrobe shelves wiped','d'],
        ['r_roberail','Wardrobe hanging rails','d'],
        ['r_robedraw','Wardrobe drawers inside','d'],
        ['r_robefloor','Wardrobe floor vacuumed','d']
      ]],
      ['Furniture', [
        ['r_bedhead','Bed head dusted','a'],
        ['r_bedside','Bedside tables','a'],
        ['r_lamp','Lamps and shades','a'],
        ['r_dresser','Dresser top','a'],
        ['r_drawfront','Dresser drawer fronts and handles','a'],
        ['r_shelves','Shelves and ornaments','a'],
        ['r_mirror','Mirrors streak-free','a'],
        ['r_bedmake','Bed made: corners tucked, pillows straight','r'],
        ['r_bedstyle','Bed styled for photos','p']
      ]],
      ['Walls and fittings', [
        ['r_switch','Light switches','a'],
        ['r_power','Power points','d'],
        ['r_walls','Walls spot-cleaned for marks and scuffs','d'],
        ['r_handle','Door handle','a'],
        ['r_door','Door, both sides','d'],
        ['r_dframe','Door frame','d'],
        ['r_sill','Window sill and frame','a'],
        ['r_blinds','Blind slats dusted','d'],
        ['r_skirt','Skirting boards','d']
      ]],
      ['Floor', [
        ['r_underbed','Under the bed vacuumed','a'],
        ['r_edges','Edges and corners with the crevice tool','a'],
        ['r_vac','Floor vacuumed, working back toward the door','a'],
        ['r_mop','Hard floors mopped','a'],
        ['r_final','Final look from the doorway','a']
      ]]
    ],

    'Living & dining': [
      ['Prep', [
        ['l_open','Open blinds for light','a'],
        ['l_tidy','Cushions, throws and remotes tidied','r']
      ]],
      ['Up high', [
        ['l_cobweb','Cobwebs from the ceiling corners','a'],
        ['l_fan','Ceiling fan blades','a'],
        ['l_light','Light fittings and pendants','a'],
        ['l_aircon','Air-con unit and vents','a'],
        ['l_frames','Picture frames dusted','a'],
        ['l_tops','Tops of tall shelves and cabinets','d']
      ]],
      ['Furniture', [
        ['l_tv','TV screen dusted with a dry microfibre','a'],
        ['l_tvunit','TV unit top and front','a'],
        ['l_tvback','Behind the TV unit and the cables','d'],
        ['l_shelves','Shelves and ornaments','a'],
        ['l_coffee','Coffee table','a'],
        ['l_side','Side tables','a'],
        ['l_lamps','Lamps and shades','a'],
        ['l_glass','Glass tabletops and mirrors streak-free','a'],
        ['l_table','Dining table top','a'],
        ['l_tlegs','Dining table legs','d'],
        ['l_chairs','Dining chair seats and backs','a'],
        ['l_clegs','Dining chair legs','d'],
        ['l_sofa','Sofa vacuumed, including the crevices','d'],
        ['l_cush','Under the sofa cushions','d']
      ]],
      ['Walls and fittings', [
        ['l_switch','Light switches','a'],
        ['l_power','Power points','d'],
        ['l_walls','Walls spot-cleaned','d'],
        ['l_handles','Door handles','a'],
        ['l_doors','Doors, both sides','d'],
        ['l_dframe','Door frames','d'],
        ['l_sills','Window sills and frames','a'],
        ['l_blinds','Blind slats','d'],
        ['l_skirt','Skirting boards','d']
      ]],
      ['Floor and finish', [
        ['l_under','Under and behind furniture that can be moved','d'],
        ['l_rug','Rugs vacuumed','a'],
        ['l_edges','Edges and corners with the crevice tool','a'],
        ['l_vac','Floor vacuumed','a'],
        ['l_mop','Hard floors mopped, working toward the exit','a'],
        ['l_style','Cushions plumped, surfaces clear, room ready for photos','p'],
        ['l_final','Final look from the doorway','a']
      ]]
    ],

    'Laundry': [
      ['Up high', [
        ['n_cobweb','Cobwebs and light fitting','a'],
        ['n_ohfront','Overhead cupboards, outside','a'],
        ['n_ohin','Overhead cupboards inside','d']
      ]],
      ['Machines', [
        ['n_wmtop','Washing machine top and lid','a'],
        ['n_wmfront','Washing machine front and controls','a'],
        ['n_wmdraw','Detergent drawer taken out and washed','d'],
        ['n_wmseal','Door seal or lid rim','d'],
        ['n_dryer','Dryer front and top','a'],
        ['n_lint','Dryer lint filter emptied','a'],
        ['n_behind','Behind and between the machines','d']
      ]],
      ['Tub and bench', [
        ['n_tub','Tub scrubbed','a'],
        ['n_tubtap','Tub tap descaled and polished dry','a'],
        ['n_bench','Bench wiped','a'],
        ['n_lofront','Lower cupboard doors and handles','a'],
        ['n_loin','Lower cupboards inside','d']
      ]],
      ['Floor and finish', [
        ['n_switch','Switches and power points','a'],
        ['n_door','Door and frame','d'],
        ['n_skirt','Skirting','d'],
        ['n_vac','Floor vacuumed','a'],
        ['n_mop','Floor mopped','a']
      ]]
    ],

    'Windows & tracks': [
      ['Windows', [
        ['w_cobweb','Cobwebs on the window frames','a'],
        ['w_glassin','Inside glass streak-free','a'],
        ['w_frame','Frames wiped','a'],
        ['w_sill','Sills wiped','a'],
        ['w_latch','Locks and latches','a'],
        ['w_glassout','Outside glass within safe reach','d']
      ]],
      ['Sliding doors', [
        ['w_slin','Sliding door glass, inside','a'],
        ['w_slout','Sliding door glass, outside','a'],
        ['w_slhand','Sliding door handles','a']
      ]],
      ['Tracks and screens', [
        ['w_wtrack','Window tracks vacuumed','d'],
        ['w_wtwipe','Window tracks wiped out','d'],
        ['w_dtrack','Sliding door tracks vacuumed and wiped','d'],
        ['w_screen','Fly screens dusted','d'],
        ['w_scwash','Fly screens washed','pb']
      ]],
      ['Finish', [
        ['w_final','Final check in daylight for streaks','a']
      ]]
    ],

    'Outdoor & garage': [
      ['Entry', [
        ['o_cobweb','Cobwebs on the eaves and around the door','a'],
        ['o_lights','Outdoor lights wiped','a'],
        ['o_fdoor','Front door, outside','a'],
        ['o_fhand','Front door handle and lock','a'],
        ['o_bell','Doorbell and house number','p'],
        ['o_step','Front step swept','a'],
        ['o_mat','Doormat shaken out','a']
      ]],
      ['Balcony or patio', [
        ['o_furn','Outdoor furniture wiped','a'],
        ['o_rail','Balcony railings wiped','a'],
        ['o_balglass','Balustrade glass','d'],
        ['o_sweep','Balcony or patio swept','a'],
        ['o_mop','Balcony or patio mopped','a']
      ]],
      ['Street appeal', [
        ['o_path','Entry path swept','p'],
        ['o_letter','Letterbox wiped','p'],
        ['o_street','Nothing left out in view of the street','p']
      ]],
      ['Garage', [
        ['o_gcob','Garage cobwebs','d'],
        ['o_gdoor','Garage door, inside','d'],
        ['o_gsweep','Garage floor swept','d']
      ]]
    ],

    'Pantry': [
      ['Prep', [
        ['pa_light','Pantry light on','a'],
        ['pa_clear','Items off one shelf at a time (if full)','d'],
        ['pa_pests','Signs of pests noted and flagged to Jack','a']
      ]],
      ['Shelves', [
        ['pa_cobweb','Cobwebs from the corners','a'],
        ['pa_lightfit','Light fitting dusted','d'],
        ['pa_top','Top shelf wiped','a'],
        ['pa_shelves','Every shelf wiped, top to bottom','a'],
        ['pa_edges','Shelf front edges','a'],
        ['pa_walls','Pantry walls inside','d'],
        ['pa_drawers','Pantry drawers inside (if empty)','d'],
        ['pa_doorin','Pantry door, inside','d']
      ]],
      ['Outside and floor', [
        ['pa_doorout','Pantry door, outside','a'],
        ['pa_handle','Pantry door handle','a'],
        ['pa_track','Sliding door track (if sliding)','d'],
        ['pa_vac','Pantry floor vacuumed, corners included','a'],
        ['pa_mop','Pantry floor mopped','a'],
        ['pa_return','Items put back neatly, labels facing out','r'],
        ['pa_final','Final check: no crumbs on shelves','a']
      ]]
    ],

    'Powder room': [
      ['Prep', [
        ['pw_vent','Exhaust fan on or window open','a'],
        ['pw_clear','Hand towel and items off the vanity','a'],
        ['pw_bin','Bin emptied and new liner in','a'],
        ['pw_tgel','Toilet cleaner under the rim, leave to soak','a']
      ]],
      ['Up high', [
        ['pw_cobweb','Cobwebs from the ceiling corners','a'],
        ['pw_fan','Exhaust fan cover dusted','a'],
        ['pw_light','Light fitting','a']
      ]],
      ['Vanity', [
        ['pw_mirror','Mirror wiped streak-free','a'],
        ['pw_basin','Basin scrubbed','a'],
        ['pw_plug','Basin plug and overflow hole','a'],
        ['pw_tap','Tap descaled at the base','a'],
        ['pw_tapdry','Tap polished dry','a'],
        ['pw_vtop','Vanity top wiped and dried','a'],
        ['pw_vfront','Vanity doors and handles','a'],
        ['pw_vin','Vanity cupboard inside','d'],
        ['pw_vkick','Vanity kickboard','a']
      ]],
      ['Toilet (clean to dirty)', [
        ['pw_tcis','Cistern top and flush button','a'],
        ['pw_tcisf','Cistern front and sides','a'],
        ['pw_tlid','Lid, top','a'],
        ['pw_tlidu','Lid, underside','a'],
        ['pw_tseat','Seat, top','a'],
        ['pw_tseatu','Seat, underside','a'],
        ['pw_thinge','Seat hinges and bolts','a'],
        ['pw_tbowl','Bowl scrubbed, including under the rim','a'],
        ['pw_tout','Bowl outside','a'],
        ['pw_tbase','Base and pedestal','a'],
        ['pw_tpipe','Water pipe and tap behind the toilet','a'],
        ['pw_tfloor','Floor and wall behind the toilet','a'],
        ['pw_brush','Toilet brush holder','a'],
        ['pw_gloves','Change gloves before moving on','a']
      ]],
      ['Fittings and walls', [
        ['pw_rail','Hand towel rail or ring','a'],
        ['pw_roll','Toilet roll holder','a'],
        ['pw_switch','Light switch','a'],
        ['pw_tiles','Wall tiles spot-cleaned','a'],
        ['pw_door','Door, both sides','d'],
        ['pw_dframe','Door frame and handle','a'],
        ['pw_skirt','Skirting or skirting tiles','d']
      ]],
      ['Floor and finish', [
        ['pw_vac','Floor vacuumed, hair out of the corners','a'],
        ['pw_mop','Floor mopped, behind the toilet and door','a'],
        ['pw_towel','Fresh hand towel hung neatly','rp'],
        ['pw_final','Final check: mirror streak-free, tap dry, smells fresh','a']
      ]]
    ],

    'Toilet': [
      ['Prep', [
        ['wc_vent','Exhaust fan on or window open','a'],
        ['wc_bin','Bin emptied and new liner in','a'],
        ['wc_tgel','Toilet cleaner under the rim, leave to soak','a']
      ]],
      ['Up high', [
        ['wc_cobweb','Cobwebs from the ceiling corners','a'],
        ['wc_fan','Exhaust fan cover dusted','a'],
        ['wc_light','Light fitting','a'],
        ['wc_sill','Window sill and glass','a']
      ]],
      ['Toilet (clean to dirty)', [
        ['wc_tcis','Cistern top and flush button','a'],
        ['wc_tcisf','Cistern front and sides','a'],
        ['wc_tlid','Lid, top','a'],
        ['wc_tlidu','Lid, underside','a'],
        ['wc_tseat','Seat, top','a'],
        ['wc_tseatu','Seat, underside','a'],
        ['wc_thinge','Seat hinges and bolts','a'],
        ['wc_tbowl','Bowl scrubbed, including under the rim','a'],
        ['wc_tout','Bowl outside','a'],
        ['wc_tbase','Base and pedestal','a'],
        ['wc_tpipe','Water pipe and tap behind the toilet','a'],
        ['wc_brush','Toilet brush holder','a'],
        ['wc_gloves','Change gloves before moving on','a']
      ]],
      ['Fittings and walls', [
        ['wc_roll','Toilet roll holder','a'],
        ['wc_switch','Light switch','a'],
        ['wc_tiles','Wall tiles spot-cleaned','a'],
        ['wc_door','Door, both sides','d'],
        ['wc_dframe','Door frame and handle','a'],
        ['wc_skirt','Skirting or skirting tiles','d']
      ]],
      ['Floor and finish', [
        ['wc_vac','Floor vacuumed or swept','a'],
        ['wc_tfloor','Floor and wall behind the toilet','a'],
        ['wc_mop','Floor mopped, behind the door included','a'],
        ['wc_final','Final check: bowl, seat and behind the toilet','a']
      ]]
    ],

    'Living': [
      ['Prep', [
        ['lv_open','Open blinds for light','a'],
        ['lv_tidy','Cushions, throws and remotes tidied','r'],
        ['lv_bin','Rubbish collected and bin emptied','a']
      ]],
      ['Up high', [
        ['lv_cobweb','Cobwebs from the ceiling corners','a'],
        ['lv_fan','Ceiling fan blades','a'],
        ['lv_light','Light fittings','a'],
        ['lv_aircon','Air-con unit and vents','a'],
        ['lv_frames','Picture frames dusted','a'],
        ['lv_rail','Curtain rails and blind tops','d'],
        ['lv_tops','Tops of tall shelves and cabinets','d']
      ]],
      ['Furniture', [
        ['lv_tv','TV screen dusted with a dry microfibre','a'],
        ['lv_tvunit','TV unit top and front','a'],
        ['lv_tvback','Behind the TV unit and the cables (don\'t unplug)','d'],
        ['lv_shelves','Shelves and ornaments','a'],
        ['lv_coffee','Coffee table','a'],
        ['lv_side','Side tables','a'],
        ['lv_lamps','Lamps and shades','a'],
        ['lv_glass','Glass tabletops and mirrors streak-free','a'],
        ['lv_fire','Fireplace mantel and surround (if there is one)','d'],
        ['lv_sofa','Sofa vacuumed, including the crevices','d'],
        ['lv_cush','Under the sofa cushions','d']
      ]],
      ['Walls and fittings', [
        ['lv_switch','Light switches','a'],
        ['lv_power','Power points','d'],
        ['lv_walls','Walls spot-cleaned','d'],
        ['lv_handles','Door handles','a'],
        ['lv_doors','Doors, both sides','d'],
        ['lv_dframe','Door frames','d'],
        ['lv_sills','Window sills and frames','a'],
        ['lv_blinds','Blind slats','d'],
        ['lv_skirt','Skirting boards','d']
      ]],
      ['Floor and finish', [
        ['lv_under','Under and behind furniture that can be moved','d'],
        ['lv_rug','Rugs vacuumed','a'],
        ['lv_edges','Edges and corners with the crevice tool','a'],
        ['lv_vac','Floor vacuumed','a'],
        ['lv_mop','Hard floors mopped, working toward the exit','a'],
        ['lv_style','Cushions plumped, surfaces clear, room ready for photos','p'],
        ['lv_final','Final look from the doorway','a']
      ]]
    ],

    'Dining': [
      ['Prep', [
        ['dn_open','Open blinds for light','a'],
        ['dn_clear','Table cleared','a']
      ]],
      ['Up high', [
        ['dn_cobweb','Cobwebs from the ceiling corners','a'],
        ['dn_pendant','Pendant light over the table','a'],
        ['dn_fan','Ceiling fan blades','a'],
        ['dn_frames','Picture frames dusted','a']
      ]],
      ['Table and chairs', [
        ['dn_table','Table top','a'],
        ['dn_tedge','Table edges','a'],
        ['dn_tlegs','Table legs','d'],
        ['dn_seats','Chair seats','a'],
        ['dn_backs','Chair backs','a'],
        ['dn_clegs','Chair legs','d']
      ]],
      ['Storage', [
        ['dn_sbtop','Sideboard or buffet top','a'],
        ['dn_sbfront','Sideboard doors and handles','a'],
        ['dn_sbin','Sideboard inside (if empty)','pb'],
        ['dn_display','Display cabinet glass streak-free','a']
      ]],
      ['Walls and fittings', [
        ['dn_switch','Light switches','a'],
        ['dn_power','Power points','d'],
        ['dn_walls','Walls spot-cleaned','d'],
        ['dn_sills','Window sills and frames','a'],
        ['dn_blinds','Blind slats','d'],
        ['dn_skirt','Skirting boards','d']
      ]],
      ['Floor and finish', [
        ['dn_chairsout','Chairs pulled out from the table','a'],
        ['dn_under','Under the table vacuumed','a'],
        ['dn_edges','Edges and corners with the crevice tool','a'],
        ['dn_vac','Floor vacuumed','a'],
        ['dn_mop','Hard floors mopped','a'],
        ['dn_chairsin','Chairs pushed back in evenly','a'],
        ['dn_style','Table clear or styled for photos','p']
      ]]
    ],

    'Study': [
      ['Prep', [
        ['st_open','Open blinds for light','a'],
        ['st_bin','Bin emptied','a'],
        ['st_papers','Leave papers where they are: clean around them','a']
      ]],
      ['Up high', [
        ['st_cobweb','Cobwebs from the ceiling corners','a'],
        ['st_fan','Ceiling fan blades','a'],
        ['st_light','Light fittings','a'],
        ['st_aircon','Air-con unit and vents','a'],
        ['st_tops','Tops of bookshelves','d']
      ]],
      ['Desk and shelves', [
        ['st_desk','Clear areas of the desk top','a'],
        ['st_monitor','Monitor dusted with a dry microfibre','a'],
        ['st_cables','Around the computer and cables (don\'t unplug)','a'],
        ['st_draw','Desk drawer fronts and handles','a'],
        ['st_lamp','Desk lamp','a'],
        ['st_chair','Desk chair arms and base','a'],
        ['st_shelves','Bookshelf shelves','a'],
        ['st_filing','Filing cabinet front','a'],
        ['st_frames','Picture frames','a']
      ]],
      ['Walls and fittings', [
        ['st_switch','Light switches','a'],
        ['st_power','Power points','d'],
        ['st_walls','Walls spot-cleaned','d'],
        ['st_handle','Door handle','a'],
        ['st_door','Door, both sides','d'],
        ['st_sill','Window sill and frame','a'],
        ['st_blinds','Blind slats','d'],
        ['st_skirt','Skirting boards','d']
      ]],
      ['Floor', [
        ['st_under','Under the desk vacuumed','a'],
        ['st_edges','Edges and corners with the crevice tool','a'],
        ['st_vac','Floor vacuumed','a'],
        ['st_mop','Hard floors mopped','a'],
        ['st_final','Chair pushed in, nothing on the desk moved','a']
      ]]
    ],

    'Hallway & stairs': [
      ['Up high', [
        ['hs_cobweb','Cobwebs from the ceiling and stairwell','a'],
        ['hs_light','Light fittings','a'],
        ['hs_smoke','Smoke alarm dusted gently','d'],
        ['hs_frames','Picture frames dusted','a'],
        ['hs_dtops','Tops of door frames','d']
      ]],
      ['Hallway', [
        ['hs_table','Hall table','a'],
        ['hs_linen','Linen cupboard doors','a'],
        ['hs_linenin','Linen cupboard shelves (if empty)','pb'],
        ['hs_switch','Light switches','a'],
        ['hs_power','Power points','d'],
        ['hs_handles','Door handles','a'],
        ['hs_doors','Doors, both sides','d'],
        ['hs_walls','Walls spot-cleaned for scuffs','d']
      ]],
      ['Stairs', [
        ['hs_rail','Handrail wiped','a'],
        ['hs_posts','Balustrade posts and spindles','a'],
        ['hs_glass','Glass balustrade, both sides (if glass)','a'],
        ['hs_treads','Stair treads vacuumed, top to bottom','a'],
        ['hs_sedge','Stair edges with the crevice tool','a'],
        ['hs_risers','Stair risers wiped','d'],
        ['hs_smop','Hard stairs mopped, top to bottom','a']
      ]],
      ['Floor', [
        ['hs_skirt','Skirting boards','d'],
        ['hs_edges','Hallway edges with the crevice tool','a'],
        ['hs_vac','Hallway floor vacuumed','a'],
        ['hs_mop','Hard floors mopped','a']
      ]]
    ],

    'Entry': [
      ['Outside the door', [
        ['en_cobweb','Cobwebs around the porch and door frame','a'],
        ['en_light','Porch light wiped','a'],
        ['en_doorout','Front door, outside','a'],
        ['en_handle','Door handle and lock','a'],
        ['en_bell','Doorbell and house number','a'],
        ['en_side','Door glass or sidelights streak-free','a'],
        ['en_mat','Doormat shaken out','a'],
        ['en_step','Front step and porch swept','a']
      ]],
      ['Inside', [
        ['en_lightin','Light fitting dusted','a'],
        ['en_doorin','Front door, inside','a'],
        ['en_frame','Door frame','d'],
        ['en_thresh','Threshold','a'],
        ['en_mirror','Entry mirror streak-free','a'],
        ['en_console','Console table','a'],
        ['en_hooks','Key hooks','a'],
        ['en_shoe','Shoe cabinet','a'],
        ['en_switch','Light switches','a'],
        ['en_skirt','Skirting','d']
      ]],
      ['Floor', [
        ['en_vac','Entry floor vacuumed','a'],
        ['en_mop','Hard floor mopped','a'],
        ['en_matback','Doormat put back straight','a']
      ]]
    ],

    'Balcony': [
      ['Safety', [
        ['bc_safe','Never lean over the balustrade or stand on furniture','a']
      ]],
      ['Up high', [
        ['bc_cobweb','Cobwebs from the ceiling and corners','a'],
        ['bc_light','Outdoor light wiped','a'],
        ['bc_fan','Ceiling fan (if there is one)','a']
      ]],
      ['Rails and furniture', [
        ['bc_rail','Balustrade top rail','a'],
        ['bc_glassin','Balustrade glass, inside face','a'],
        ['bc_glassout','Balustrade glass, outside face within safe reach','d'],
        ['bc_table','Outdoor table','a'],
        ['bc_chairs','Outdoor chairs','a'],
        ['bc_cush','Outdoor cushions brushed off','a'],
        ['bc_pots','Around pot plants','a']
      ]],
      ['Door', [
        ['bc_slglass','Sliding door glass, outside','a'],
        ['bc_track','Sliding door track vacuumed and wiped','d']
      ]],
      ['Floor', [
        ['bc_sweep','Floor swept','a'],
        ['bc_drain','Leaves cleared from the drain','a'],
        ['bc_mop','Tiles mopped or scrubbed','a'],
        ['bc_style','Furniture set straight for photos','p']
      ]]
    ],

    'Deck': [
      ['Up high', [
        ['dk_cobweb','Cobwebs from the eaves and ceiling','a'],
        ['dk_light','Outdoor lights wiped','a'],
        ['dk_fan','Ceiling fan (if there is one)','a']
      ]],
      ['Rails and furniture', [
        ['dk_rail','Railings wiped','a'],
        ['dk_posts','Balustrade posts','d'],
        ['dk_glass','Balustrade glass within safe reach','a'],
        ['dk_table','Outdoor table','a'],
        ['dk_chairs','Outdoor chairs','a'],
        ['dk_cush','Outdoor cushions brushed off','a'],
        ['dk_bbq','BBQ outside and lid','a'],
        ['dk_bar','Outdoor bench or bar top','a']
      ]],
      ['Floor', [
        ['dk_sweep','Deck swept','a'],
        ['dk_gaps','Debris cleared from gaps between boards','d'],
        ['dk_steps','Deck steps swept','a'],
        ['dk_mop','Deck mopped or washed (no pressure washer unless the job notes say so)','d'],
        ['dk_style','Furniture set straight for photos','p']
      ]]
    ],

    'Patio': [
      ['Up high', [
        ['pt_cobweb','Cobwebs from the eaves and ceiling','a'],
        ['pt_light','Outdoor lights wiped','a'],
        ['pt_fan','Ceiling fan (if there is one)','a']
      ]],
      ['Furniture', [
        ['pt_table','Outdoor table','a'],
        ['pt_chairs','Outdoor chairs','a'],
        ['pt_cush','Outdoor cushions brushed off','a'],
        ['pt_bbq','BBQ outside and lid','a'],
        ['pt_bar','Outdoor bench or bar top','a'],
        ['pt_tap','Outdoor tap and surrounds','d']
      ]],
      ['Floor', [
        ['pt_sweep','Patio swept','a'],
        ['pt_edges','Patio edges and corners swept','a'],
        ['pt_drain','Leaves cleared from the drains','a'],
        ['pt_mop','Pavers or tiles mopped or scrubbed (no pressure washer unless the job notes say so)','d'],
        ['pt_style','Furniture set straight for photos','p']
      ]]
    ],

    'Garage': [
      ['Up high', [
        ['gr_cobweb','Cobwebs from the ceiling and corners','a'],
        ['gr_light','Light fittings dusted','a'],
        ['gr_tracks','Garage door tracks dusted','d']
      ]],
      ['Doors and fittings', [
        ['gr_door','Garage door, inside','a'],
        ['gr_indoor','Internal door, both sides','a'],
        ['gr_handle','Internal door handle','a'],
        ['gr_switch','Light switches and power points','a'],
        ['gr_shelves','Shelves (if empty)','d'],
        ['gr_bench','Bench top','a']
      ]],
      ['Floor', [
        ['gr_rubbish','Rubbish removed','a'],
        ['gr_sweep','Floor swept, back to front','a'],
        ['gr_edges','Corners and edges swept','a'],
        ['gr_oil','Oil stains spot-cleaned (if the job notes say so)','pb']
      ]]
    ],

    'Outdoor': [
      ['Safety', [
        ['od_safe','Ground level only: no ladders or roofs','a']
      ]],
      ['Around the house', [
        ['od_cobweb','Cobwebs from the eaves within reach','a'],
        ['od_lights','Outdoor lights within reach','a'],
        ['od_letter','Letterbox wiped','a'],
        ['od_gate','Side gate handles','a'],
        ['od_taps','Outdoor taps','d'],
        ['od_bins','Bin lids wiped','d'],
        ['od_binarea','Bin area swept','d']
      ]],
      ['Paths', [
        ['od_front','Front path swept','a'],
        ['od_side','Side paths swept','d'],
        ['od_drive','Driveway edges swept (if the job notes say so)','p'],
        ['od_drains','Leaves cleared from the drains','a'],
        ['od_street','Nothing left out in view of the street','p']
      ]]
    ],

    // Fallback for any area typed in that isn't matched below.
    '_general': [
      ['Up high', [
        ['g_cobweb','Cobwebs from the ceiling corners','a'],
        ['g_light','Light fittings','a'],
        ['g_fan','Ceiling fan blades','a']
      ]],
      ['Surfaces', [
        ['g_surf','All clear surfaces wiped','a'],
        ['g_frames','Picture frames dusted','a'],
        ['g_sill','Window sills and frames','a'],
        ['g_blinds','Blind slats','d']
      ]],
      ['Walls and fittings', [
        ['g_switch','Light switches','a'],
        ['g_power','Power points','d'],
        ['g_handle','Door handles','a'],
        ['g_walls','Walls spot-cleaned','d'],
        ['g_skirt','Skirting boards','d']
      ]],
      ['Floor', [
        ['g_edges','Edges and corners with the crevice tool','a'],
        ['g_vac','Floor vacuumed','a'],
        ['g_mop','Hard floors mopped','a']
      ]]
    ]
  };

  // Main bedroom = the bedroom list plus a walk-in robe after the wardrobe.
  C['Main bedroom'] = C['Bedrooms'].slice(0, 3).concat([
    ['Walk-in robe', [
      ['mr_light','Walk-in robe light fitting','a'],
      ['mr_shelf','Walk-in robe shelves (if empty)','d'],
      ['mr_rail','Walk-in robe hanging rails (if empty)','d'],
      ['mr_drawin','Walk-in robe drawers inside (if empty)','d'],
      ['mr_drawfront','Walk-in robe drawer fronts and handles','a'],
      ['mr_mirror','Walk-in robe mirrors streak-free','a'],
      ['mr_vac','Walk-in robe floor vacuumed','a']
    ]]
  ], C['Bedrooms'].slice(3));

  // Granny flat = kitchen, bathroom, bedroom and living, one after the other.
  C['Granny flat'] = [['Kitchen','Kitchen'],['Bathroom','Bathrooms'],['Bedroom','Bedrooms'],['Living','Living & dining']].reduce(function(all, p){
    return all.concat(C[p[1]].map(function(s){ return [p[0] + ': ' + s[0], s[1]]; }));
  }, []);

  // Areas that share a list, then keywords for anything typed in ("Bedroom 5", "Media room").
  var SAME = { 'Bathroom':'Bathrooms', 'Bathroom 2':'Bathrooms', 'Ensuite':'Bathrooms', 'Family room':'Living', 'Rumpus':'Living', 'Kitchenette':'Kitchen' };
  var KEYS = [
    [/powder/i,'Powder room'], [/toilet|\bwc\b/i,'Toilet'], [/ensuite|bath/i,'Bathrooms'],
    [/main|master/i,'Main bedroom'], [/bed|guest|nursery/i,'Bedrooms'],
    [/pantry/i,'Pantry'], [/kitchen/i,'Kitchen'], [/laundry/i,'Laundry'],
    [/living.*dining|dining.*living/i,'Living & dining'], [/dining/i,'Dining'],
    [/living|lounge|family|rumpus|media|theatre|games|sitting/i,'Living'], [/study|office/i,'Study'],
    [/hall|stair|landing/i,'Hallway & stairs'], [/entry|entrance|foyer/i,'Entry'], [/window|track/i,'Windows & tracks'],
    [/balcony/i,'Balcony'], [/deck|veranda/i,'Deck'], [/patio|alfresco|courtyard|pergola/i,'Patio'],
    [/garage|carport|shed/i,'Garage'], [/granny|studio|flat/i,'Granny flat'], [/outdoor|outside|yard|garden/i,'Outdoor']
  ];
  function listOf(room){
    var r = String(room||'').trim();
    if (C[r]) return C[r];
    if (SAME[r]) return C[SAME[r]];
    for (var i=0;i<KEYS.length;i++) if (KEYS[i][0].test(r)) return C[KEYS[i][1]];
    return r ? C['_general'] : [];
  }
  var NAMES ={ regular:'Regular clean', deep:'Deep clean', presale:'Pre-sale clean', bond:'Bond clean' };
  function kindOf(service){
    var s = String(service||'').toLowerCase();
    if (/bond|end of lease|end-of-lease|vacate|move.?out/.test(s)) return 'bond';
    if (/pre.?sale|presale|open home|listing/.test(s)) return 'presale';
    if (/deep|spring|detail/.test(s)) return 'deep';
    return 'regular';
  }
  function applies(code, kind){
    for (var i=0;i<code.length;i++){
      var c=code.charAt(i);
      if (c==='a') return true;
      if (c==='d' && kind!=='regular') return true;
      if (c==='r' && kind==='regular') return true;
      if (c==='p' && kind==='presale') return true;
      if (c==='b' && kind==='bond') return true;
    }
    return false;
  }
  // Sections for one room on one job: [{title, items:[{id,t}]}], empty sections dropped.
  function sectionsFor(room, service){
    var k = kindOf(service);
    return listOf(room).map(function(s){
      return { title:s[0], items:s[1].filter(function(i){ return applies(i[2], k); }).map(function(i){ return { id:i[0], t:i[1] }; }) };
    }).filter(function(s){ return s.items.length; });
  }
  function itemsFor(room, service){
    return sectionsFor(room, service).reduce(function(a,s){ return a.concat(s.items); }, []);
  }
  window.CHECKLISTS = { sectionsFor:sectionsFor, itemsFor:itemsFor, kindOf:kindOf, name:function(service){ return NAMES[kindOf(service)]; } };
})();
