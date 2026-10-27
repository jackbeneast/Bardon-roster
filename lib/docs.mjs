// Quotes and invoices: shared data logic for the docs and pay functions.
import { randomBytes } from "node:crypto";
import { loadRoster, daysOf, foldProgress } from "./core.mjs";
import { QLD_PH } from "../public/lib/wages.mjs";

export const tok = () => randomBytes(18).toString("hex");
export const id = (p) => p + Date.now().toString(36) + randomBytes(3).toString("hex");
const r2 = (v) => Math.round(v * 100) / 100;
export const today = () => new Date(Date.now() + 10 * 3600e3).toISOString().slice(0, 10); // Brisbane date
export const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// Room-by-room scope for each service. Headings like "Bedrooms ({beds})" pick up the
// bedroom and bathroom counts when the scope fills in (see sizeScope), so a 3 bed 2 bath
// quote reads "Bedrooms (3)" and "Bathrooms (2)". A line starting "- " is a bullet;
// any other line is a heading.
const PRESALE_SCOPE = `Every room, every area, presented for photos and open homes. Each area below is cleaned in full.

Kitchen
- Benchtops cleared, scrubbed and polished
- Splashback degreased and polished
- Cooktop degreased and polished
- Oven cleaned inside and out
- Rangehood exterior degreased, exhaust fan covers dusted
- Sink and drainer scrubbed, plughole cleaned
- Taps and mixers descaled and polished
- Stainless steel polished streak-free
- Cupboard and drawer fronts, handles and kickboards wiped
- Dishwasher and appliance fronts wiped
- Walls spot-cleaned
- Light switches and power points wiped
- Floor vacuumed and mopped, edges and corners included

Bathrooms ({baths})
- Shower screen and tiles scrubbed, soap scum removed
- Shower head, taps and fixtures descaled and polished
- Bath scrubbed, including surrounds
- Toilet cleaned and sanitised inside and out, including base, seat and hinges
- Vanity basin, benchtop and cabinet fronts cleaned
- Mirrors polished streak-free
- Towel rails and toilet roll holders wiped
- Exhaust fan covers dusted
- Walls spot-cleaned
- Floor scrubbed and mopped, including corners and behind the toilet

Laundry
- Laundry tub scrubbed, tap descaled and polished
- Benchtops and cabinet fronts wiped
- Walls spot-cleaned
- Floor vacuumed and mopped

Bedrooms ({beds})
- Wardrobe doors and exteriors wiped, mirrored doors polished
- Walls spot-cleaned
- Skirting boards wiped
- Ceiling fans and light fittings cleaned
- Doors, door frames and handles wiped
- Light switches and power points wiped
- Floors vacuumed and mopped, carpets vacuumed to the edges

Living & Dining
- Walls spot-cleaned
- Skirting boards wiped
- Ceiling fans and light fittings cleaned
- Built-in cabinetry and shelving exteriors wiped
- Doors, door frames and handles wiped
- Light switches and power points wiped
- Floors vacuumed and mopped, carpets vacuumed to the edges

Entry, Hallways & Stairs
- Front door (inside) and handles wiped
- Linen and hall cupboard exteriors wiped
- Stair handrails and balustrades wiped
- Walls spot-cleaned
- Skirting boards wiped
- Light switches and power points wiped
- Floors and stairs vacuumed and mopped`;

const BOND_SCOPE = `A full exit clean of the empty property, to your agent's checklist. Each area below is cleaned in full, inside and out.

Kitchen
- Cupboards and drawers cleaned inside and out, including shelves and runners
- Pantry shelves cleaned
- Benchtops and splashback scrubbed and polished
- Cooktop degreased and polished
- Oven cleaned inside and out
- Rangehood degreased inside and out, exhaust fan covers dusted
- Dishwasher wiped inside and out, filter cleaned
- Sink and drainer scrubbed, plughole cleaned
- Taps and mixers descaled and polished
- Stainless steel polished streak-free
- Walls spot-cleaned
- Light switches and power points wiped
- Floor vacuumed and mopped, edges and corners included

Bathrooms ({baths})
- Shower screen and tiles scrubbed, soap scum removed
- Grout scrubbed
- Shower head, taps and fixtures descaled and polished
- Bath scrubbed, including surrounds
- Toilet cleaned and sanitised inside and out, including base, seat and hinges
- Vanity basin and benchtop cleaned, cabinets cleaned inside and out
- Mirrors polished streak-free
- Towel rails and toilet roll holders wiped
- Exhaust fan covers dusted
- Walls spot-cleaned
- Floor scrubbed and mopped, including corners and behind the toilet

Laundry
- Laundry tub scrubbed, tap descaled and polished
- Cabinets cleaned inside and out
- Washing machine space cleaned
- Walls spot-cleaned
- Floor vacuumed and mopped

Bedrooms ({beds})
- Wardrobes cleaned inside and out, including shelves, hanging rails and tracks
- Mirrored wardrobe doors polished
- Walls spot-cleaned
- Skirting boards wiped
- Ceiling fans and light fittings cleaned
- Doors, door frames and handles wiped
- Light switches and power points wiped
- Floors vacuumed and mopped, carpets vacuumed to the edges

Living & Dining
- Built-in cabinetry and shelving cleaned inside and out
- Walls spot-cleaned
- Skirting boards wiped
- Ceiling fans and light fittings cleaned
- Doors, door frames and handles wiped
- Light switches and power points wiped
- Floors vacuumed and mopped, carpets vacuumed to the edges

Entry, Hallways & Stairs
- Front door (inside) and handles wiped
- Linen and hall cupboards cleaned inside and out
- Stair handrails and balustrades wiped
- Walls spot-cleaned
- Skirting boards wiped
- Light switches and power points wiped
- Floors and stairs vacuumed and mopped`;

const DEEP_SCOPE = `A full reset, top to bottom. Each area below is cleaned in full, with extra time on the build-up a regular clean doesn't reach.

Kitchen
- Benchtops cleared, scrubbed and polished
- Splashback degreased and polished
- Cooktop degreased and polished
- Oven cleaned inside and out
- Rangehood exterior degreased, exhaust fan covers dusted
- Microwave cleaned inside and out
- Cupboard and drawer interiors wiped where cleared beforehand
- Cupboard and drawer fronts, handles and kickboards wiped
- Sink and drainer scrubbed, plughole cleaned
- Taps and mixers descaled and polished
- Stainless steel polished streak-free
- Walls spot-cleaned
- Light switches and power points wiped
- Floor vacuumed and mopped, edges and corners included

Bathrooms ({baths})
- Shower screen and tiles scrubbed, soap scum removed
- Grout scrubbed
- Shower head, taps and fixtures descaled and polished
- Bath scrubbed, including surrounds
- Toilet cleaned and sanitised inside and out, including base, seat and hinges
- Vanity basin, benchtop and cabinet fronts cleaned
- Mirrors polished streak-free
- Towel rails and toilet roll holders wiped
- Exhaust fan covers dusted
- Walls spot-cleaned
- Floor scrubbed and mopped, including corners and behind the toilet

Laundry
- Laundry tub scrubbed, tap descaled and polished
- Benchtops and cabinet fronts wiped
- Walls spot-cleaned
- Floor vacuumed and mopped

Bedrooms ({beds})
- Bedside tables, dressers and surfaces dusted and wiped
- Wardrobe doors and exteriors wiped, mirrored doors polished
- Walls spot-cleaned
- Skirting boards wiped
- Ceiling fans and light fittings cleaned
- Doors, door frames and handles wiped
- Light switches and power points wiped
- Floors vacuumed and mopped, carpets vacuumed to the edges

Living & Dining
- Furniture and surfaces dusted and wiped
- Built-in cabinetry and shelving exteriors wiped
- Walls spot-cleaned
- Skirting boards wiped
- Ceiling fans and light fittings cleaned
- Doors, door frames and handles wiped
- Light switches and power points wiped
- Floors vacuumed and mopped, carpets vacuumed to the edges

Entry, Hallways & Stairs
- Front door (inside) and handles wiped
- Linen and hall cupboard exteriors wiped
- Stair handrails and balustrades wiped
- Walls spot-cleaned
- Skirting boards wiped
- Light switches and power points wiped
- Floors and stairs vacuumed and mopped`;

const REGULAR_SCOPE = `Your home kept consistently clean, visit after visit. Each area below is covered every visit.

Kitchen
- Benchtops and splashback wiped and polished
- Cooktop wiped and degreased
- Sink and taps cleaned and polished
- Microwave wiped inside and out
- Appliance fronts and cupboard fronts spot-cleaned
- Floor vacuumed and mopped

Bathrooms ({baths})
- Shower, screen and tiles cleaned
- Bath cleaned
- Toilet cleaned and sanitised inside and out
- Vanity basin and benchtop cleaned
- Mirrors polished streak-free
- Taps and fixtures polished
- Floor vacuumed and mopped

Laundry
- Laundry tub and benchtops wiped
- Floor vacuumed and mopped

Bedrooms ({beds})
- Surfaces dusted and wiped
- Beds made (linen changed if left out)
- Mirrors polished
- Floors vacuumed and mopped

Living & Dining
- Surfaces, shelving and furniture dusted and wiped
- Dining table and chairs wiped
- Floors vacuumed and mopped

Throughout
- Light switches and door handles wiped
- Bins emptied`;

// Priced-by-area items, for clients who want the cost of each area on its own.
// Titles start "Area: " so the "+ Price by area" picker can find them. Each one spells
// out what's in, what isn't, and roughly how long it takes on site.
const AREA_NOT = "Not included unless requested and quoted: window cleaning";
const AREA_TIME = (t) => `Allow around ${t} on site. Every home is different, so this can vary with the size and condition of the area.`;
const AREAS = [
  { id: "akitchen", title: "Area: Kitchen, oven included", desc: `Kitchen
- Benchtops cleared, scrubbed and polished
- Splashback degreased and polished
- Cooktop degreased and polished
- Oven cleaned inside and out, racks and trays included
- Rangehood exterior degreased, exhaust fan covers dusted
- Sink and drainer scrubbed, plughole cleaned
- Taps and mixers descaled and polished
- Stainless steel polished streak-free
- Cupboard and drawer exteriors, handles and kickboards wiped
- Dishwasher and appliance fronts wiped
- Walls spot-cleaned
- Light switches and power points wiped
- Floor vacuumed and mopped, edges and corners included
We clean all cupboard and drawer exteriors. ${AREA_NOT}, or inside cupboards, drawers and the pantry.
${AREA_TIME("4 hours")}` },
  { id: "abathroom", title: "Area: Bathroom", desc: `Bathroom
- Shower screen and tiles scrubbed, soap scum removed
- Shower head, taps and fixtures descaled and polished
- Bath scrubbed, including surrounds
- Toilet cleaned and sanitised inside and out, including base, seat and hinges
- Vanity basin, benchtop and cabinet exteriors cleaned
- Mirrors polished streak-free
- Towel rails and toilet roll holders wiped
- Exhaust fan covers dusted
- Walls spot-cleaned
- Floor scrubbed and mopped, including corners and behind the toilet
We clean all cabinet exteriors. ${AREA_NOT}, or inside vanity cabinets and drawers.
${AREA_TIME("3 hours per bathroom")}` },
  { id: "atoilet", title: "Area: Separate toilet", desc: `Toilet
- Toilet cleaned and sanitised inside and out, including base, seat and hinges
- Cistern and buttons wiped
- Toilet roll holder wiped
- Hand basin and tap cleaned, if there is one
- Walls spot-cleaned
- Floor scrubbed and mopped, including behind the toilet
${AREA_NOT}.
${AREA_TIME("30 minutes")}` },
  { id: "alaundry", title: "Area: Laundry", desc: `Laundry
- Laundry tub scrubbed, tap descaled and polished
- Benchtops and cabinet exteriors wiped
- Washing machine and dryer exteriors wiped
- Walls spot-cleaned
- Light switches and power points wiped
- Floor vacuumed and mopped
We clean all cabinet exteriors. ${AREA_NOT}, or inside cabinets.
${AREA_TIME("1 hour")}` },
  { id: "aliving", title: "Area: Living area, top to bottom", desc: `Living area
- Cobwebs removed from ceilings and corners
- Ceiling fans and light fittings cleaned
- Furniture and surfaces dusted and wiped
- Built-in cabinetry and shelving exteriors wiped
- Walls spot-cleaned
- Skirting boards wiped
- Doors, door frames and handles wiped
- Light switches and power points wiped
- Floors vacuumed and mopped, carpets vacuumed to the edges
${AREA_NOT}.
${AREA_TIME("2 hours")}` },
];

// Optional extras, each as its own line item.
const EXTRAS = [
  { id: "xwindows", title: "Extra: windows and tracks", desc: "- Internal window glass cleaned streak-free\n- Window frames and sills wiped\n- Window and sliding door tracks vacuumed and cleaned" },
  { id: "xoven", title: "Extra: oven deep clean", desc: "- Oven interior degreased to remove baked-on build-up\n- Racks and trays soaked and scrubbed\n- Door and glass cleaned" },
  { id: "xcupboards", title: "Extra: inside cupboards and drawers", desc: "- Cupboards and drawers cleaned inside, including shelves and runners\n- Pantry shelves cleaned\n- Cupboards and drawers need to be emptied before we arrive" },
  { id: "xfridge", title: "Extra: fridge inside", desc: "- Shelves, drawers and door compartments removed and washed\n- Interior wiped and dried\n- Seals wiped" },
  { id: "xblinds", title: "Extra: blinds or shutters", desc: "- Blinds or shutters dusted slat by slat\n- Wiped down where the finish allows" },
  { id: "xwalls", title: "Extra: walls washed", desc: "- Walls washed throughout, beyond spot-cleaning\n- Marks lifted where the paint allows" },
  { id: "xbalcony", title: "Extra: balcony or patio", desc: "- Floor swept and mopped\n- Railings and balustrades wiped\n- Outdoor light fittings dusted" },
  { id: "xgarage", title: "Extra: garage", desc: "- Floor swept\n- Cobwebs removed\n- Shelving and surfaces dusted" },
];
const OLD_PRESALE_START = "Bathrooms & Laundry\n- Shower screens and tiles scrubbed";
const WINDOWS_NOTE = "Window glass, frames and tracks aren't included in this scope. They can be added as an extra if you'd like them done.";

// ---- Package options: three tiers on pre-sale and deep clean quotes ----
// Each tier is a scope plus an hours formula (base + per bedroom + per bathroom).
// The price is hours x Jack's hourly rate, ex GST. The rate and the hours are internal:
// clients only ever see the package price.
const dropLines = (t, res) => t.split("\n").filter((l) => !res.some((r) => r.test(l))).join("\n");
const subLine = (t, re, line) => t.split("\n").map((l) => (re.test(l) ? line : l)).join("\n");
const firstLine = (t, line) => { const L = t.split("\n"); L[0] = line; return L.join("\n"); };
const PK_WINDOWS = `Windows & tracks
- Internal window glass cleaned streak-free
- Window frames and sills wiped
- Window and sliding door tracks vacuumed and cleaned`;
const PK_CUPBOARDS = `Inside cupboards & drawers
- Kitchen cupboards and drawers cleaned inside, including shelves and runners
- Pantry shelves cleaned
- Vanity and laundry cabinets cleaned inside
- Cupboards and drawers need to be emptied before we arrive`;
const PK_OUTDOOR = `Outdoor areas
- Ground-floor external windows cleaned
- Decks, balconies and patio swept and mopped, railings wiped
- Front entry and porch swept, front door wiped outside
- Garage floor swept and cobwebs removed
- Cobwebs removed from eaves, outdoor light fittings dusted
Windows above the ground floor are cleaned internally only.`;
const PK_SKIRT = [/^- Skirting boards wiped$/, /^- Light switches and power points wiped$/];
const PRESALE_ESS = firstLine(
  dropLines(subLine(PRESALE_SCOPE, /^- Oven cleaned inside and out$/, "- Oven door, glass and exterior wiped"), PK_SKIRT),
  "Every internal area cleaned and presented for photos and open homes.",
) + "\n\nNot included in this package: window glass, frames and tracks, the inside of the oven, inside cupboards and drawers, skirting boards, and outdoor areas.";
const PRESALE_SIG = firstLine(PRESALE_SCOPE, "Every internal area cleaned in full and presented for photos and open homes.") +
  "\n\n" + PK_WINDOWS + "\n\n" + PK_CUPBOARDS + "\n\nNot included in this package: outdoor areas and external windows.";
const PRESALE_COM = firstLine(PRESALE_SCOPE, "Top to bottom, inside and out, presented for photos and open homes.") +
  "\n\n" + PK_WINDOWS + "\n\n" + PK_CUPBOARDS + "\n\n" + PK_OUTDOOR;
const DEEP_BASE = dropLines(DEEP_SCOPE, [/^- Cupboard and drawer interiors wiped/]);
const DEEP_ESS = firstLine(DEEP_BASE, "A thorough internal deep clean, top to bottom. Each area below is cleaned in full, with extra time on the build-up a regular clean doesn't reach.") +
  "\n\nNot included in this package: window glass, frames and tracks, inside cupboards and drawers, and outdoor areas.";
const DEEP_SIG = DEEP_BASE + "\n\n" + PK_WINDOWS + "\n\n" + PK_CUPBOARDS + "\n\nNot included in this package: outdoor areas and external windows.";
const DEEP_COM = firstLine(DEEP_BASE, "A full reset, inside and out. Each area below is cleaned in full, with extra time on the build-up a regular clean doesn't reach.") +
  "\n\n" + PK_WINDOWS + "\n\n" + PK_CUPBOARDS + "\n\n" + PK_OUTDOOR;
const PK_OUT_POINTS = "Ground-floor external windows\nDecks, balconies and patio\nFront entry, garage and exterior cobwebs";
export const PKG_SERVICES = ["Pre-sale clean", "Deep clean"];
export const PK_DEFAULTS = {
  rate: 110,
  svc: {
    "Pre-sale clean": [
      { key: "essential", name: "Essential", rec: false, base: 7, bed: 1, bath: 3, inc: [],
        blurb: "Every internal area cleaned for market, on a tighter budget.",
        points: "Kitchen, bathrooms, laundry, bedrooms, living and entry\nNo windows, oven interior or inside cupboards\nNo outdoor areas", desc: PRESALE_ESS },
      { key: "signature", name: "Signature", rec: true, base: 11.5, bed: 1.75, bath: 3.25, inc: ["xwindows", "xcupboards", "xoven"],
        blurb: "The full internal presentation clean for photos and open homes.",
        points: "Everything in Essential\nFull oven clean, inside and out\nInternal windows, frames and tracks\nInside cupboards and drawers\nSkirting boards and light switches throughout", desc: PRESALE_SIG },
      { key: "complete", name: "Complete", rec: false, base: 16, bed: 1.75, bath: 3.25, inc: ["xwindows", "xcupboards", "xoven", "xbalcony", "xgarage"],
        blurb: "Top to bottom, inside and out.",
        points: "Everything in Signature\n" + PK_OUT_POINTS, desc: PRESALE_COM },
    ],
    "Deep clean": [
      { key: "essential", name: "Essential", rec: false, base: 8, bed: 1, bath: 3, inc: [],
        blurb: "A thorough internal deep clean.",
        points: "Every internal area deep cleaned\nOven, microwave and grout included\nNo windows, inside cupboards or outdoor areas", desc: DEEP_ESS },
      { key: "signature", name: "Signature", rec: true, base: 11, bed: 1.5, bath: 3.25, inc: ["xwindows", "xcupboards"],
        blurb: "The deep clean plus windows, tracks and inside every cupboard.",
        points: "Everything in Essential\nInternal windows, frames and tracks\nInside cupboards and drawers", desc: DEEP_SIG },
      { key: "complete", name: "Complete", rec: false, base: 15.5, bed: 1.5, bath: 3.25, inc: ["xwindows", "xcupboards", "xbalcony", "xgarage"],
        blurb: "A full reset, inside and out.",
        points: "Everything in Signature\n" + PK_OUT_POINTS, desc: DEEP_COM },
    ],
  },
};

const strArr = (a, n = 20, m = 40) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => (typeof x === "string" ? x.slice(0, m) : "")).filter(Boolean);
function cleanTierSet(t) {
  const n = (v, hi) => { const x = Number(v); return isFinite(x) && x >= 0 ? Math.min(hi, Math.round(x * 100) / 100) : 0; };
  return {
    key: (typeof t?.key === "string" && t.key.slice(0, 20)) || id("t"), name: (t?.name || "").toString().slice(0, 40), rec: !!t?.rec,
    base: n(t?.base, 500), bed: n(t?.bed, 50), bath: n(t?.bath, 50), inc: strArr(t?.inc),
    blurb: (t?.blurb || "").toString().slice(0, 200), points: (t?.points || "").toString().slice(0, 800), desc: (t?.desc || "").toString().slice(0, 8000),
  };
}
function oneRec(tiers) { let seen = false; for (const t of tiers) { if (t.rec && !seen) seen = true; else t.rec = false; } if (!seen && tiers.length) tiers[Math.min(1, tiers.length - 1)].rec = true; return tiers; }
export function cleanPkSettings(p) {
  const r = Number(p?.rate);
  const o = { rate: isFinite(r) && r > 0 ? Math.min(1000, Math.round(r * 100) / 100) : PK_DEFAULTS.rate, svc: {} };
  for (const s of PKG_SERVICES) {
    const tiers = (Array.isArray(p?.svc?.[s]) ? p.svc[s] : PK_DEFAULTS.svc[s]).slice(0, 4).map(cleanTierSet).filter((t) => t.name);
    o.svc[s] = oneRec(tiers.length ? tiers : PK_DEFAULTS.svc[s].map(cleanTierSet));
  }
  return o;
}
// Hours for a tier at this size, to the nearest half hour.
export function pkHours(t, beds, baths) { return Math.round(((+t.base || 0) + (+t.bed || 0) * (+beds || 0) + (+t.bath || 0) * (+baths || 0)) * 2) / 2; }

// A quote's own packages: tiers frozen at the price Jack quoted, plus the add-ons offered.
function cleanPk(p) {
  if (!p || typeof p !== "object" || p.baked || !Array.isArray(p.tiers) || !p.tiers.length) return null;
  const n = (v, hi) => { const x = Number(v); return isFinite(x) && x >= 0 ? Math.min(hi, r2(x)) : 0; };
  const tiers = oneRec(p.tiers.slice(0, 4).map((t) => ({
    key: (typeof t?.key === "string" && t.key.slice(0, 20)) || id("t"), name: String(t?.name || "").slice(0, 40), rec: !!t?.rec,
    blurb: String(t?.blurb || "").slice(0, 200), points: String(t?.points || "").slice(0, 800), desc: String(t?.desc || "").slice(0, 8000),
    hrs: n(t?.hrs, 1000), price: n(t?.price, 1e6), inc: strArr(t?.inc),
  })).filter((t) => t.name));
  if (!tiers.length) return null;
  const addons = (Array.isArray(p.addons) ? p.addons : []).slice(0, 20).map((a) => ({
    id: String(a?.id || "").slice(0, 40) || id("x"), title: String(a?.title || "").slice(0, 120), desc: String(a?.desc || "").slice(0, 2000), price: n(a?.price, 1e5),
  })).filter((a) => a.title);
  return { tiers, addons, pick: tiers.some((t) => t.key === p.pick) ? p.pick : "", manual: !!p.manual };
}
export function pkLive(d) { return !!(d && d.kind === "quote" && d.pk && !d.pk.baked && Array.isArray(d.pk.tiers) && d.pk.tiers.length); }
export function pkTier(d, key) { const T = d.pk.tiers; return T.find((t) => t.key === key) || T.find((t) => t.key === d.pk.pick) || T.find((t) => t.rec) || T[0]; }
const sizeTag = (d) => [d.beds ? d.beds + " bed" : "", d.baths ? d.baths + " bath" : ""].filter(Boolean).join(" ");
const addTitle = (a) => String(a.title || "").replace(/^extra:\s*/i, "").replace(/^./, (c) => c.toUpperCase());
// The line items a package choice becomes: the package, any priced add-ons, any
// unpriced add-ons as "to be priced" lines, then Jack's other items on the quote.
export function pkItems(d, key, add) {
  const t = pkTier(d, key), inc = new Set(t.inc || []), size = sizeTag(d);
  const adds = [...new Set(strArr(add))].map((x) => d.pk.addons.find((a) => a.id === x)).filter((a) => a && !inc.has(a.id));
  return [
    { title: `${d.service || "Clean"} · ${t.name} package${size ? " | " + size : ""}`, desc: t.desc, qty: 1, price: t.price },
    ...adds.filter((a) => a.price > 0).map((a) => ({ title: addTitle(a), desc: a.desc, qty: 1, price: a.price })),
    ...adds.filter((a) => !(a.price > 0)).map((a) => ({ title: "Also requested: " + addTitle(a).toLowerCase(), desc: a.desc + "\nPriced to your home. Jack will confirm the price for this with you before the clean.", qty: 1, price: 0 })),
    ...(d.items || []),
  ];
}
export function effItems(d) { return pkLive(d) ? pkItems(d) : (d.items || []); }
// Lock in the client's choice: the quote becomes ordinary line items from here on, so
// deposits, invoices and the roster work exactly as they do for any quote.
export function bakePackage(q, key, add) {
  if (!pkLive(q)) return null;
  const t = pkTier(q, key), inc = new Set(t.inc || []);
  const ids = [...new Set(strArr(add))].filter((x) => q.pk.addons.some((a) => a.id === x) && !inc.has(x));
  const items0 = q.items || [];
  q.items = pkItems(q, t.key, ids);
  q.pk = { ...q.pk, pick: t.key, add: ids, baked: new Date().toISOString(), items0 };
  return t;
}
// "Undo accepted": put the package options back as they were.
export function unbakePackage(q) {
  if (!q || !q.pk || !q.pk.baked || !Array.isArray(q.pk.items0) || (q.special && q.special.baked)) return false;
  q.items = q.pk.items0;
  const { baked, items0, add, ...rest } = q.pk; q.pk = rest;
  return true;
}
export function pkChosen(d) { return d && d.pk && d.pk.baked ? (d.pk.tiers.find((t) => t.key === d.pk.pick) || null) : null; }

// Fill bedroom and bathroom counts into a scope's headings.
export function sizeScope(t, beds, baths) {
  return String(t || "").replace(/^(.*?)\s*\(\{(beds|baths)\}\)\s*$/gm, (m, head, k) => {
    const n = +(k === "beds" ? beds : baths) || 0;
    if (!n) return head;
    return n === 1 ? head.replace(/s$/, "") : `${head} (${n})`;
  });
}

const PHOTO_CLAUSE = `Photos & Social Media
- We may take photos or short videos of the property during or after the clean to promote Bardon Clean online, including on our website and social media.
- We only capture the cleaning work itself, such as before-and-after shots of rooms and surfaces.
- We never capture people, pets, family photos, documents, mail, valuables, keys, security systems, house numbers, street views, or anything else that could identify you or your property, and we never share or tag the address.
- If you'd prefer we don't take any photos or videos, just let us know before the clean and we'll respect that.`;

const GUARANTEE = `Our Guarantee
- Every clean comes with a comprehensive job report detailing the work completed.
- Pre-sale and deep cleans: we encourage a final walkthrough with you on completion, so anything you'd like touched up can be addressed while we're on site. These services don't include a return visit.
- Bond cleans: as the agency often won't inspect the property for several days, if your agent raises anything within the quoted scope within 3 days of completion, we'll return to rectify it at no additional cost.
- This guarantee covers the original quoted scope only and excludes normal wear and tear, pre-existing damage, and issues arising after completion.`;

const POLICIES = `Bookings & Payments
- A 50% deposit is required to secure all bookings. Appointments are not confirmed until the deposit has been received.
- The remaining balance is due upon completion of the service on the day, unless otherwise agreed in writing.
- Payments can be made via bank transfer, card, or other approved methods.

Cancellations & Rescheduling
- We require a minimum of 24 hours' notice for any cancellations or rescheduling.
- Cancellations made within 24 hours of the booking may result in forfeiture of the deposit.
- We understand things come up and will always aim to be reasonable where possible.

Access to Property
- Clients must ensure safe and timely access to the property at the scheduled time.
- If access is not provided, a call-out fee or partial service charge may apply.

Scope of Work
- Our quotes are based on the condition of the property as described or shown at the time of booking.
- If the condition is significantly different (e.g. heavier buildup, additional areas), we will discuss any required adjustments before proceeding.
- Additional services requested on the day may incur extra charges.

${GUARANTEE}

Results Disclaimer (Especially for Deep/Bond Cleans)
- While we aim to achieve the best possible outcome, some stains, wear, or damage (e.g. permanent grout staining, aged surfaces, carpet wear) may not be fully reversible.
- We do not guarantee a "brand new" result where materials are worn or damaged beyond restoration.

Health & Safety
- We reserve the right to refuse or stop work if the environment is deemed unsafe (e.g. hazardous waste, aggressive animals, unsafe structures).
- Clients must disclose any risks or hazards prior to the service.

Equipment & Utilities
- Clients are required to provide access to electricity and running water.

${PHOTO_CLAUSE}`;

export const DEFAULTS = {
  biz: { name: "Bardon Clean", legal: "Jack East T/A Bardon Clean", abn: "46 426 437 394", address: "49 Empress Terrace, Bardon QLD 4065", phone: "0406 216 212", sms: "0468 193 772", email: "hello@bardonclean.au", web: "www.bardonclean.au" },
  bank: { name: "Bardon Clean", bsb: "067-873", acct: "18976363" },
  booking: { perDay: 1, lead: 2, weeks: 6, sat: false },
  gst: true, nextQuote: 172, nextInvoice: 259, depositPct: 50, quoteValidDays: 30, invoiceDueDays: 0,
  terms: POLICIES,
  prices: {},
  pk: PK_DEFAULTS,
  library: [
    { id: "lpresale", title: "Pre-sale clean", desc: PRESALE_SCOPE, price: 0, service: "Pre-sale clean" },
    { id: "lbond", title: "Bond / end-of-lease clean", desc: BOND_SCOPE, price: 0, service: "Bond clean" },
    { id: "ldeep", title: "Deep clean", desc: DEEP_SCOPE, price: 0, service: "Deep clean" },
    { id: "lregular", title: "Regular clean", desc: REGULAR_SCOPE, price: 0, service: "Regular clean" },
    { id: "ldeposit", title: "50% deposit to secure booking", desc: depositDesc(50, "clean"), price: 0 },
    { id: "lnowin", title: "Note: windows", desc: WINDOWS_NOTE, price: 0 },
    ...AREAS.map((x) => ({ ...x, price: 0 })),
    ...EXTRAS.map((x) => ({ ...x, price: 0 })),
  ],
};

// Replace the guarantee section (heading containing "Guarantee" plus its bullets) with the current one.
function swapGuarantee(t) {
  const lines = t.split("\n"); const i = lines.findIndex((l) => !/^\s*-/.test(l) && /guarantee/i.test(l));
  if (i < 0) { const r = lines.findIndex((l) => /^Results Disclaimer/i.test(l)); if (r < 0) return t.trimEnd() + "\n\n" + GUARANTEE; lines.splice(r, 0, GUARANTEE, ""); return lines.join("\n"); }
  let j = i + 1; while (j < lines.length && /^\s*-/.test(lines[j])) j++;
  lines.splice(i, j - i, GUARANTEE); return lines.join("\n");
}

// One-time move to the room-by-room scopes: replaces the old combined pre-sale scope and
// windows note, links the new service scopes, and adds the extras. Anything Jack added stays.
function upgradeLibrary(L) {
  const fresh = Object.fromEntries(DEFAULTS.library.map((l) => [l.id, l]));
  const out = L.map((l) => {
    if (l.id === "lpresale" && String(l.desc || "").startsWith(OLD_PRESALE_START)) return { ...l, desc: PRESALE_SCOPE };
    if (l.id === "lnowin" && /^No window or glass cleaning/.test(l.desc || "")) return { ...l, desc: WINDOWS_NOTE };
    return l;
  });
  const have = new Set(out.map((l) => l.id)), linked = new Set(out.filter((l) => l.service).map((l) => l.service));
  for (const l of DEFAULTS.library) {
    if (have.has(l.id) || (l.service && linked.has(l.service))) continue;
    out.push(fresh[l.id]);
  }
  return out;
}

export async function loadSettings(s) {
  const v = (await s.get("docset")) || {};
  // One-time updates to saved policies. Saving settings sets the flags, so Jack's later edits stick.
  if (typeof v.terms === "string" && v.terms.trim()) {
    if (!v.photoClause && !/Photos\s*&\s*Social/i.test(v.terms)) v.terms = v.terms.trimEnd() + "\n\n" + PHOTO_CLAUSE;
    if (!v.guaranteeV2) v.terms = swapGuarantee(v.terms);
  }
  if (!v.scopeV2 && Array.isArray(v.library)) v.library = upgradeLibrary(v.library);
  // One-time: add the priced-by-area items and the inside-cupboards extra to a saved library.
  if (!v.areasV1 && Array.isArray(v.library)) {
    const have = new Set(v.library.map((l) => l.id));
    for (const l of DEFAULTS.library) if (/^(a[a-z]+|xcupboards)$/.test(l.id) && !have.has(l.id)) v.library.push(l);
  }
  v.pk = cleanPkSettings(v.pk || PK_DEFAULTS);
  return { ...DEFAULTS, ...v, booking: { ...DEFAULTS.booking, ...(v.booking || {}) }, biz: { ...DEFAULTS.biz, ...(v.biz || {}), sms: (v.biz && v.biz.sms) || DEFAULTS.biz.sms }, bank: Object.fromEntries(Object.entries(DEFAULTS.bank).map(([k, d]) => [k, (v.bank && v.bank[k]) || d])) };
}

const str = (v, n = 200) => (typeof v === "string" ? v.slice(0, n) : "");
const num = (v, lo = -1e7, hi = 1e7) => { const x = Number(v); return isFinite(x) ? Math.min(hi, Math.max(lo, r2(x))) : 0; };
const date = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export function cleanSettings(b) {
  const o = {};
  o.biz = {}; for (const k of Object.keys(DEFAULTS.biz)) o.biz[k] = str(b.biz?.[k], 160);
  o.bank = { name: str(b.bank?.name, 80), bsb: str(b.bank?.bsb, 10), acct: str(b.bank?.acct, 20) };
  o.gst = b.gst !== false;
  o.nextQuote = Math.max(1, Math.floor(num(b.nextQuote, 1, 1e7)) || 1);
  o.nextInvoice = Math.max(1, Math.floor(num(b.nextInvoice, 1, 1e7)) || 1);
  o.depositPct = num(b.depositPct, 0, 100);
  o.quoteValidDays = Math.floor(num(b.quoteValidDays, 0, 365));
  o.invoiceDueDays = Math.floor(num(b.invoiceDueDays, 0, 365));
  const int = (v, lo, hi, d) => { const x = Math.floor(Number(v)); return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  o.booking = { perDay: int(b.booking?.perDay, 1, 10, 1), lead: int(b.booking?.lead, 0, 30, 2), weeks: int(b.booking?.weeks, 1, 12, 6), sat: !!b.booking?.sat };
  o.terms = str(b.terms, 12000);
  o.photoClause = true;
  o.guaranteeV2 = true;
  o.scopeV2 = true;
  o.areasV1 = true;
  o.pk = cleanPkSettings(b.pk || PK_DEFAULTS);
  o.prices = {};
  if (b.prices && typeof b.prices === "object") for (const [k, p] of Object.entries(b.prices).slice(0, 20)) o.prices[str(k, 40)] = { base: num(p?.base, 0), bed: num(p?.bed, 0), bath: num(p?.bath, 0), hrs: str(p?.hrs, 120) };
  o.library = (Array.isArray(b.library) ? b.library : []).slice(0, 300).map((l) => ({ id: str(l.id, 40) || id("l"), title: str(l.title, 120), desc: str(l.desc, 8000), price: num(l.price, 0), service: str(l.service, 40) })).filter((l) => l.title);
  return o;
}

function cleanEst(e) {
  if (!e || typeof e !== "object") return null;
  const n = (v, hi) => { if (v === "" || v == null) return ""; const x = Number(v); return isFinite(x) && x >= 0 && x <= hi ? x : ""; };
  // staff: all staff hours added up; own: Jack's hours. (Old quotes used hrs = combined total.)
  let staff = n(e.staff, 1000);
  if (staff === "" && n(e.hrs, 1000) !== "") staff = Math.max(0, n(e.hrs, 1000) - (Number(n(e.own, 500)) || 0));
  const o = { staff, own: n(e.own, 500), mat: n(e.mat, 1e5), day: ["wk", "sat", "sun", "ph"].includes(e.day) ? e.day : "" };
  return o.staff === "" && o.own === "" && o.mat === "" && !o.day ? null : o;
}
export function cleanPrior(a) {
  return (Array.isArray(a) ? a : []).slice(0, 10).map((p) => ({
    id: str(p?.id, 40) || id("c"), amt: num(p?.amt, 0, 1e6), date: date(p?.date) || today(), note: str(p?.note, 120).trim(),
  })).filter((p) => p.amt > 0);
}
export function cleanDoc(b, prev) {
  const kind = b.kind === "invoice" ? "invoice" : "quote";
  const c = b.client || {};
  const o = {
    ...(prev || {}),
    kind,
    client: { name: str(c.name, 120), contact: str(c.contact, 120), email: str(c.email, 160), phone: str(c.phone, 30), address: str(c.address, 300) },
    site: str(b.site, 200), suburb: str(b.suburb, 80), service: str(b.service, 40),
    beds: str(b.beds, 3), baths: str(b.baths, 3),
    issued: date(b.issued) || prev?.issued || today(),
    validUntil: date(b.validUntil), dueDate: date(b.dueDate), serviceDate: date(b.serviceDate),
    items: (Array.isArray(b.items) ? b.items : []).slice(0, 60).map((i) => ({ title: str(i.title, 160), desc: str(i.desc, 8000), qty: num(i.qty, 0, 10000) || 1, price: num(i.price), ...(i.special ? { special: true } : {}) })).filter((i) => i.title || i.desc),
    gst: b.gst !== false, depositPct: num(b.depositPct, 0, 100),
    notes: str(b.notes, 3000), showTerms: b.showTerms !== false,
    jobId: b.jobId === undefined ? (prev?.jobId || "") : str(b.jobId, 40),
    // Price check estimate: never shown to the client.
    est: b.est === undefined ? (prev?.est || null) : cleanEst(b.est),
    // Payments already made elsewhere (e.g. a deposit on an earlier invoice), shown on this
    // invoice and taken off the balance. Not money received here, so not in books or Xero.
    prior: kind !== "invoice" ? [] : b.prior === undefined ? (prev?.prior || []) : cleanPrior(b.prior),
    // Package options (quotes only). Once the client has chosen, the choice is locked in.
    pk: kind !== "quote" ? null : prev?.pk?.baked ? prev.pk : b.pk === undefined ? (prev?.pk || null) : cleanPk(b.pk),
  };
  return o;
}

// Deposit invoices for pre-sale, deep and bond cleans: due today, booking tentative until paid.
export const DEPOSIT_SERVICES = ["Pre-sale clean", "Deep clean", "Bond clean"];
export function isDepositInv(d) {
  return d.kind === "invoice" && DEPOSIT_SERVICES.includes(d.service) &&
    (d.isDeposit || (d.items || []).some((i) => /deposit/i.test(i.title || "") && !/^less deposit/i.test(i.title || "")));
}
export function depositDesc(pct, service) {
  return `Initial ${pct}% deposit required to secure your booking for the scheduled ${String(service || "clean").toLowerCase()}. The remaining balance is payable on completion of the clean. Your booking remains tentative until this deposit has been received.`;
}

// Today-only special on a quote: a % off the quoted price if they accept today
// (Brisbane date). Until it's accepted it's applied in totals(); on accept it's
// baked into the quote as its own discount line so deposits and invoices follow.
export function specialLive(d) {
  const sp = d && d.kind === "quote" && d.special;
  return !!(sp && !sp.baked && sp.date === today() && !["accepted", "declined", "draft"].includes(d.status));
}
export function specialLine(pct) { return `Today-only special: ${pct}% off`; }
export function bakeSpecial(q) {
  if (!specialLive(q)) return false;
  const t = totals(q);
  q.items = [...(q.items || []), { title: specialLine(q.special.pct), desc: "Accepted on the day of the offer.", qty: 1, price: -t.off, special: true }];
  q.special = { ...q.special, baked: new Date().toISOString(), off: t.off };
  return true;
}

export function totals(d) {
  const list = r2(effItems(d).reduce((a, i) => a + (i.qty || 1) * (i.price || 0), 0));
  const off = specialLive(d) ? r2(list * d.special.pct / 100) : 0;
  const sub = r2(list - off);
  const gst = d.gst ? r2(sub * 0.1) : 0;
  const total = r2(sub + gst);
  const paid = r2((d.payments || []).reduce((a, p) => a + p.amt, 0));
  const prior = d.kind === "invoice" ? r2((d.prior || []).reduce((a, p) => a + (p.amt || 0), 0)) : 0;
  const deposit = d.kind === "quote" && d.depositPct ? r2(total * d.depositPct / 100) : 0;
  const was = off ? r2(list + (d.gst ? r2(list * 0.1) : 0)) : total;
  return { sub, gst, total, paid, due: r2(Math.max(0, total - paid - prior)), prior, deposit, list, off, was };
}

export function statusOf(d) {
  const t = totals(d);
  if (d.kind === "invoice") {
    if (t.total > 0 && t.paid + t.prior >= t.total - 0.005) return "paid";
    if (d.status === "draft") return "draft";
    if (t.paid > 0 || t.prior > 0) return d.dueDate && d.dueDate < today() ? "overdue" : "part-paid";
    if (d.dueDate && d.dueDate < today()) return "overdue";
    return d.viewedAt ? "viewed" : "sent";
  }
  if (d.status === "accepted" || d.status === "declined" || d.status === "draft") return d.status;
  if (d.validUntil && d.validUntil < today()) return "expired";
  return d.viewedAt ? "viewed" : "sent";
}

export async function loadDocs(s) {
  const keys = await s.list("doc/");
  const [docs, arc] = await Promise.all([Promise.all(keys.map((k) => s.get(k))).then((x) => x.filter(Boolean)), s.get("jbarchive")]);
  // Jobber history (paid invoices, closed quotes) lives in one read-only blob.
  const ids = new Set(docs.map((d) => d.id));
  for (const d of (arc && arc.docs) || []) if (!ids.has(d.id)) docs.push({ ...d, archived: true });
  return docs.map((d) => ({ ...d, totals: totals(d), state: statusOf(d), isDeposit: isDepositInv(d) })).sort((a, b) => (b.created || "").localeCompare(a.created || ""));
}

export async function findByToken(s, t) {
  if (typeof t !== "string" || t.length < 16) return null;
  const docId = await s.get(`doctok/${t}`);
  return docId ? s.get(`doc/${docId}`) : null;
}

export async function saveDoc(s, d) {
  await s.set(`doc/${d.id}`, d);
  if (d.token) await s.set(`doctok/${d.token}`, d.id);
}

export async function newDoc(s, set, fields) {
  const kind = fields.kind === "invoice" ? "invoice" : "quote";
  const d = { id: id("d"), token: tok(), created: new Date().toISOString(), status: "draft", payments: [], ...fields, kind };
  d.num = kind === "quote" ? set.nextQuote++ : set.nextInvoice++;
  await s.set("docset", set);
  return d;
}

export async function recordPayment(s, d, p) {
  d.payments ||= [];
  if (p.ref && d.payments.some((x) => x.ref === p.ref)) return false;
  const pid = id("p");
  const tip = r2(Math.max(0, Number(p.tip) || 0));
  d.payments.push({ id: pid, amt: r2(p.amt), ...(tip > 0 ? { tip } : {}), date: p.date || today(), method: str(p.method, 40), ref: str(p.ref, 120) });
  d.flag = "paid"; d.flagAt = new Date().toISOString();
  if (d.status === "draft") d.status = "sent";
  await saveDoc(s, d);
  return pid;
}

// What the team needs to know about the package the client chose, for the roster job.
function pkNote(q) {
  const t = pkChosen(q); if (!t) return "";
  const adds = (q.pk.add || []).map((x) => q.pk.addons.find((a) => a.id === x)).filter(Boolean).map(addTitle);
  return ` ${t.name} package: ${String(t.points || "").split("\n").filter(Boolean).join("; ")}.${adds.length ? ` Add-ons: ${adds.join(", ")}.` : ""}`;
}

// Quote accepted with a service date: put the job straight onto the roster.
export async function addJobFromQuote(s, q, opt = {}) {
  if (opt.date) q.serviceDate = opt.date;
  if (!q.serviceDate || q.jobId) return null;
  const hhmm = (v, d) => (/^\d{2}:\d{2}$/.test(v || "") ? v : d);
  const roster = await loadRoster(s);
  const job = {
    id: id("j"), date: q.serviceDate, start: hhmm(opt.start, "08:00"), end: hhmm(opt.end, "16:00"),
    client: q.client.name || "Client", suburb: q.suburb || "", address: q.site || q.client.address || "",
    service: ["Bond clean", "Pre-sale clean", "Deep clean", "Regular clean", "Commercial"].includes(q.service) ? q.service : "Other",
    staff: [], share: tok(), addedAt: new Date().toISOString(),
    notes: `From quote #${q.num}${q.beds ? `, ${q.beds} bed` : ""}${q.baths ? ` ${q.baths} bath` : ""}.${pkNote(q)}${q.client.phone ? ` Client: ${q.client.phone}.` : ""}${q.notes ? " " + q.notes : ""}`.slice(0, 2000),
  };
  roster.jobs.push(job);
  await s.set("roster", { ...roster, savedAt: new Date().toISOString() });
  return job.id;
}

// The roster job behind a doc (its own link, or its quote's), for the job report link.
export async function jobForDoc(s, d) {
  let jid = d.jobId;
  if (!jid && d.quoteId) { const q = await s.get(`doc/${d.quoteId}`); jid = q?.jobId; }
  if (!jid) return null;
  const roster = await loadRoster(s);
  return roster.jobs.find((j) => j.id === jid) || null;
}
export async function reportFor(s, d) {
  const job = await jobForDoc(s, d);
  if (!job || !job.share) return null;
  const roster = await loadRoster(s), days = daysOf(roster, job), rec = {};
  for (const d of days) rec[d.id] = (await s.get(`live/${d.id}`)) || {};
  const live = foldProgress(days, rec).P;
  return { share: job.share, done: live.done || "", photos: Array.isArray(live.photos) ? live.photos.length : 0 };
}

// Open quotes brought over from Jobber only carry line-item titles (Jobber's export has no
// descriptions) and had policies switched off. Before Jack or a client sees one, top it up
// once so it reads like a hub quote: the saved scope for that service and the service
// policies. Runs once per quote (d.filled), so if Jack later edits it his choice sticks.
export function fillJobberQuote(d, set) {
  if (!d || d.kind !== "quote" || d.src !== "jobber" || d.filled) return false;
  if (["accepted", "declined"].includes(d.status)) return false;
  const lib = (set.library || []).find((l) => l.service && l.service === d.service && l.desc);
  const main = (d.items || []).find((i) => (i.price || 0) > 0);
  if (lib && main && !String(main.desc || "").trim()) main.desc = sizeScope(lib.desc, d.beds, d.baths);
  if (set.terms) d.showTerms = true;
  d.filled = true;
  return true;
}

// What a client may see. No internal flags, no other docs' secrets.
// Days a client can pick when accepting a quote: weekdays (and Saturdays if on),
// not public holidays, from the lead time out to the booking window, with fewer
// bookings already on the roster than Jack's jobs-per-day limit.
export async function freeDates(s, set) {
  const B = set.booking || DEFAULTS.booking, roster = await loadRoster(s), t = today();
  const per = {};
  for (const j of roster.jobs) if (!j.sample) (per[j.date] ||= new Set()).add(j.group || j.id);
  const ph = new Set(QLD_PH), out = [];
  for (let n = Math.max(1, B.lead); n <= B.weeks * 7; n++) {
    const d = addDays(t, n), dow = new Date(d + "T00:00:00Z").getUTCDay();
    if (dow === 0 || (dow === 6 && !B.sat) || ph.has(d)) continue;
    if ((per[d] ? per[d].size : 0) >= B.perDay) continue;
    out.push(d);
  }
  return out;
}

export function publicView(d, set) {
  const t = totals(d);
  return {
    kind: d.kind, num: d.num, issued: d.issued, validUntil: d.validUntil, dueDate: d.dueDate, serviceDate: d.serviceDate,
    client: d.client, site: d.site, suburb: d.suburb, service: d.service, items: d.items || [], gst: d.gst, depositPct: d.depositPct,
    // Package options: prices only. Hours and the hourly rate never leave the hub.
    packages: pkLive(d) ? {
      tiers: d.pk.tiers.map(({ key, name, blurb, points, desc, price, inc, rec }) => ({ key, name, blurb, points, desc, price, inc, rec })),
      addons: d.pk.addons.map(({ id, title, desc, price }) => ({ id, title: addTitle({ title }), desc, price })),
      size: sizeTag(d),
    } : null,
    pkChosen: pkChosen(d)?.name || "",
    notes: d.notes, terms: d.showTerms ? set.terms : "", totals: t, state: statusOf(d),
    acceptedAt: d.acceptedAt || "", acceptedName: d.acceptedName || "", isDeposit: isDepositInv(d), quoteNum: d.quoteNum || null,
    special: specialLive(d) ? { pct: d.special.pct, date: d.special.date, ends: d.special.date + "T23:59:59+10:00" } : d.special && d.special.baked ? { pct: d.special.pct, baked: true } : null,
    payments: (d.payments || []).map(({ id, amt, tip, date, method }) => ({ id, amt, tip: tip || 0, date, method })),
    prior: d.kind === "invoice" ? (d.prior || []).map(({ amt, date, note }) => ({ amt, date, note })) : [],
    biz: set.biz, bank: set.bank, gstReg: set.gst,
  };
}
