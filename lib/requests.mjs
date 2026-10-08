// Quote requests from the public form (/quote). Stored one per blob as req/<id>,
// photos as reqphoto/<photo id>. Jack works them from Quotes & Invoices.
import { randomBytes, createHash } from "node:crypto";

// Keys the form may send, with the label Jack sees.
export const SERVICES = {
  presale: { label: "Pre-sale clean", hub: "Pre-sale clean", date: "First open home or photos" },
  bond: { label: "Bond / end-of-lease clean", hub: "Bond clean", date: "Lease end or final inspection" },
  deep: { label: "Deep clean", hub: "Deep clean", date: "Preferred date" },
  movein: { label: "Move-in clean", hub: "Deep clean", date: "Move-in date" },
  regular: { label: "Regular cleaning", hub: "Regular clean", date: "Preferred start" },
  other: { label: "Something else", hub: "Other", date: "Preferred date" },
};
const WHO = { owner: "Owner / vendor", tenant: "Tenant", agent: "Real estate agent or property manager", other: "Other" };
const PTYPE = { house: "House", townhouse: "Townhouse", unit: "Apartment / unit" };
const FURN = { empty: "Empty", furnished: "Furnished", partly: "Partly furnished" };
const COND = { good: "Well kept", average: "Average, lived-in", heavy: "Needs extra attention" };
export const EXTRAS = {
  carpet: "Carpet steam cleaning", windows: "Windows and tracks", oven: "Oven deep clean", fridge: "Fridge inside",
  blinds: "Blinds or shutters", walls: "Walls washed", pressure: "Pressure cleaning outdoors", garage: "Garage",
  balcony: "Balcony or patio", pest: "Pest control", upholstery: "Upholstery or mattress",
};
const FREQ = { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Every 4 weeks", once: "Just once for now" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FLEX = { exact: "Must be that date", week: "Flexible within the week", any: "Flexible" };
const TIME = { morning: "Morning", afternoon: "Afternoon", any: "Any time" };
const ACCESS = { home: "Someone will be home", keys: "Keys or lockbox", agent: "Collect keys from agent", tbc: "Not sure yet" };
const CONTACT = { text: "Text", call: "Call", email: "Email" };
const HEARD = { google: "Google", referral: "Friend or family", agent: "My real estate agent", instagram: "Instagram", repeat: "I've used Bardon Clean before", other: "Other" };

const str = (v, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const pick = (map, v) => (Object.prototype.hasOwnProperty.call(map, v) ? v : "");
const date = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
export const rid = () => "r" + Date.now().toString(36) + randomBytes(4).toString("hex");
export const pid = () => randomBytes(12).toString("hex");
export const ipKey = (ip) => createHash("sha256").update("bc-req:" + String(ip || "")).digest("hex").slice(0, 20);

// Returns { req } or { error }.
export function cleanRequest(b) {
  const service = pick(SERVICES, b.service);
  if (!service) return { error: "Choose the kind of clean you need." };
  const name = str(b.name, 120), phone = str(b.phone, 30), email = str(b.email, 160).toLowerCase();
  if (name.length < 2) return { error: "Add your name." };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return { error: "Add a phone number so Jack can reach you." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "That email doesn't look right." };
  const address = str(b.address, 200), suburb = str(b.suburb, 80);
  if (!suburb) return { error: "Add the suburb." };
  const num = (v, lo, hi) => { const x = Number(v); return isFinite(x) && x >= lo && x <= hi ? x : null; };
  const req = {
    service, who: pick(WHO, b.who), agency: str(b.agency, 120),
    placeId: /^[\w-]{10,300}$/.test(b.placeId || "") ? b.placeId : "",
    address, suburb, postcode: /^\d{4}$/.test(str(b.postcode, 4)) ? str(b.postcode, 4) : "",
    ptype: pick(PTYPE, b.ptype), beds: num(b.beds, 0, 12), baths: num(b.baths, 0, 10), storeys: num(b.storeys, 1, 4),
    furnished: pick(FURN, b.furnished), condition: pick(COND, b.condition),
    extras: (Array.isArray(b.extras) ? b.extras : []).filter((x) => EXTRAS[x]).slice(0, 12),
    freq: pick(FREQ, b.freq), days: (Array.isArray(b.days) ? b.days : []).filter((d) => DAYS.includes(d)),
    date: date(b.date), flex: pick(FLEX, b.flex), time: pick(TIME, b.time), access: pick(ACCESS, b.access),
    name, phone, email, contact: pick(CONTACT, b.contact) || "text", heard: pick(HEARD, b.heard),
    notes: str(b.notes, 2000), src: str(b.src, 80),
  };
  return { req };
}

// A readable summary, used for Jack's alert, the hub and the quote notes.
export function lines(r) {
  const S = SERVICES[r.service] || SERVICES.other, out = [];
  const size = [r.beds != null ? `${r.beds} bed` : "", r.baths != null ? `${r.baths} bath` : "", r.storeys ? `${r.storeys} storey${r.storeys > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ");
  out.push(["Service", S.label + (r.service === "regular" && r.freq ? `, ${FREQ[r.freq].toLowerCase()}` : "")]);
  if (r.who) out.push(["Booking as", WHO[r.who] + (r.agency ? `, ${r.agency}` : "")]);
  out.push(["Property", [r.address, r.suburb, r.postcode].filter(Boolean).join(", ")]);
  if (r.ptype || size) out.push(["Home", [PTYPE[r.ptype], size].filter(Boolean).join(", ")]);
  if (r.furnished) out.push(["Furnished", FURN[r.furnished]]);
  if (r.condition) out.push(["Condition", COND[r.condition]]);
  if (r.extras.length) out.push(["Extras", r.extras.map((x) => EXTRAS[x]).join(", ")]);
  if (r.days.length) out.push(["Days", r.days.join(", ")]);
  if (r.date) out.push([S.date, new Date(r.date + "T00:00:00Z").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) + (r.flex ? ` (${FLEX[r.flex].toLowerCase()})` : "")]);
  if (r.time) out.push(["Time", TIME[r.time]]);
  if (r.access) out.push(["Access", ACCESS[r.access]]);
  if (r.heard) out.push(["Found us", HEARD[r.heard]]);
  if (r.notes) out.push(["Notes", r.notes]);
  return out;
}

export async function loadRequests(s) {
  const keys = await s.list("req/");
  return (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean).sort((a, b) => b.at.localeCompare(a.at));
}
