// Content for the team app (/me): this week's focus, the toolkit guides and the
// house rules. Jack edits all of it from the app itself (or Tools → Team app).
// Stored at "teamapp". Starter content below is a first draft for Jack to edit:
// product names are left blank on purpose.

export const SECTIONS = [
  { id: "rooms", title: "How to clean each room" },
  { id: "how", title: "How we work" },
  { id: "wrong", title: "Something's gone wrong" },
];

const g = (id, sec, title, o = {}) => ({ id, sec, title, sub: "", room: "", done: [], product: "", dwell: "", time: "", steps: [], miss: "", body: "", good: "", bad: "", ...o });

export const DEFAULT = {
  focus: {
    title: "Glass with zero streaks.",
    body: "Before you tick any glass or mirror, crouch and look across it at an angle toward the light.",
    guide: "glass",
  },
  contact: { name: "Jack", phone: "0406 216 212" },
  rules: [
    "Fresh microfibre cloths at every home. Never one that's been used at another house.",
    "Never share a client's details, address or photos of their home. It's grounds for termination.",
    "24 hours' notice to change a shift, both ways.",
    "Bardon shirt, black shorts (men) or shorts or tights (women), clean enclosed sneakers.",
  ],
  guides: [
    g("kitchen", "rooms", "Kitchen", { sub: "All services", room: "kitchen|pantry",
      done: ["Benchtops, splashback and cooktop with no smears when you look across them", "Sink and tap dry and shining", "Cupboard fronts and handles free of fingerprints", "Floor clean right to the kickboards"],
      steps: ["Clear the benchtops and start any soaks (oven, filters)", "Work top to bottom, left to right", "Spray, move on while it dwells, come back to wipe", "Dry and buff every surface you wet", "Floor last, working toward the door"] }),
    g("bathroom", "rooms", "Bathroom", { sub: "All services", room: "bath|ensuite|toilet|powder", time: "45–55 min (detailed)",
      done: ["Zero streaks on glass and mirrors", "All fixtures dry and gleaming", "Grout clean", "Toilet spotless, including the base and behind it", "Floor dry, no slip hazard", "Smells fresh"],
      dwell: "Toilet 5–10 min · walls 2–3 min · tub 5–8 min · glass 5–10 min",
      steps: ["Prep and tidy (5–7 min): clear the space, pre-treat problem areas, turn on the fan or open a window", "Upper and wet areas (15–20 min): walls, shower and glass, top down", "Lower areas and fixtures (12–15 min): vanity, sink, tub, toilet", "Final polish (5–8 min): mirror, chrome, floor, last look"],
      miss: "Behind the toilet, the top of the shower screen frame and the tap base." }),
    g("glass", "rooms", "Windows, glass & mirrors", { sub: "All services", room: "window|glass|mirror",
      done: ["No streaks when you look across it at an angle toward the light", "No water spots or lint left on the surface", "Edges, frame tops and seals wiped, not just the middle"],
      dwell: "Shower glass 5–10 min",
      steps: ["Spray shower glass and leave it to dwell", "Scrub with a non-scratch pad, top to bottom", "Rinse from the top down", "Squeegee in overlapping strokes, wiping the blade each pass", "Buff with a dry, fresh glass cloth", "Crouch, look across at an angle, fix anything you see"],
      miss: "The top of the shower screen frame, and the bottom of a mirror where the vanity casts a shadow." }),
    g("bedrooms", "rooms", "Bedrooms", { sub: "All services", room: "bed|guest|nursery",
      done: ["Every surface dust-free, including tops of wardrobes and frames", "Mirrors streak-free", "Floor clean under and behind furniture you can move"],
      steps: ["Open blinds, lights on so you can see dust", "Dust top to bottom", "Wipe switches, handles and skirting", "Floor last, toward the door"] }),
    g("living", "rooms", "Living & dining", { sub: "All services", room: "living|dining|lounge|family|rumpus|study|office|hall|entry",
      done: ["No dust on any surface, including light fittings and skirting", "Glass and screens streak-free", "Floor clean edge to edge"],
      steps: ["Lights on, blinds open", "Dust top to bottom", "Switches, handles, door frames", "Floor last"] }),
    g("laundry", "rooms", "Laundry", { sub: "All services", room: "laundry",
      done: ["Tub and tap dry and shining", "Lint and dust gone from behind and around the machines", "Cupboards wiped inside and out"],
      steps: ["Clear the benches", "Top to bottom: cupboards, splashback, bench", "Tub and tap, then dry", "Floor last"] }),
    g("spray", "how", "Spray and move — dwell times", { sub: "1 min",
      body: "Apply product, move to the next surface while it works, then come back to scrub and wipe. Never scrub straight after spraying.",
      dwell: "Toilet 5–10 min · walls 2–3 min · tub 5–8 min · glass 5–10 min" }),
    g("gloves", "how", "When to change gloves", { sub: "1 min",
      body: "Plan on 3–4 pairs for a whole house: pair 1 for the bathroom, pair 2 for the kitchen, pair 3 for bedrooms and living areas.",
      steps: ["Change between bathroom, kitchen and living areas", "Change after toilets or anything sewage-related", "Change if a glove tears", "Change before handling a client's belongings"],
      miss: "You don't need a new pair for every room or surface." }),
    g("arrive", "how", "Arriving at a job", { sub: "2 min",
      steps: ["Be there at your start time, not later", "Read the job brief in the app before you go in", "Clock in in the app when you arrive", "Open a fresh cloth pack and set up your kit", "Open windows or turn on fans"] }),
    g("photos", "how", "Taking photos for the report", { sub: "1 min",
      body: "Your after photos go to Jack, who checks them before anything goes to the client.",
      steps: ["Take them when the room is finished, lights on", "Stand in the doorway and get the whole room", "Then the hero spots: benchtops, an open oven, the shower", "Nothing personal in shot: mail, photos, faces, house numbers"] }),
    g("leave", "how", "Leaving a job", { sub: "1 min",
      steps: ["All your rooms ticked off with photos", "Kit and products packed, used cloths bagged", "Our rubbish taken with us", "Lights, fans and air-con off", "Windows and doors locked", "Keys back where they belong", "Clock out in the app"] }),
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
  ],
};

const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const lines = (v, n, max) => (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : []).map((x) => str(x, n)).filter(Boolean).slice(0, max);
const IMG = /^[a-f0-9]{24}$/;

export function cleanContent(b) {
  const secs = new Set(SECTIONS.map((x) => x.id));
  const seen = new Set();
  const guides = (Array.isArray(b.guides) ? b.guides : []).slice(0, 80).map((x) => {
    let id = str(x.id, 24).replace(/[^\w-]/g, "") || Math.random().toString(36).slice(2, 10);
    while (seen.has(id)) id += "x";
    seen.add(id);
    return {
      id, sec: secs.has(x.sec) ? x.sec : "how", title: str(x.title, 80) || "Untitled", sub: str(x.sub, 60), room: str(x.room, 120),
      done: lines(x.done, 200, 12), product: str(x.product, 120), dwell: str(x.dwell, 160), time: str(x.time, 60),
      steps: lines(x.steps, 240, 30), miss: str(x.miss, 400), body: str(x.body, 1500),
      good: IMG.test(x.good || "") ? x.good : "", bad: IMG.test(x.bad || "") ? x.bad : "",
    };
  });
  const f = b.focus || {};
  return {
    focus: { title: str(f.title, 120), body: str(f.body, 400), guide: str(f.guide, 24) },
    contact: { name: str(b.contact?.name, 40) || "Jack", phone: str(b.contact?.phone, 30) },
    rules: lines(b.rules, 240, 12),
    guides,
  };
}

export async function loadContent(s) {
  const c = await s.get("teamapp");
  return c ? { ...DEFAULT, ...c } : { ...DEFAULT, starter: true };
}
