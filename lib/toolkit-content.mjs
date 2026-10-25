// Starter Toolkit guides for the team app. Jack edits every one of these from
// the app (Toolkit → tap a guide → Edit).
//
// Fields: done = what "done" looks like, kit = what you need (products and
// tools, one per line), steps = one action per line, never = never do this,
// miss = easy to miss. A step ending in [5 min] or [30 sec] gets a timer button.
//
// Product lines name the TYPE of product on purpose. Jack adds the exact
// product he uses, e.g. "Bathroom descaler: <brand and name>".

const g = (id, sec, title, o = {}) => ({ id, sec, title, sub: "", room: "", done: [], kit: [], product: "", dwell: "", time: "", steps: [], pics: [], never: [], miss: "", body: "", good: "", bad: "", ...o });

const BASE = [
  // ───────────── How to clean each room ─────────────
  g("kitchen", "rooms", "Kitchen", { sub: "All services", room: "kitchen|pantry",
    done: ["Benchtops, splashback and cooktop with no smears when you look across them toward the light", "Sink and tap dry and shining", "Cupboard fronts, handles and kickboards free of fingerprints and drips", "Appliance fronts streak-free, stainless wiped with the grain", "Oven glass clear (deep, pre-sale, bond)", "Floor clean right to the kickboards, no crumbs in the corners", "Everything put back on the benches the way you found it"],
    kit: ["Kitchen degreaser", "Multi-surface spray", "Glass and stainless spray", "Oven cleaner (deep, pre-sale, bond)", "Cooktop cream for glass or induction tops", "Glass cooktop scraper", "Non-scratch scrub pad", "Detail brush", "Fresh microfibre cloths", "Glass cloth", "Microwave-safe bowl", "Vacuum with crevice tool", "Mop, bucket and neutral floor cleaner"],
    dwell: "Degreaser 2–3 min · oven cleaner: as the label says",
    steps: [
      "Clear everything off the benchtops onto the dining table",
      "Turn on the rangehood fan or open a window",
      "Deep, pre-sale and bond: spray the oven inside and leave it to soak [20 min]",
      "Deep, pre-sale and bond: soak the rangehood filters in hot water and degreaser [15 min]",
      "Heat a bowl of water in the microwave to loosen the grime [3 min]",
      "Cobwebs and light fittings first, top of the room down",
      "Spray the rangehood, splashback and cooktop with degreaser, then leave them [3 min]",
      "While that works: wipe the overhead cupboard doors and handles",
      "Wipe the rangehood top to bottom",
      "Wipe the splashback top to bottom, then power points and switches",
      "Lift off the grates and burner caps and scrub them in the sink",
      "Degrease the cooktop, then buff it dry",
      "Glass top: scraper held flat, then cooktop cream, then buff",
      "Microwave: wipe out the roof, walls, turntable and the door seal",
      "Benchtops: wipe, then dry and buff with a fresh cloth",
      "Sink: scrub, rinse, then dry and buff the tap and its base",
      "Lower cupboard doors, handles and kickboards",
      "Appliance fronts: fridge, dishwasher, oven door. Stainless with the grain",
      "Back to the oven: scrub, wipe out, rinse twice so no residue is left",
      "Rinse the filters, dry them fully, put them back",
      "Put everything back on the benches",
      "Vacuum the floor, edges and along the kickboards",
      "Mop, working toward the door",
      "Crouch and look across every surface toward the light. Fix anything you see"],
    never: ["Abrasive pads or steel wool on stainless, glass cooktops or stone", "Oven cleaner on aluminium, stone benchtops or the oven door seal"],
    miss: "Top of the rangehood, the gap between the cooktop and the bench, the kickboards, the fridge door seal and the base of the tap." }),

  g("bathroom", "rooms", "Bathroom", { sub: "All services", room: "bath|ensuite", time: "45–55 min (detailed)",
    done: ["Zero streaks on glass and mirrors", "All fixtures dry and gleaming", "Grout clean", "Toilet spotless, including the base and behind it", "Floor dry, no slip hazard", "Smells fresh", "Towels hung straight, toilet paper end folded"],
    kit: ["Bathroom cleaner (soap scum)", "Descaler for hard water spots", "Toilet cleaner", "Glass spray", "Mould and mildew treatment (deep, pre-sale, bond)", "Toilet brush", "Grout brush", "Non-scratch scrub pad", "Squeegee", "Fresh microfibre cloths", "Separate toilet cloths, used only on toilets", "Glass cloth", "Gloves: a fresh pair just for this room", "Vacuum, mop and bucket"],
    dwell: "Toilet 5–10 min · walls 2–3 min · tub 5–8 min · glass 5–10 min",
    steps: [
      "Prep and tidy (5–7 min): bag the rubbish and clear products off every surface",
      "Turn on the fan or open the window",
      "Spray shower walls, glass and bath, then leave them [5 min]",
      "Toilet cleaner under the rim, then leave it [5 min]",
      "Upper and wet areas (15–20 min): dust the exhaust fan cover and light fittings",
      "Mirror: spray, wipe, buff",
      "Back to the shower: scrub the walls top down, then the glass",
      "Scrub the grout lines and the shower floor",
      "Rinse everything from the top down",
      "Squeegee the glass in overlapping strokes, then wipe the frame top and tracks",
      "Dry the shower head, mixer and chrome until they shine",
      "Lower areas and fixtures (12–15 min): bath scrubbed, rinsed and dried, including the outside face",
      "Vanity top, basin and tap: scrub, rinse, dry",
      "Vanity doors, handles and kickboard",
      "Toilet: brush the bowl and under the rim, then flush",
      "Toilet outside, top to bottom: cistern, button, lid, seat both sides, hinges, rim, base, behind",
      "Switches, door handle, towel rails and toilet roll holder",
      "Final polish (5–8 min): mirror and chrome one last buff",
      "Fold the toilet paper end, hang towels straight, put products back neatly",
      "Vacuum the floor, then mop toward the door",
      "Check the floor is dry before you walk away",
      "Crouch and check the glass and mirror at an angle toward the light"],
    never: ["Use a toilet cloth anywhere else", "Mix bleach-based products with anything else", "Abrasive pads on acrylic baths, shower bases or glass"],
    miss: "Behind the toilet, the top of the shower screen frame, the tap base and the shower door seal." }),

  g("toilet", "rooms", "Toilet & powder room", { sub: "All services", room: "toilet|powder|\\bwc\\b",
    done: ["Bowl clean under the rim with no ring at the waterline", "Seat clean on both sides, hinges included", "Base and the floor behind the toilet clean", "Basin, tap and mirror shining", "Smells fresh"],
    kit: ["Toilet cleaner", "Bathroom cleaner", "Glass spray", "Toilet brush", "Separate toilet cloths", "Fresh microfibre cloths", "Gloves"],
    dwell: "Toilet cleaner 5–10 min",
    steps: [
      "Bag the rubbish, open the window or turn on the fan",
      "Toilet cleaner under the rim, then leave it [5 min]",
      "While it works: mirror, basin and tap",
      "Brush the bowl and under the rim, then flush",
      "Toilet outside, top to bottom: cistern, button, lid, seat both sides, hinges, rim, base",
      "Floor behind and around the base",
      "Switches, door handle and toilet roll holder",
      "Fold the toilet paper end",
      "Mop toward the door",
      "Change your gloves before you go into another room"],
    miss: "The hinges, the bolt caps at the base, and the floor right behind the toilet." }),

  g("glass", "rooms", "Windows, glass & mirrors", { sub: "All services", room: "window|glass|mirror",
    done: ["No streaks when you look across it at an angle toward the light", "No water spots or lint left on the surface", "Edges, frame tops and seals wiped, not just the middle", "Sills and tracks clean (deep, pre-sale, bond)"],
    kit: ["Glass spray", "Descaler for hard water spots on shower glass", "Squeegee", "Non-scratch scrub pad", "Glass cloth (fresh, lint-free)", "Microfibre cloth for frames and sills", "Step stool"],
    dwell: "Shower glass 5–10 min",
    steps: [
      "Spray shower glass and leave it to work [5 min]",
      "Scrub with a non-scratch pad, top to bottom",
      "Rinse from the top down",
      "Squeegee in overlapping strokes, wiping the blade each pass",
      "Buff with a dry, fresh glass cloth",
      "Mirrors and windows: spray the cloth, not the glass, near electrics or timber",
      "Wipe in an S pattern from the top, then buff",
      "Wipe the frame tops, edges and seals",
      "Crouch, look across at an angle toward the light, fix anything you see"],
    never: ["Use a cloth that's been used on anything else", "Use a scourer or blade on tinted or coated glass"],
    miss: "The top of the shower screen frame, and the bottom of a mirror where the vanity casts a shadow." }),

  g("bedrooms", "rooms", "Bedrooms", { sub: "All services", room: "bed|guest|nursery",
    done: ["Every surface dust-free, including tops of wardrobes, frames and the fan", "Mirrors streak-free", "Bed made neatly with pillows square (if the brief says)", "Client's things back where they were", "Floor clean under and behind furniture you can move"],
    kit: ["Multi-surface spray", "Glass spray", "Duster with an extension pole", "Fresh microfibre cloths", "Glass cloth", "Vacuum with crevice tool", "Mop and neutral floor cleaner (hard floors)", "Step stool"],
    steps: [
      "Open the blinds and turn the lights on so you can see the dust",
      "Strip or make the bed as the job brief says",
      "Cobwebs from the corners and ceiling",
      "Ceiling fan blades, top and bottom. Cover the bed first",
      "Light fittings",
      "Tops of wardrobes, door frames and picture frames",
      "Window sills and frames",
      "Bedside tables: lift each item, wipe, put it back as it was",
      "Dresser, desk and shelves the same way",
      "Mirrors: spray, wipe, buff",
      "Wardrobe doors and handles. Inside only if the brief says",
      "Switches, door handles and the door itself",
      "Skirting boards",
      "Vacuum under the bed and behind anything you can move",
      "Vacuum or mop the floor, working toward the door"],
    never: ["Open drawers or go through a client's things", "Move anything heavy on your own"],
    miss: "Top of the fan blades, the top edge of the door, under the bed, and the skirting behind the door." }),

  g("living", "rooms", "Living & dining", { sub: "All services", room: "living|dining|lounge|family|rumpus|media|theatre|games",
    done: ["No dust on any surface, including light fittings, the fan and skirting", "Glass, screens and mirrors streak-free", "Couch cushions straight, crumbs gone from the crevices", "Dining table and chairs wiped, legs included", "Floor clean edge to edge"],
    kit: ["Multi-surface spray", "Glass spray", "Dry microfibre cloth for screens", "Duster with an extension pole", "Fresh microfibre cloths", "Vacuum with crevice and upholstery tools", "Mop and neutral floor cleaner"],
    steps: [
      "Lights on, blinds open",
      "Cobwebs, ceiling fan and light fittings",
      "Tops of frames, shelves and window sills",
      "Shelves and ornaments: lift, wipe, put back as they were",
      "TV and screens: dry cloth only, never spray on the screen",
      "Glass doors and mirrors: spray, wipe, buff",
      "Coffee table and side tables",
      "Dining table top, edges and chairs, legs included",
      "Switches, door handles and door frames",
      "Skirting boards",
      "Couch: vacuum the crevices, straighten the cushions",
      "Vacuum the floor, edges and under the furniture you can move",
      "Mop hard floors, working toward the door"],
    never: ["Spray straight onto screens, speakers or electronics", "Wet-clean leather or fabric couches unless the brief says"],
    miss: "Under the couch cushions, the top of the TV unit, the chair legs and the sliding door track." }),

  g("study", "rooms", "Study & office", { sub: "All services", room: "study|office",
    done: ["Surfaces dust-free around the client's things", "Screens and keyboards dust-free (dry only)", "Floor clean, including under the desk"],
    kit: ["Multi-surface spray", "Dry microfibre cloth for screens", "Fresh microfibre cloths", "Vacuum with crevice tool"],
    steps: [
      "Leave papers exactly where they are: clean around them",
      "Dust shelves, frames and the top of the room down",
      "Screens and keyboard: dry cloth only",
      "Desk: wipe the clear areas only",
      "Chair: wipe the arms and base",
      "Cables: dust the visible ones, don't unplug anything",
      "Vacuum under the desk and around the chair"],
    never: ["Move, read or tidy papers", "Unplug or turn off anything"] }),

  g("hallway", "rooms", "Hallways, stairs & entry", { sub: "All services", room: "hall|stair|landing|entry|entrance|foyer",
    done: ["Handrail and balusters dust-free", "Front door clean inside and out, handle shining", "Each stair clean to the edge and the back corner", "Skirting and door frames free of scuffs and dust"],
    kit: ["Multi-surface spray", "Glass spray", "Detail brush", "Fresh microfibre cloths", "Vacuum with crevice tool", "Mop and neutral floor cleaner"],
    steps: [
      "Cobwebs and light fittings",
      "Front door, both sides, and the handle",
      "Door glass and side lights",
      "Switches, intercom and alarm panel: wipe, don't press",
      "Handrail, then the balusters",
      "Skirting boards and door frames",
      "Stairs: vacuum from the top down, corners first",
      "Mop hard floors, working toward the exit"],
    miss: "The back corners of each stair, the top of the front door, and the doormat area." }),

  g("laundry", "rooms", "Laundry", { sub: "All services", room: "laundry",
    done: ["Tub and tap dry and shining", "Machine fronts, tops and dials wiped", "Lint and dust gone from behind and around the machines", "Cupboards wiped inside and out (deep, pre-sale, bond)"],
    kit: ["Multi-surface spray", "Bathroom cleaner for the tub", "Detail brush", "Fresh microfibre cloths", "Vacuum with crevice tool", "Mop and neutral floor cleaner"],
    steps: [
      "Clear the benches",
      "Cobwebs and light fitting",
      "Overhead cupboards outside, then inside if the service includes it",
      "Splashback and bench",
      "Washing machine top, dials and door. Wipe the door seal",
      "Dryer: clean the lint filter, wipe the front and top",
      "Tub and tap: scrub, rinse, dry",
      "Lower cupboards and kickboard",
      "Vacuum behind and beside the machines where you can reach",
      "Mop toward the door"],
    miss: "The lint filter, the washing machine door seal, and the gap beside the machines." }),

  g("outdoor", "rooms", "Balcony, deck & patio", { sub: "All services", room: "balcony|deck|veranda|patio|alfresco|courtyard|pergola|outdoor|outside|yard",
    done: ["Floor swept with no leaves or cobwebs", "Outdoor table and chairs wiped", "Glass balustrade streak-free", "Drains clear"],
    kit: ["Broom and dustpan", "Multi-surface spray", "Glass spray", "Fresh microfibre cloths", "Bucket and mop or deck brush", "Bin bag for leaves"],
    steps: [
      "Cobwebs from the ceiling, corners and light fittings",
      "Outdoor furniture: wipe tables, then chairs",
      "Glass balustrade: spray, wipe, buff both sides if you can reach safely",
      "Sweep from the house outward",
      "Clear leaves from the drains",
      "Mop or scrub the floor if the brief says"],
    never: ["Lean over a balustrade to reach the outside", "Hose near power points or outdoor electrics"] }),

  g("garage", "rooms", "Garage", { sub: "When booked", room: "garage|carport|shed",
    done: ["Floor swept, cobwebs gone", "Shelves dusted where they're clear", "Bins area tidy"],
    kit: ["Broom and dustpan", "Duster with an extension pole", "Fresh microfibre cloths", "Bin bags"],
    steps: [
      "Cobwebs from the ceiling and roller door frame",
      "Dust clear shelves. Don't move tools or stored boxes",
      "Sweep from the back toward the roller door",
      "Bag the sweepings and take them with you"],
    never: ["Move cars, tools, chemicals or stored items"] }),

  // ───────────── Premium touches ─────────────
  // The finishing details that make a home feel looked after. Done last, in the
  // room you're finishing, after the clean itself is complete.
  g("tpfold", "premium", "Toilet paper diamond fold", { sub: "Every bathroom and toilet", time: "30 sec",
    done: ["A square diamond standing on its point, centred under the roll", "No raw edges showing on the front", "Creases pressed sharp", "Sheet clean and untorn"],
    kit: ["Clean, dry hands (fresh gloves off)"],
    steps: ["Pull out about one and a half squares. Fold the bottom-left corner up diagonally so its edge runs up the centre",
      "Fold the bottom-right corner up the same way so the two edges meet in the middle and make a point",
      "Fold the point straight up so it covers the raw edges in the middle",
      "Fold the left and right corners behind at 45 degrees so the bottom edges meet at the centre on the back. A diamond shows on the front",
      "Roll the paper up or down slightly so the diamond sits centred, then press the creases"],
    pics: ["art:tp1", "art:tp2", "art:tp3", "art:tp4", "art:tp5"],
    never: ["Fold it with gloves you've just used on the toilet"],
    miss: "A half-used roll on the holder: check the spare isn't empty, and fold the roll that's on show." }),

  g("towelfold", "premium", "Bath towel: thirds and hang", { sub: "Bathrooms", time: "1 min a towel",
    done: ["Folded edges face the wall, so the front looks seamless", "Both ends level at the bottom", "Hems and labels hidden", "Every towel in the room folded the same way"],
    kit: ["Clean, dry towels only. Damp or used ones go where the client keeps them"],
    steps: ["Lay the towel flat, face down, long side running away from you",
      "Fold one long side in by a third",
      "Fold the other long side over it, making a long, even strip",
      "Hang it over the rail, folded edges to the wall, and pull the ends level"],
    pics: ["art:tw1", "art:tw2", "art:tw3", "art:tw4"],
    miss: "Hand towels on a ring or short rail: same fold, then hang them centred." }),

  g("teatowel", "premium", "Tea towel: thirds into thirds", { sub: "Kitchens", time: "30 sec",
    done: ["A neat, square-edged pad", "Folded edge facing out", "Placed straight, not at an angle"],
    kit: ["A clean, dry tea towel from the client's drawer"],
    steps: ["Lay the tea towel flat, face down",
      "Fold it in thirds along its length into a long strip",
      "Fold the top third down",
      "Fold the bottom third up over it, then place it on the bench or over the oven handle, folded edge out"],
    pics: ["art:tt1", "art:tt2", "art:tt3", "art:tt4"],
    never: ["Fold a used or damp tea towel and put it back out. Leave it where the client keeps washing"] }),

  g("cushions", "premium", "Cushions & throws", { sub: "Living, bedrooms", time: "2 min",
    done: ["Cushions plumped and standing straight", "Pairs matched and mirrored left to right", "Throw folded neatly over one arm or the end of the bed"],
    steps: ["Plump each cushion: squeeze the sides and give it a shake",
      "Stand them up against the back, corners up",
      "Match pairs so both sides of the couch mirror each other",
      "Throw: fold in thirds lengthwise, then drape over one arm or across the foot of the bed"],
    never: ["Chop the top of a cushion unless the client already styles them that way"] }),

  g("bedfinish", "premium", "Bed finish", { sub: "Bedrooms, when we make the bed", time: "3 min",
    done: ["Sheets tight with no wrinkles across the top", "Equal overhang on both sides", "Pillows square and stacked evenly", "Quilt or throw straight across the foot"],
    steps: ["Pull the fitted sheet tight at every corner",
      "Even the quilt so the overhang is the same both sides",
      "Smooth from the centre out to each edge",
      "Fold the top of the quilt back a hand's width if that's how the client has it",
      "Plump the pillows and stack them square, sleeping pillows at the back"] }),

  g("bathfinish", "premium", "Bathroom finishing touches", { sub: "Every bathroom", time: "2 min",
    done: ["Toilet seat and lid down", "Products lined up, labels facing forward", "Shower head and taps turned straight", "Bath mat folded over the bath edge or squared to the shower", "No water spots left on chrome"],
    steps: ["Toilet lid and seat down",
      "Line up bottles on the vanity and in the shower, labels facing out",
      "Turn the shower head to point straight down and the taps square",
      "Fold the bath mat over the edge of the bath, or lay it square in front of the shower",
      "One last buff on the tap and shower mixer"] }),

  g("kitchenfinish", "premium", "Kitchen finishing touches", { sub: "Every kitchen", time: "2 min",
    done: ["Tap turned straight over the sink", "Benchtop items squared to the wall", "Tea towel folded", "No crumbs or drips on the floor in front of the bench"],
    steps: ["Turn the tap so it points straight into the sink",
      "Square up the kettle, toaster and any canisters against the splashback",
      "Fold the tea towel (see Tea towel: thirds into thirds)",
      "Dishwashing brush and sponge tidied beside the sink",
      "Last look along the bench from one end"] }),

  g("livingfinish", "premium", "Living room finishing touches", { sub: "Living, dining", time: "2 min",
    done: ["Remotes lined up, not scattered", "Chairs pushed in evenly at the table", "Rugs straight and tassels combed", "Blinds all at the same height"],
    steps: ["Line up the remotes on the coffee table or TV unit",
      "Push the dining chairs in so they're evenly spaced",
      "Straighten rugs and comb the tassels flat",
      "Set the blinds to the same height in each room",
      "Stack magazines and books square"] }),

  g("lines", "premium", "Vacuum lines in carpet", { sub: "Carpeted rooms", time: "Part of the vacuum",
    done: ["Even, straight lines all running the same way", "No footprints left behind you"],
    steps: ["Start in the far corner",
      "Vacuum in straight, overlapping lines toward the door, all the same direction",
      "Finish at the doorway and step out without walking back over the carpet"] }),

  g("entryfinish", "premium", "Entry & first impression", { sub: "Last thing before you leave", time: "1 min",
    done: ["Doormat square to the door and shaken out", "Shoes paired if they're at the door", "Entry light off unless the brief says"],
    steps: ["Shake out the doormat outside and lay it square",
      "Pair any shoes at the door",
      "Look back from the front door the way the client will see the home"] }),

  // ───────────── Deep jobs, step by step ─────────────
  g("oven", "tasks", "Oven, inside and out", { sub: "Deep, pre-sale, bond",
    done: ["Roof, walls and floor clean, no burnt-on carbon", "Door glass clear inside, outside and between panes if they come apart", "Racks and trays clean", "No cleaner residue or smell left behind"],
    kit: ["Oven cleaner", "Non-scratch scrub pad", "Scraper", "Detail brush", "Bin bags or a drop sheet for the racks", "Fresh microfibre cloths", "Bucket of warm water", "Gloves (long cuff)", "Eye protection"],
    dwell: "As long as the label says",
    steps: [
      "Check the oven is off and cool",
      "Open a window or turn on the rangehood fan",
      "Take out the racks and trays and lay them on a drop sheet or in a bin bag",
      "Spray the inside of the oven, avoiding the door seal, element and fan",
      "Spray the racks and trays, then leave everything [20 min]",
      "Scrape off the loose carbon",
      "Scrub the floor, walls and roof with a non-scratch pad",
      "Wipe out with a damp cloth, rinsing it often",
      "Wipe out a second time with clean water so no residue is left",
      "Door glass inside: scrub, rinse, buff",
      "If the door glass comes apart: clean between the panes",
      "Scrub the racks and trays, rinse, dry, put them back",
      "Outside of the door, handle and control panel",
      "Turn the oven light on and check the corners"],
    never: ["Spray the door seal, element, fan or thermostat", "Use oven cleaner on a self-cleaning (pyrolytic) oven inside", "Use steel wool on enamel or glass"],
    miss: "The back corners, the top of the door, and the inside edge of the door frame." }),

  g("filters", "tasks", "Rangehood filters", { sub: "Deep, pre-sale, bond",
    done: ["Filters free of grease, holes clear", "Filters fully dry before they go back in", "Underside of the hood clean"],
    kit: ["Kitchen degreaser", "Hot water in the sink", "Detail brush", "Fresh microfibre cloths", "Towel to dry on"],
    steps: [
      "Fan off. Pop the filters out",
      "Fill the sink with hot water and degreaser",
      "Soak the filters [15 min]",
      "Scrub both sides with a detail brush",
      "Rinse under hot water",
      "Degrease the underside of the hood and the light covers while they dry",
      "Dry the filters fully with a towel",
      "Clip them back in"],
    never: ["Put a charcoal filter in water, it ruins it. Tell Jack instead"] }),

  g("fridge", "tasks", "Fridge, inside", { sub: "When booked · bond",
    done: ["Every shelf, drawer and wall clean and dry", "Door seals clean in the folds", "No smell"],
    kit: ["Multi-surface spray safe for food areas", "Warm water and a little detergent", "Detail brush", "Fresh microfibre cloths", "Towel"],
    steps: [
      "Check the brief: is the fridge empty, or do we move food?",
      "Take out drawers and loose shelves",
      "Wash them in the sink, then dry",
      "Wipe the inside from the top shelf down",
      "Door shelves, top to bottom",
      "Door seals: clean inside the folds with a detail brush",
      "Dry everything and put the drawers and shelves back",
      "Outside, handles and top of the fridge"],
    never: ["Throw out any food unless the brief says"],
    miss: "The seal folds, the drip channel at the back, and the top of the fridge." }),

  g("dishwasher", "tasks", "Dishwasher", { sub: "Deep, pre-sale, bond",
    done: ["Filter clean", "Door edge and seal clean", "Front and control panel streak-free"],
    kit: ["Multi-surface spray", "Detail brush", "Fresh microfibre cloths", "Glass and stainless spray"],
    steps: [
      "Pull out the bottom rack",
      "Twist out the filter and rinse it under the tap",
      "Clear any food from the sump",
      "Wipe the door edges and seal, top and sides",
      "Wipe the inside of the door",
      "Put the filter and rack back",
      "Front, handle and controls. Stainless with the grain"],
    miss: "The bottom edge of the door, where grime collects." }),

  g("microwave", "tasks", "Microwave", { sub: "All services",
    done: ["Roof, walls, floor and turntable clean", "Door inside and seal clean", "Outside and buttons wiped"],
    kit: ["Microwave-safe bowl of water", "Multi-surface spray", "Fresh microfibre cloths"],
    steps: [
      "Heat a bowl of water on high [3 min]",
      "Leave the door shut so the steam softens the grime [2 min]",
      "Take out the bowl and the turntable carefully, it's hot",
      "Wipe the roof, walls and floor",
      "Wash and dry the turntable, put it back",
      "Door inside and the seal",
      "Outside and buttons"] }),

  g("hardwater", "tasks", "Shower glass with hard water spots", { sub: "Deep, pre-sale, bond",
    done: ["No white spots or haze when you look across it toward the light", "Glass dry and buffed"],
    kit: ["Descaler", "Non-scratch scrub pad", "Squeegee", "Glass cloth", "Gloves"],
    dwell: "As long as the label says",
    steps: [
      "Test the descaler on a small corner first",
      "Spray the glass top to bottom",
      "Leave it to work [5 min]",
      "Scrub in small circles with a non-scratch pad",
      "Rinse from the top down",
      "Squeegee, then buff dry",
      "Check at an angle. If spots remain, repeat once, then flag it"],
    never: ["Use a razor blade or scourer on coated or etched glass"] }),

  g("grout", "tasks", "Grout lines", { sub: "Deep, pre-sale, bond",
    done: ["Grout an even colour with no grey film", "Tiles rinsed with no residue"],
    kit: ["Grout cleaner or bathroom cleaner", "Grout brush", "Bucket of clean water", "Fresh microfibre cloths", "Knee pad"],
    steps: [
      "Spray a small section of grout",
      "Leave it to work [3 min]",
      "Scrub along each line with the grout brush",
      "Rinse with clean water",
      "Wipe dry",
      "Move to the next section"],
    never: ["Use acid or bleach products on natural stone tiles"] }),

  g("mould", "tasks", "Mould on silicone & ceilings", { sub: "Deep, pre-sale, bond",
    done: ["Mould treated and wiped", "Room aired out", "Anything that won't lift photographed and flagged"],
    kit: ["Mould and mildew treatment", "Gloves", "Eye protection", "Mask", "Fresh microfibre cloths", "Step stool"],
    dwell: "As long as the label says",
    steps: [
      "Open the window and turn on the fan",
      "Put on gloves, eye protection and a mask",
      "Apply to the silicone or the patch on the ceiling",
      "Leave it to work [10 min]",
      "Wipe away, then rinse with a clean damp cloth",
      "Dry the area",
      "If it's still black: photo and flag it. It's in the silicone, not on it"],
    never: ["Mix mould treatment with any other product", "Spray over your head. Apply it to a cloth for ceilings"] }),

  g("tracks", "tasks", "Window & door tracks", { sub: "Deep, pre-sale, bond",
    done: ["No dirt, bugs or leaves in the tracks or corners", "Weep holes clear", "Tracks dry"],
    kit: ["Vacuum with crevice tool", "Detail brush", "Multi-surface spray", "Fresh microfibre cloths", "Cotton buds or a flat tool for corners"],
    steps: [
      "Vacuum the loose dirt",
      "Spray the track and leave it [2 min]",
      "Scrub the corners with a detail brush",
      "Wipe out with a cloth wrapped over a flat tool",
      "Clear the weep holes",
      "Wipe dry"],
    miss: "The corners, and the outside track of sliding doors." }),

  g("blinds", "tasks", "Blinds", { sub: "Deep, pre-sale, bond",
    done: ["Every slat dust-free on both sides", "Cords and bottom rail wiped"],
    kit: ["Microfibre cloths", "Duster", "Vacuum with brush tool", "Step stool"],
    steps: [
      "Close the slats facing down",
      "Wipe or dust from the top slat down",
      "Turn them facing up and repeat",
      "Bottom rail and pull cords",
      "Roller blinds: vacuum with the brush tool, top down",
      "Open them back the way you found them"],
    never: ["Wet fabric or timber blinds"] }),

  g("skirting", "tasks", "Skirting boards & door frames", { sub: "All services",
    done: ["No dust or scuffs on the top edge or face", "Corners clean"],
    kit: ["Multi-surface spray", "Fresh microfibre cloths", "Detail brush", "Knee pad"],
    steps: [
      "Vacuum along the top edge first",
      "Wipe the top edge, then the face, with a damp cloth",
      "Detail brush into the corners",
      "Door frames: wipe from the top down",
      "Door faces: spot-clean around the handle"] }),

  g("wallwash", "tasks", "Wall washing", { sub: "Deep, pre-sale, bond · every room",
    body: "Every deep, pre-sale and bond clean gets a full wall wash in every room we clean. Dry-dust first, then wash top down with a damp pad, rinse, and check with a torch. Regular cleans get spot marks only (see Walls: spot marks).",
    done: ["Even colour wall to wall, with no streaks, tide marks or shiny patches when you shine a torch along it", "Cornices and corners free of dust and cobwebs", "Hand marks gone around switches, door handles and door frames", "Switch and power point plates clean and dry", "No drips on the skirting or the floor", "Furniture back exactly where it was"],
    kit: ["Sugar soap (wall wash)", "Flat mop with extension pole", "Wall-only microfibre pads, at least two", "Two buckets: one to wash, one to rinse", "Fresh microfibre cloths for by hand", "Dry microfibre cloth to buff", "Melamine sponge (gloss or semi-gloss only, tested first)", "Old towel to lay along the skirting", "Torch (your phone torch is fine)", "Step stool"],
    dwell: "Sugar soap: as the label says. Never let it dry on the wall",
    steps: [
      "Work out the paint. Flat or matte looks chalky with no shine. Low sheen has a soft glow. Semi-gloss and gloss shine (wet areas, doors, trims)",
      "Test behind the door: damp cloth, rub gently in one small spot",
      "Paint on the cloth or a shiny patch left behind? Dry-dust only in that room, and flag it",
      "Wallpaper, raw timber, render or fresh paint you can smell: don't wash it. Dry-dust and flag it",
      "Ease furniture a hand's width off the wall. Only what you can move easily on your own",
      "Lay an old towel along the skirting",
      "Fill the wash bucket with warm water and sugar soap as the label says",
      "Fill the rinse bucket with clean warm water",
      "Dry-dust first: cornices, then the walls top down with a dry pad. Wet dust turns into mud streaks",
      "Dip a pad in the wash bucket and wring it until it's damp, not dripping",
      "Wash one section about an arm's width, from the cornice down to the skirting",
      "Use overlapping strokes so you don't leave lines between them",
      "A drip runs down? Catch it straight away with a dry cloth",
      "Rinse the pad in the rinse bucket, wring it, then wash the next section, overlapping the last by a hand's width",
      "Change both buckets as soon as the water looks grey",
      "Switches, power points and light fittings: by hand with a sprayed cloth, never the pad. No water on the plate edges",
      "Hand marks: around switches, door handles, door frames, and hallways at hand height",
      "Leftover marks: damp cloth with a little sugar soap, gentle small circles",
      "Still there on gloss or semi-gloss? Melamine sponge, tested first, light pressure only",
      "Rinse every washed section with a clean pad and rinse water, so no sugar soap film is left",
      "Buff any streaky patch with a dry microfibre",
      "Shine a torch along the wall at an angle. Look for streaks, tide marks, shiny patches and missed marks",
      "Lift the towel and wipe the top edge of the skirting",
      "Put the furniture back exactly where it was",
      "A mark that won't shift, or paint that lifted: photo and flag it",
      "Bag the used pads with the dirty cloths. Never use a wall pad on a floor"],
    never: ["Wet the wall so water runs down it", "Spray product straight onto the wall near switches or power points", "Scrub flat, matte or low sheen paint", "Melamine sponge on flat, matte or low sheen paint", "Wash wallpaper, raw timber, render or fresh paint", "Skip the dry-dust", "Use a floor mop on walls, or a wall pad on floors", "Stand on furniture or the bath edge to reach. Use the step stool"],
    miss: "The top of the wall at the cornice, above door frames, behind doors, around light switches, beside the bed head, hallways at hand height, and the wall beside the kitchen bin." }),

  g("walls", "tasks", "Walls: marks and spot cleaning", { sub: "Deep, pre-sale, bond",
    done: ["Marks gone or lighter with no shiny patch or rub mark left", "Anything that won't come off is flagged"],
    kit: ["Warm water with a little detergent", "Fresh microfibre cloths", "Melamine sponge (test first)"],
    steps: [
      "Try a damp cloth first",
      "Test anything stronger in a hidden spot",
      "Work gently in small circles",
      "Wipe dry",
      "Step back and look from across the room",
      "Shiny patch or paint lifting? Stop and flag it"],
    never: ["Use a melamine sponge on flat or matte paint", "Scrub hard on painted walls"] }),

  g("fans", "tasks", "Ceiling & exhaust fans", { sub: "All services",
    done: ["Blades clean top and bottom", "Exhaust fan covers dust-free"],
    kit: ["Pillowcase or blade duster", "Multi-surface spray", "Fresh microfibre cloths", "Step stool"],
    steps: [
      "Fan off at the switch",
      "Cover anything below if it's dusty",
      "Slide a pillowcase over each blade and pull back so the dust stays inside",
      "Wipe the blades with a damp cloth",
      "Wipe the motor housing and light",
      "Exhaust fans: vacuum the cover, then wipe it"],
    never: ["Stand on chairs or furniture. Use the step stool"] }),

  g("cupboards", "tasks", "Cupboards & drawers, inside", { sub: "Bond · when booked",
    done: ["Every shelf, wall and door inside clean and dry", "No crumbs in the corners or drawer runners"],
    kit: ["Multi-surface spray", "Vacuum with crevice tool", "Fresh microfibre cloths", "Detail brush"],
    steps: [
      "Check they're empty. If not, ask Jack before you move anything",
      "Vacuum the crumbs from shelves and corners",
      "Wipe from the top shelf down",
      "Insides of the doors and the hinges",
      "Drawers: vacuum, wipe, then the runners and fronts",
      "Leave doors open a minute to dry, then close them"] }),

  g("carpet", "tasks", "Spots on carpet", { sub: "When needed",
    done: ["Spot lighter or gone with no ring left", "Anything that won't lift is flagged"],
    kit: ["Clean white cloth", "Cool water", "Carpet spot cleaner (test first)"],
    steps: [
      "Blot, don't rub",
      "Test the spot cleaner in a hidden corner",
      "Apply a little to the cloth, not the carpet",
      "Blot from the outside in",
      "Blot with clean water",
      "Blot dry",
      "Still there? Photo and flag it. Don't keep going"],
    never: ["Scrub carpet, it frays the fibres", "Soak the carpet"] }),

  // ───────────── Surfaces: what's safe ─────────────
  g("stone", "surfaces", "Natural stone: marble, granite, travertine", { sub: "Check before you spray",
    body: "Natural stone etches with acid and stains easily. If you can't tell whether a benchtop is stone, treat it like stone and ask Jack.",
    kit: ["Neutral pH cleaner", "Fresh microfibre cloths", "Dry cloth to buff"],
    steps: ["Wipe with neutral cleaner", "Dry straight away so it doesn't water-mark", "Buff"],
    never: ["Vinegar, lemon or any acid", "Bleach", "Bathroom descalers", "Abrasive pads or creams"] }),

  g("quartz", "surfaces", "Engineered stone & quartz", { sub: "Benchtops",
    kit: ["Neutral pH or multi-surface cleaner", "Fresh microfibre cloths"],
    steps: ["Wipe with a damp cloth and cleaner", "Dry and buff"],
    never: ["Abrasive pads or creams", "Oven cleaner or strong degreaser left sitting on it", "Bleach"] }),

  g("stainless", "surfaces", "Stainless steel", { sub: "Appliances, sinks",
    kit: ["Glass and stainless spray", "Fresh microfibre cloths"],
    steps: ["Find the direction of the grain", "Wipe with the grain, never across it", "Buff dry with the grain"],
    never: ["Steel wool or scourers", "Bleach"] }),

  g("cooktops", "surfaces", "Glass & induction cooktops", { sub: "Kitchen",
    kit: ["Cooktop cream", "Glass cooktop scraper", "Fresh microfibre cloths"],
    steps: ["Check it's cool", "Scraper held flat to lift burnt-on spills", "Cooktop cream in small circles", "Wipe off, then buff"],
    never: ["Scourers or abrasive pads", "Scraper held at a steep angle"] }),

  g("timber", "surfaces", "Timber floors", { sub: "Floors",
    kit: ["Neutral floor cleaner", "Mop wrung out until barely damp", "Vacuum (hard floor head)"],
    steps: ["Vacuum first", "Mop with a barely damp mop, with the boards", "No puddles. It should dry within a minute"],
    never: ["Steam mops", "Soaking the floor", "Bleach or vinegar"] }),

  g("tiles", "surfaces", "Tiles & grout", { sub: "Floors, walls",
    kit: ["Neutral floor cleaner", "Grout brush", "Mop and bucket"],
    steps: ["Vacuum first", "Mop with neutral cleaner", "Change the water when it's grey", "Grout: see the grout guide"],
    never: ["Acid on stone or terracotta tiles"] }),

  g("tapware", "surfaces", "Chrome, brushed & matte black tapware", { sub: "Bathrooms, kitchens",
    body: "Matte black and brushed finishes are coatings. Harsh products and scrubbing strip them for good.",
    kit: ["Mild bathroom cleaner", "Fresh microfibre cloths", "Dry cloth to buff"],
    steps: ["Spray the cloth, not the tap", "Wipe", "Dry straight away so it doesn't spot"],
    never: ["Descaler or acid on matte black or brushed finishes", "Scrub pads on any coated tap"] }),

  g("acrylic", "surfaces", "Acrylic baths & shower bases", { sub: "Bathrooms",
    kit: ["Bathroom cleaner", "Soft cloth or non-scratch sponge"],
    steps: ["Spray and leave it to work [5 min]", "Wipe with a soft cloth", "Rinse and dry"],
    never: ["Abrasive pads or creams. They leave permanent scratches"] }),

  g("painted", "surfaces", "Painted walls & doors", { sub: "Everywhere",
    kit: ["Warm water with a little detergent", "Fresh microfibre cloths"],
    steps: ["Damp cloth first", "Test anything stronger somewhere hidden", "Wipe gently, then dry"],
    never: ["Melamine sponge on flat or matte paint", "Heavy scrubbing"] }),

  g("laminate", "surfaces", "Laminate & vinyl", { sub: "Floors, benchtops",
    kit: ["Neutral or multi-surface cleaner", "Mop wrung out well"],
    steps: ["Vacuum or wipe crumbs first", "Damp mop or wipe", "Dry the edges and joins"],
    never: ["Soaking the floor, water swells the joins", "Abrasive pads"] }),

  g("screens", "surfaces", "Screens & electronics", { sub: "TVs, monitors",
    kit: ["Dry, fresh microfibre cloth"],
    steps: ["Turn the screen off if it's on, so you can see the dust", "Wipe gently with a dry cloth", "Stubborn mark: barely damp cloth, never sprayed on the screen"],
    never: ["Spray anything on a screen", "Glass cleaner on a TV"] }),

  g("upholstery", "surfaces", "Leather & fabric furniture", { sub: "Couches, chairs",
    kit: ["Vacuum with upholstery tool", "Dry microfibre cloth"],
    steps: ["Vacuum the seats and crevices", "Dust leather with a dry cloth", "Straighten the cushions"],
    never: ["Wet-clean or spray leather or fabric unless the brief says"] }),

  // ───────────── Products & kit ─────────────
  g("kitlist", "kit", "Kit check: before you leave home", { sub: "2 min",
    body: "Tick these off the night before or before you drive. Running out on site costs time.",
    steps: ["Fresh microfibre cloths: a sealed pack for this home", "Glass cloths", "Separate toilet cloths", "Gloves: at least 4 pairs", "Kitchen degreaser", "Multi-surface spray", "Bathroom cleaner", "Toilet cleaner", "Glass and stainless spray", "Neutral floor cleaner", "Descaler", "Oven cleaner (deep, pre-sale, bond)", "Mould treatment (deep, pre-sale, bond)", "Non-scratch scrub pads", "Detail brush and grout brush", "Toilet brush", "Squeegee", "Glass cooktop scraper", "Duster with extension pole", "Vacuum and attachments", "Mop, bucket and spare mop head", "Step stool", "Bin bags", "Dirty cloth bag", "Eye protection and mask", "Phone charged, Bardon shirt on"] }),

  g("products", "kit", "Which product goes where", { sub: "Look it up",
    body: "Each product has one job. If a surface isn't listed, use the gentlest product first and ask Jack.",
    steps: [
      "Kitchen degreaser: rangehoods, cooktops, splashbacks, filters. Not on stone",
      "Multi-surface spray: benches, cupboard fronts, switches, sills, skirting",
      "Bathroom cleaner: soap scum on showers, baths, vanities",
      "Descaler: hard water spots on glass and chrome. Not on stone, matte black or brushed taps",
      "Toilet cleaner: inside the bowl only",
      "Glass and stainless spray: mirrors, windows, stainless fronts",
      "Oven cleaner: inside ovens, racks and trays only",
      "Mould treatment: silicone, grout and ceilings. Never mixed with anything",
      "Neutral cleaner: natural stone, timber, tiles and floors",
      "Cooktop cream: glass and induction cooktops"],
    never: ["Mix any two products", "Decant into an unlabelled bottle"] }),

  g("cloths", "kit", "Cloths: how we use them", { sub: "Non-negotiable",
    done: ["Fresh cloths at every home, never one used at another house", "Toilet cloths used only on toilets", "Glass cloths used only on glass", "Used cloths bagged, never put back with the clean ones"],
    steps: ["Open a fresh pack at each home", "Keep toilet cloths separate from the start", "Fold each cloth in four so you have 8 clean faces", "Turn to a clean face when it's dirty", "Dirty cloth straight into the dirty bag"] }),

  g("vacuum", "kit", "Vacuum care", { sub: "End of every day",
    steps: ["Empty the bin or change the bag", "Cut hair off the brush roll", "Tap out or rinse the filter as the manual says", "Wipe the hose and head", "Charge it overnight"],
    miss: "A full bin or a clogged filter kills the suction, and you lose time on every floor." }),

  g("mops", "kit", "Mops & buckets", { sub: "On site",
    steps: ["Fresh water for each bathroom", "Change the water when it's grey", "Wring the mop out well", "Bathroom mop head never used on the kitchen", "Mop heads bagged with the dirty cloths at the end"] }),

  g("restock", "kit", "Running low on supplies", { sub: "1 min",
    steps: ["When you open the last of anything, flag it in the app: Running low on supplies", "Say what and how much is left", "Jack restocks before your next shift"] }),

  // ───────────── What each service needs ─────────────
  g("svc-regular", "services", "Regular clean", { sub: "Maintenance",
    body: "Keeping a home we've cleaned before at our standard. Every surface, every visit, at a steady pace.",
    steps: ["Read the brief: what the client wants extra or skipped", "Kitchen, bathrooms and floors are where clients notice most", "Dust every reachable surface", "Tidy as you go: cushions, towels, bed", "Don't move heavy furniture"] }),

  g("svc-deep", "services", "Deep clean", { sub: "Detail",
    body: "Everything in a regular clean, plus the detail: inside appliances, tracks, skirting, walls, fans, grout and anything built up.",
    steps: ["Start the soaks first: oven, filters, shower", "Work high to low in every room", "Inside the oven, microwave and dishwasher", "Tracks, blinds, skirting and door frames", "Spot-clean walls", "Flag anything that won't lift"] }),

  g("svc-presale", "services", "Pre-sale clean", { sub: "Photo and open-home ready",
    body: "The home is about to be photographed and walked through by buyers. Every hero spot has to read as spotless in a photo and up close.",
    done: ["Benchtops, splashback and appliances perfect: these are in every listing photo", "Glass and mirrors zero streaks", "Bathrooms gleaming, toilet seats down, towels straight", "Blinds level and all at the same height", "Floors flawless edge to edge", "No product left out, no smell of cleaner"],
    steps: ["Read the brief for the photo or open home date", "Everything in a deep clean", "Hero spots get a second pass: kitchen, main bathroom, living room glass", "Straighten everything you touch", "Final walkthrough with the lights on, like a buyer would"] }),

  g("svc-bond", "services", "Bond clean", { sub: "End of lease",
    body: "The home is empty and the agent inspects against the entry condition. Every cupboard, track and surface, inside and out.",
    steps: ["Check the brief for the agent's checklist if there is one", "Inside every cupboard and drawer", "Oven, rangehood filters, dishwasher, fridge inside", "Walls spot-cleaned room by room", "Tracks, sills, blinds, skirting, door frames", "Light switches and power points", "Photos of every room when you finish"],
    miss: "Inside the meter box door, the top of the fridge space, and the laundry tap." }),

  // ───────────── How we work ─────────────
  g("order", "how", "Order of work: top down, dry before wet", { sub: "1 min",
    body: "Dust falls. Work so you never clean the same surface twice.",
    steps: ["Start every room with the soaks", "Ceiling and high dust first", "Then mid-height surfaces", "Then low surfaces", "Dry work before wet work", "Floor last, working toward the door"] }),

  g("spray", "how", "Spray and move — dwell times", { sub: "1 min",
    body: "Apply product, move to the next surface while it works, then come back to scrub and wipe. Never scrub straight after spraying. Tap a timer so you don't have to remember.",
    dwell: "Toilet 5–10 min · walls 2–3 min · tub 5–8 min · glass 5–10 min",
    steps: ["Toilet [5 min]", "Shower walls [2 min]", "Bath [5 min]", "Shower glass [5 min]"] }),

  g("gloves", "how", "When to change gloves", { sub: "1 min",
    body: "Plan on 3–4 pairs for a whole house: pair 1 for the bathroom, pair 2 for the kitchen, pair 3 for bedrooms and living areas.",
    steps: ["Change between bathroom, kitchen and living areas", "Change after toilets or anything sewage-related", "Change if a glove tears", "Change before handling a client's belongings"],
    miss: "You don't need a new pair for every room or surface." }),

  g("arrive", "how", "Arriving at a job", { sub: "2 min",
    steps: ["Be there at your start time, not later", "Read the job brief in the app before you go in", "Clock in in the app when you arrive", "Open a fresh cloth pack and set up your kit", "Open windows or turn on fans"] }),

  g("pace", "how", "Staying on pace", { sub: "1 min",
    body: "Every job has a time. Finishing on time at our standard is the job.",
    steps: ["Check the time at the halfway point", "Behind? Tell Jack early, not at the end", "Don't skip steps to catch up", "Use dwell time: start the next surface while the product works"] }),

  g("teammate", "how", "Working with a teammate", { sub: "1 min",
    steps: ["Agree who has which rooms before you start (it's in the app)", "Bathroom and kitchen first so the soaks run", "Don't work above someone who's doing the floor", "Check each other's rooms before you finish"] }),

  g("clienthome", "how", "When the client is home", { sub: "1 min",
    steps: ["Say hello, introduce yourself, then get to work", "Ask which room they'd like you to start in or avoid", "Keep conversation short and friendly", "Anything they ask for that's extra: tell them you'll check with Jack, then flag it", "Never discuss price, other clients or other homes"] }),

  g("belongings", "how", "Client belongings", { sub: "1 min",
    steps: ["Lift, clean underneath, put it back exactly where it was", "Never open drawers, read papers or move valuables", "Only bin what is obviously rubbish", "Not sure? Leave it and ask Jack"] }),

  g("pets", "how", "Pets in the home", { sub: "1 min",
    steps: ["Check the brief for pets and where they should be", "Keep doors and gates shut behind you", "Never let a pet out", "Keep products and buckets out of reach"] }),

  g("keys", "how", "Keys, lockboxes & alarms", { sub: "1 min",
    steps: ["Access details are in the job brief", "Lockbox: put the keys straight back and scramble the code", "Alarm: follow the brief exactly", "Never copy, share or write down a code", "Can't get in? See: Can't get into the property"] }),

  g("walkthrough", "how", "Final walkthrough", { sub: "3 min",
    body: "Before you finish, walk every room you cleaned like the client would.",
    steps: ["Lights on in every room", "Crouch and look across benchtops, glass and floors toward the light", "Check the easy-to-miss spots in each guide", "Smell: fresh, not chemical", "Nothing of ours left behind"] }),

  g("photos", "how", "Taking photos for the report", { sub: "1 min",
    body: "Your after photos go to Jack, who checks them before anything goes to the client.",
    steps: ["Take them when the room is finished, lights on", "Stand in the doorway and get the whole room", "Then the hero spots: benchtops, an open oven, the shower", "Nothing personal in shot: mail, photos, faces, house numbers"] }),

  g("leave", "how", "Leaving a job", { sub: "1 min",
    steps: ["All your rooms ticked off with photos", "Kit and products packed, used cloths bagged", "Our rubbish taken with us", "Lights, fans and air-con off", "Windows and doors locked", "Keys back where they belong", "Clock out in the app"] }),

  // ───────────── Staying safe ─────────────
  g("mixing", "safety", "Products that must never mix", { sub: "Read this first",
    body: "Some products give off toxic gas when mixed, even in a toilet bowl or a bucket.",
    steps: ["Bleach-based products never with anything else", "Never with ammonia-based glass cleaners", "Never with acids, descalers, vinegar or toilet cleaner", "Rinse a surface fully before using a different product on it", "Smell something sharp? Leave the room, open windows, call Jack"],
    never: ["Mix two products to make one stronger", "Decant into unlabelled bottles"] }),

  g("labels", "safety", "Reading a product label", { sub: "1 min",
    steps: ["Read the label before you use a product the first time", "Check what it's for and what it's not for", "Check the PPE: gloves, eyes, mask", "Check the first aid section", "Ask Jack for the safety data sheet if you need it"] }),

  g("ladders", "safety", "Ladders & step stools", { sub: "1 min",
    steps: ["Use the step stool, never chairs, tables or the bath edge", "Set it on flat, dry ground", "Keep three points of contact", "Never stand on the top step", "Can't reach safely? Leave it and flag it"] }),

  g("lifting", "safety", "Lifting & moving furniture", { sub: "1 min",
    steps: ["Only move what you can lift easily on your own", "Bend your knees, keep it close", "Heavy, fragile or valuable: don't move it", "Two-person lift? Ask your teammate or skip it and note it"] }),

  g("heat", "safety", "Heat, water & breaks", { sub: "Summer",
    steps: ["Bring a full water bottle to every shift", "Drink before you're thirsty", "Open windows and use fans in hot rooms", "Take short breaks on long jobs", "Dizzy, headache or nausea: stop, cool down, call Jack"] }),

  g("sharps", "safety", "Sharps, needles & biohazards", { sub: "Don't touch",
    steps: ["Don't touch it", "Keep everyone away from it", "Take a photo from a distance", "Call Jack straight away"] }),

  g("electrical", "safety", "Water & electrics", { sub: "1 min",
    steps: ["Spray the cloth, not the power point or switch", "Keep water away from plugged-in appliances", "Never unplug anything you didn't plug in", "Sparks, a burning smell or a shock: stop and call Jack"] }),

  g("slips", "safety", "Slips & wet floors", { sub: "1 min",
    steps: ["Mop toward the door so you never walk on a wet floor", "Tell anyone home which floors are wet", "Wipe spills straight away", "Clean enclosed sneakers only"] }),

  // ───────────── Something's gone wrong ─────────────
  g("broke", "wrong", "I broke or damaged something", {
    steps: ["Stop and make it safe", "Take a photo", "Flag it in the app with a short note", "Call Jack straight away", "Don't try to hide or fix it yourself"] }),
  g("stain", "wrong", "I can't get something clean", {
    steps: ["Don't keep scrubbing harder, you can damage the surface", "Take a photo", "Flag it in the app so Jack knows before the client does", "Ask Jack what to try next"] }),
  g("injury", "wrong", "Chemical splash or injury", {
    steps: ["Stop work", "Rinse skin or eyes with clean running water", "Check the product label for first aid", "Call Jack", "If it's serious, call 000"] }),
  g("access", "wrong", "Can't get into the property", {
    steps: ["Check the job brief for access details", "Call Jack", "Wait somewhere safe nearby"] }),
  g("late", "wrong", "I'm running late or sick", {
    steps: ["Call Jack as soon as you know", "If it's a shift you can't make, tap Can't make it on the shift as well"] }),
  g("overtime", "wrong", "I'm going to run over time", {
    steps: ["Tell Jack as soon as you can see it, not at the end", "Say which rooms are left", "Keep going at our standard. Don't rush the finish"] }),
  g("unhappy", "wrong", "The client isn't happy", {
    steps: ["Listen and stay calm", "Say: thanks for telling me, I'll fix what I can now", "Fix what you can on the spot", "Don't argue, offer refunds or discounts", "Call Jack and tell him what was said"] }),
  g("extra", "wrong", "The client asks for extra work", {
    steps: ["Say: I'll check with Jack", "Flag it in the app: Extra work the client wants", "Only do it once Jack says yes"] }),
  g("found", "wrong", "I found something sensitive or valuable", {
    steps: ["Don't touch it or move it", "Clean around it", "Call Jack", "Never take photos of it"] }),
  g("petout", "wrong", "A pet got out", {
    steps: ["Close the doors so no others get out", "Call Jack straight away", "Look nearby, calmly"] }),
  g("alarm", "wrong", "The alarm is going off", {
    steps: ["Check the brief for the alarm code and steps", "Call Jack", "If security calls or arrives: explain you're the cleaner and give Jack's number"] }),
  g("stranger", "wrong", "Someone unexpected turns up", {
    steps: ["Don't let anyone in who isn't named in the brief", "Stay polite and keep the door between you", "Call Jack", "Feel unsafe? Leave and call 000"] }),
];

// Wall washing, worked into every guide that touches walls. Applied to the
// starter guides below, and once to saved content (KIT_V 4) so Jack's own edits
// are kept: a guide that already mentions a wall wash is left alone.
//   steps/kit/done/never: [anchor, [lines]] adds after the first line containing
//   anchor (end of the list if it's not found). swap: [old, new] replaces a line
//   only while it's still the starter wording. set: field → [old, new], same rule.
const WW = "Deep, pre-sale and bond:";
export const WALL_PATCH = {
  kitchen: { kit: [["Vacuum with crevice tool", ["Wall wash kit (deep, pre-sale, bond): see Wall washing"]]],
    steps: [["Cobwebs and light fittings first", [WW + " dry-dust the walls, then wall wash the kitchen while the soaks work (see Wall washing)"]]] },
  bathroom: { kit: [["Squeegee", ["Wall wash kit (deep, pre-sale, bond): see Wall washing"]]],
    steps: [["Vanity doors, handles and kickboard", [WW + " wall wash the painted walls outside the shower, steam marks under the fan and around the mirror last (see Wall washing)"]]] },
  toilet: { steps: [["While it works: mirror, basin and tap", [WW + " wall wash the painted walls. The wall behind the toilet gets a toilet cloth only (see Wall washing)"]]] },
  bedrooms: { kit: [["Step stool", ["Wall wash kit (deep, pre-sale, bond): see Wall washing"]]],
    steps: [["Tops of wardrobes, door frames and picture frames", [WW + " wall wash the room, behind the bed head included (see Wall washing)"]]] },
  living: { kit: [["Vacuum with crevice and upholstery tools", ["Wall wash kit (deep, pre-sale, bond): see Wall washing"]]],
    steps: [["Tops of frames, shelves and window sills", [WW + " wall wash the room. Keep the pad well clear of the TV and electronics (see Wall washing)"]]] },
  study: { steps: [["Dust shelves, frames and the top of the room down", [WW + " wall wash, keeping well clear of the desk, papers and cables (see Wall washing)"]]] },
  hallway: { kit: [["Detail brush", ["Wall wash kit (deep, pre-sale, bond): see Wall washing"]]],
    steps: [["Cobwebs and light fittings", [WW + " wall wash the hall and stairwell, only as high as you can reach safely from the step stool (see Wall washing)", "Hand-height scuffs along the hall and stairs last, by hand"]]] },
  laundry: { steps: [["Cobwebs and light fitting", [WW + " wall wash the painted walls, behind the tub and machines where you can reach (see Wall washing)"]]] },
  walls: { set: { title: ["Walls: marks and spot cleaning", "Walls: spot marks"], sub: ["Deep, pre-sale, bond", "Regular cleans · touch-ups after a wall wash"],
      body: ["", "Regular cleans get spot marks only. Deep, pre-sale and bond cleans get a full wall wash: see Wall washing."] } },
  painted: { steps: [[null, ["Whole walls on a deep, pre-sale or bond clean: see Wall washing"]]] },
  kitlist: { steps: [["Squeegee", ["Flat wall mop, extension pole and wall-only pads", "Second bucket for rinsing walls", "Sugar soap", "Old towel for along the skirting"]]] },
  products: { steps: [["Neutral cleaner:", ["Sugar soap: washing painted walls, doors and frames. Rinse after. Test first, never on wallpaper or raw timber"]]] },
  mops: { steps: [[null, ["Wall pads never go on floors, and floor mops never go on walls"]]] },
  "svc-deep": { swap: [["Spot-clean walls", "Wall wash every room (see Wall washing)"]],
    set: { body: ["Everything in a regular clean, plus the detail: inside appliances, tracks, skirting, walls, fans, grout and anything built up.", "Everything in a regular clean, plus the detail: a full wall wash, inside appliances, tracks, skirting, fans, grout and anything built up."] } },
  "svc-presale": { done: [["Floors flawless edge to edge", ["Walls even, with no marks or streaks in a photo or up close"]]],
    steps: [["Everything in a deep clean", ["Wall wash every room, then a second torch check on the living room and hallway walls"]]] },
  "svc-bond": { swap: [["Walls spot-cleaned room by room", "Wall wash every room (see Wall washing)"]] },
  order: { steps: [["Ceiling and high dust first", [WW + " dry-dust, then wash the walls, before mid-height surfaces, skirting and floors"]]] },
  walkthrough: { steps: [["Crouch and look across benchtops", [WW + " shine a torch along the walls at an angle for streaks and missed marks"]]] },
};

const FIELDS = ["steps", "kit", "done", "never"];
export function wallPatch(g) {
  const p = WALL_PATCH[g.id];
  if (!p || /wall wash/i.test(JSON.stringify(g))) return g;
  const out = { ...g };
  for (const f of FIELDS) for (const [anchor, add] of p[f] || []) {
    const list = [...(out[f] || [])];
    const i = anchor ? list.findIndex((x) => x.includes(anchor)) : -1;
    list.splice(i < 0 ? list.length : i + 1, 0, ...add.filter((x) => !list.includes(x)));
    out[f] = list;
  }
  for (const [o, n] of p.swap || []) out.steps = (out.steps || []).map((x) => (x === o ? n : x));
  for (const [f, [o, n]] of Object.entries(p.set || {})) if ((out[f] || "") === o) out[f] = n;
  return out;
}

export const GUIDES = BASE.map(wallPatch);

