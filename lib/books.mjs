// Money in and out: job prices, expenses, regular outgoings. Kept apart from the
// roster blob so the team never receives prices and roster saves never clash with them.
import { randomBytes } from "node:crypto";
import { loadRoster } from "./core.mjs";
import { loadDocs } from "./docs.mjs";
import { toWrap } from "../public/lib/profit.mjs";

const r2 = (v) => Math.round(v * 100) / 100;
const str = (v, n = 200) => (typeof v === "string" ? v.slice(0, n) : "");
const date = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const amt = (v) => { const x = Number(v); return isFinite(x) && x >= 0 && x < 1e7 ? r2(x) : null; };
export const newId = (p) => p + Date.now().toString(36) + randomBytes(3).toString("hex");

export const CATS = [
  "Cleaning products", "Equipment", "Fuel", "Vehicle", "Insurance", "Phone & internet", "Software",
  "Marketing", "Uniforms", "Accountant", "Bank & card fees", "Subcontractors", "Training", "Other",
];
const FREQS = ["weekly", "fortnightly", "monthly", "quarterly", "yearly"];

// The outgoings most cleaning businesses have. Jack works through these once:
// add what he pays, or mark "I don't pay this". The page nags until they're all done.
export const SETUP = [
  ["insurance", "Public liability insurance", "Insurance", "yearly"],
  ["workcover", "WorkCover Queensland", "Insurance", "yearly"],
  ["fuel", "Fuel", "Fuel", "weekly"],
  ["rego", "Car rego and insurance", "Vehicle", "yearly"],
  ["carloan", "Car loan or lease", "Vehicle", "monthly"],
  ["phone", "Phone plan", "Phone & internet", "monthly"],
  ["jobber", "Jobber", "Software", "monthly"],
  ["sms", "SMS (Mobile Message)", "Software", "monthly"],
  ["google", "Google Workspace / email", "Software", "monthly"],
  ["web", "Website, domain and hosting", "Software", "yearly"],
  ["products", "Cleaning products restock", "Cleaning products", "monthly"],
  ["cloths", "Cloths, pads and consumables", "Cleaning products", "monthly"],
  ["uniforms", "Uniforms (shirts)", "Uniforms", "yearly"],
  ["ads", "Advertising and marketing", "Marketing", "monthly"],
  ["accountant", "Accountant or bookkeeper", "Accountant", "yearly"],
  ["bank", "Bank fees", "Bank & card fees", "monthly"],
];

export async function loadBooks(s) {
  const b = (await s.get("books")) || {};
  return { prices: b.prices || {}, recur: b.recur || {}, fixed: Array.isArray(b.fixed) ? b.fixed : [], setup: b.setup || {}, actuals: b.actuals || {}, pricing: pricingOf(b.pricing) };
}
// Jack's pricing targets for the quote price check. Defaults are starting points he changes.
// tax: 30% bracket + 2% Medicare levy (2026-27 resident rates).
export function pricingOf(p) {
  p = p || {};
  const n = (v, lo, hi, d) => { const x = Number(v); return v !== "" && v != null && isFinite(x) && x >= lo && x <= hi ? Math.round(x * 100) / 100 : d; };
  return { ownerRate: n(p.ownerRate, 0, 1000, null), margin: n(p.margin, 0, 80, 20), tax: n(p.tax, 0, 60, 32), hrsMonth: n(p.hrsMonth, 0, 5000, null) };
}
export async function loadExpenses(s) {
  const keys = await s.list("exp/");
  return (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean).sort((a, b) => (b.date + b.at).localeCompare(a.date + a.at));
}

export function cleanExpense(b, prev) {
  const a = amt(b.amt);
  if (!a) return null;
  const gstAmt = b.gst === true ? r2(a / 11) : amt(b.gstAmt) ?? 0;
  return {
    ...(prev || {}), id: prev?.id || newId("e"), date: date(b.date) || prev?.date, amt: a, gst: Math.min(gstAmt, r2(a / 11)),
    cat: CATS.includes(b.cat) ? b.cat : "Other", who: str(b.who, 80), note: str(b.note, 500), job: str(b.job, 60),
    at: prev?.at || new Date().toISOString(),
  };
}
export function cleanFixed(list) {
  return (Array.isArray(list) ? list : []).slice(0, 100).map((f) => {
    const a = amt(f.amt); if (!a || !str(f.name, 80).trim()) return null;
    return {
      id: str(f.id, 40) || newId("f"), name: str(f.name, 80).trim(), cat: CATS.includes(f.cat) ? f.cat : "Other", amt: a,
      gst: f.gst !== false, freq: FREQS.includes(f.freq) ? f.freq : "monthly", start: date(f.start) || new Date().toISOString().slice(0, 10),
      end: date(f.end), setup: str(f.setup, 20),
    };
  }).filter(Boolean);
}

// Wrap-up for one finished booking: actual hours per person (owner included),
// or skip:true to stop being asked.
export function cleanActual(b) {
  if (b.skip) return { skip: true, at: new Date().toISOString() };
  const staff = {};
  for (const [pid, h] of Object.entries(b.staff || {}).slice(0, 30)) { const v = Number(h); if (isFinite(v) && v >= 0 && v <= 300) staff[str(pid, 40)] = Math.round(v * 100) / 100; }
  if (!Object.values(staff).some((v) => v > 0)) return null;
  return { staff, note: str(b.note, 300), at: new Date().toISOString() };
}

// Bookings: a multi-day job is one booking and one price.
export const bookingKey = (j) => j.group || j.id;
export function quoteTotals(docs) {
  const out = {};
  for (const d of docs) if (d.kind === "quote" && d.jobId && d.state !== "declined") out[d.jobId] = d.totals.total;
  return out;
}
export function priceOf(booking, books, qt) {
  const k = bookingKey(booking[0]);
  if (books.prices[k] != null) return { price: books.prices[k], from: "set" };
  const rec = booking.find((j) => j.rec)?.rec;
  if (rec && books.recur[rec] != null) return { price: books.recur[rec], from: "recurring" };
  for (const j of booking) if (qt[j.id] != null) return { price: qt[j.id], from: "quote" };
  return { price: null, from: "" };
}
export function bookings(jobs) {
  const m = new Map();
  for (const j of jobs) if (!j.sample) { const k = bookingKey(j); if (!m.has(k)) m.set(k, []); m.get(k).push(j); }
  for (const list of m.values()) list.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return [...m.values()];
}

// Small summary for the hub's Today screen.
export async function moneySummary(s) {
  const [roster, books, docs, exps, jb] = await Promise.all([loadRoster(s), loadBooks(s), loadDocs(s), loadExpenses(s), s.get("jobber")]);
  const now = new Date(Date.now() + 10 * 3600e3).toISOString(), today = now.slice(0, 10);
  const qt = quoteTotals(docs);
  const unpriced = bookings(roster.jobs).filter((b) => b[0].date <= addDaysIso(today, 30) && priceOf(b, books, qt).price == null).length;
  const setupDone = SETUP.filter(([k]) => books.setup[k]).length;
  return {
    gstReg: (await s.get("docset"))?.gst !== false, unpriced, lastExpense: exps[0]?.at || "", expenses: exps.length, setupDone, setupTotal: SETUP.length,
    jobber: { on: !!jb?.url, pending: (jb?.pending || []).filter((p) => p.date >= today).length },
    wrap: toWrap({ jobs: roster.jobs, books }, today, now.slice(11, 16)).map((b) => ({ key: b.key, client: b.j.client || "", suburb: b.j.suburb || "", service: b.j.service || "", date: b.date, last: b.last })),
  };
}
function addDaysIso(d, n) { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
