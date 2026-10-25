// Content for the team app (/me): this week's focus, the toolkit guides and the
// house rules. Jack edits all of it from the app itself (or Tools → Team app).
// Stored at "teamapp". Starter content below is a first draft for Jack to edit:
// product names are left blank on purpose.

import { GUIDES, wallPatch, visualPatch } from "./toolkit-content.mjs";

export const SECTIONS = [
  { id: "rooms", title: "How to clean each room", short: "Rooms" },
  { id: "premium", title: "Premium touches", short: "Premium" },
  { id: "tasks", title: "Deep jobs, step by step", short: "Deep jobs" },
  { id: "surfaces", title: "Surfaces: what's safe", short: "Surfaces" },
  { id: "kit", title: "Products & kit", short: "Products & kit" },
  { id: "services", title: "What each service needs", short: "Services" },
  { id: "how", title: "How we work", short: "How we work" },
  { id: "safety", title: "Staying safe", short: "Safety" },
  { id: "wrong", title: "Something's gone wrong", short: "Problems" },
];

// Bump when new starter guides are added, so saved content picks them up.
export const KIT_V = 5;

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
  // The welcome tour new team members see the first time they open the app.
  // *word* shows in italics. home: true is the "add to home screen" step (its steps are built in per phone).
  tourV: 1,
  tour: [
    { k: "Welcome", ic: "home", t: "Welcome to the *team app*", b: ["Everything you need for a shift, in one place.", "No more scrolling back through texts for an address, a gate code or what the client asked for.", "Here's a quick look around. It takes a minute."] },
    { k: "Shifts", ic: "job", t: "Your shifts, *confirmed* in one tap", b: ["New shifts show on Today with I'll be there and Can't.", "If you can't make it, Jack hears straight away.", "All your upcoming shifts are on the Me tab."] },
    { k: "On the day", ic: "clock", t: "On the day, the app *walks you through it*", b: ["Read the job brief: address, getting in, parking, and what the client wants.", "Clock in when you arrive.", "Open your rooms and tick each step as you go. Take your after photos, then finish the room.", "Flag anything: damage, a stain that won't shift, extra work, or supplies running low.", "Wrap up and clock out before you leave."] },
    { k: "Toolkit", ic: "kit", t: "Never guess *how it's done*", b: ["The Toolkit has how we clean every room, what \"done\" looks like, dwell times and what's easy to miss.", "It also covers what to do if something goes wrong.", "Jack keeps it up to date, so it's always the current standard."] },
    { k: "Your pay", ic: "me", t: "Your pay, *all in one place*", b: ["Every payslip: hours, rates, tax and super, shift by shift.", "Your totals for the financial year.", "An estimate of this week's pay from your rostered shifts."] },
    { k: "Home screen", ic: "home", t: "Put it on your *home screen*", b: ["So it opens like any other app, straight to your shifts."], home: true },
  ],
  kitV: KIT_V,
  timers: {},
  guides: GUIDES,
};

const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const lines = (v, n, max) => (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : []).map((x) => str(x, n)).filter(Boolean).slice(0, max);
const IMG = /^[a-f0-9]{24}$/;

export function cleanContent(b) {
  const secs = new Set(SECTIONS.map((x) => x.id));
  const seen = new Set();
  const guides = (Array.isArray(b.guides) ? b.guides : []).slice(0, 200).map((x) => {
    let id = str(x.id, 24).replace(/[^\w-]/g, "") || Math.random().toString(36).slice(2, 10);
    while (seen.has(id)) id += "x";
    seen.add(id);
    return {
      id, sec: secs.has(x.sec) ? x.sec : "how", title: str(x.title, 80) || "Untitled", sub: str(x.sub, 60), room: str(x.room, 120),
      done: lines(x.done, 200, 20), kit: lines(x.kit, 120, 40), product: str(x.product, 120), dwell: str(x.dwell, 160), time: str(x.time, 60),
      steps: lines(x.steps, 240, 40),
      pics: (Array.isArray(x.pics) ? x.pics : []).slice(0, 40).map((v) => (typeof v === "string" && (IMG.test(v) || /^art:[a-z0-9]{1,12}$/.test(v)) ? v : "")),
      never: lines(x.never, 200, 12), miss: str(x.miss, 400), body: str(x.body, 1500),
      good: IMG.test(x.good || "") ? x.good : "", bad: IMG.test(x.bad || "") ? x.bad : "",
      map: /^art:m[a-z]{1,11}$/.test(x.map || "") ? x.map : "", spots: lines(x.spots, 120, 9),
      pairs: (Array.isArray(x.pairs) ? x.pairs : []).filter((v) => typeof v === "string" && /^art:pf[a-z]{1,10}$/.test(v)).slice(0, 8),
    };
  });
  const f = b.focus || {};
  const ICONS = ["home", "job", "clock", "kit", "me", "phone", "flag", "cam"];
  let tour = (Array.isArray(b.tour) ? b.tour : DEFAULT.tour).slice(0, 12).map((x) => ({
    k: str(x.k, 30), ic: ICONS.includes(x.ic) ? x.ic : "home", t: str(x.t, 120) || "Untitled", b: lines(x.b, 240, 8), ...(x.home ? { home: true } : {}), ...(x.off ? { off: true } : {}),
  }));
  if (!tour.some((x) => x.home)) tour.push({ ...DEFAULT.tour[DEFAULT.tour.length - 1] });
  tour = tour.filter((x) => !x.home).concat(tour.filter((x) => x.home).slice(0, 1)); // home screen step always last
  const tv = Math.max(1, Math.min(9999, parseInt(b.tourV, 10) || 1));
  const timers = {};
  if (b.timers && typeof b.timers === "object") for (const [k, v] of Object.entries(b.timers).slice(0, 200)) {
    const id = String(k).replace(/[^\w-]/g, "").slice(0, 24), n = Number(v);
    if (id && isFinite(n) && n >= 0 && n <= 180) timers[id] = Math.round(n * 2) / 2;
  }
  return {
    tourV: tv, tour, kitV: Math.max(1, parseInt(b.kitV, 10) || 1), timers,
    focus: { title: str(f.title, 120), body: str(f.body, 400), guide: str(f.guide, 24) },
    contact: { name: str(b.contact?.name, 40) || "Jack", phone: str(b.contact?.phone, 30) },
    rules: lines(b.rules, 240, 12),
    guides,
  };
}

export async function loadContent(s) {
  const c = await s.get("teamapp");
  if (!c) return { ...DEFAULT, starter: true };
  const out = { ...DEFAULT, ...c, tour: c.tour || DEFAULT.tour, tourV: c.tourV || 1, timers: c.timers || {} };
  // Saved before newer starter guides existed: add the missing ones, keep every edit.
  if ((c.kitV || 1) < KIT_V) {
    const have = new Set((c.guides || []).map((x) => x.id));
    let saved = c.guides || [];
    // v4: wall washing worked into the guides Jack already has, keeping his edits.
    if ((c.kitV || 1) < 4) saved = saved.map(wallPatch);
    // v5: pass/redo drawings and easy-to-miss maps, keeping his edits.
    if ((c.kitV || 1) < 5) saved = saved.map(visualPatch);
    // New starter guides go in after the guide they follow in the starter list.
    out.guides = saved.slice();
    GUIDES.forEach((x, i) => {
      if (have.has(x.id)) return;
      const prev = i > 0 ? out.guides.findIndex((y) => y.id === GUIDES[i - 1].id) : -1;
      out.guides.splice(prev < 0 ? out.guides.length : prev + 1, 0, x);
      have.add(x.id);
    });
    out.kitV = KIT_V;
  }
  return out;
}
