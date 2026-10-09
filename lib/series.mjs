// Regular clients, run by the hub instead of Jobber. Each schedule puts its
// visits on the roster up to 8 weeks ahead and keeps topping them up daily.
// Visits keep `rec` (the street key) so recurring prices and Jobber-made visits
// line up with no double-ups.
import { randomBytes } from "node:crypto";
import { loadRoster } from "./core.mjs";
import { loadBooks } from "./books.mjs";
import { streetKey, bneToday } from "./jobber.mjs";

export const AHEAD = 56;
const str = (v, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const hm = (v, d) => (/^\d{2}:\d{2}$/.test(v || "") ? v : d);
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "");
const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dn = (d) => Math.round(Date.parse(d + "T00:00:00Z") / 864e5);
export const FREQ = { 7: "Weekly", 14: "Fortnightly", 21: "Every 3 weeks", 28: "Every 4 weeks" };

export async function loadSeries(s) { return (await s.get("series")) || []; }

export function cleanSeries(b, prev, teamIds) {
  const client = str(b.client, 120), address = str(b.address, 160);
  if (!client) return { error: "Add the client's name." };
  if (!address) return { error: "Add the address." };
  const every = [7, 14, 21, 28].includes(+b.every) ? +b.every : 0;
  if (!every) return { error: "Choose how often." };
  const next = day(b.next);
  if (!next) return { error: "Pick the date of the next visit." };
  const start = hm(b.start, "09:00"), end = hm(b.end, "12:00");
  if (end <= start) return { error: "The finish time needs to be after the start." };
  return { series: {
    ...(prev || {}), id: prev?.id || "s" + Date.now().toString(36) + randomBytes(3).toString("hex"),
    client, address, suburb: str(b.suburb, 80), phone: str(b.phone, 30), every, anchor: next, start, end,
    staff: (Array.isArray(b.staff) ? b.staff : []).filter((x) => teamIds.has(x)),
    notes: str(b.notes, 1000), key: streetKey(address) || (prev?.key) || "s:" + client.toLowerCase().replace(/\W+/g, "").slice(0, 30),
    paused: !!b.paused, ends: day(b.ends), skip: (prev?.skip || []).filter((d) => d >= bneToday()),
    updated: new Date().toISOString(),
  } };
}

// Visit dates for a schedule between from and to.
export function datesOf(x, from, to) {
  const out = [];
  if (x.paused) return out;
  let n = dn(x.anchor);
  const f = dn(from), t = dn(x.ends && x.ends < to ? x.ends : to);
  if (n < f) n += Math.ceil((f - n) / x.every) * x.every;
  for (; n <= t; n += x.every) { const d = new Date(n * 864e5).toISOString().slice(0, 10); if (!(x.skip || []).includes(d)) out.push(d); }
  return out;
}

function makeVisit(x, date) {
  return {
    id: "j" + Date.now().toString(36) + randomBytes(3).toString("hex"), date, start: x.start, end: x.end,
    client: x.client, suburb: x.suburb, address: x.address, service: "Regular clean", staff: [...x.staff],
    notes: `${FREQ[x.every]} regular clean.${x.phone ? ` Client: ${x.phone}.` : ""}${x.notes ? " " + x.notes : ""}`.slice(0, 2000),
    share: randomBytes(18).toString("hex"), rec: x.key, ser: x.id, addedAt: new Date().toISOString(),
  };
}

// Put every schedule's visits on the roster up to AHEAD days out. With `reset`,
// first clear that schedule's future visits nobody has confirmed or started,
// so edits to time, team or frequency flow through.
export async function generate(s, opts = {}) {
  const [list, roster] = await Promise.all([loadSeries(s), loadRoster(s)]);
  const t = bneToday(), to = addDays(t, AHEAD);
  let added = 0, removed = 0;
  if (opts.reset) {
    const keep = (j) => !(j.ser === opts.reset && j.date > t);
    const before = roster.jobs.length;
    const gone = roster.jobs.filter((j) => !keep(j));
    const busy = new Set();
    for (const j of gone) { const L = await s.get(`live/${j.id}`); const c = (await s.list(`confirm/${j.id}/`)).length; if ((L && Object.keys(L.arrived || {}).length) || c) busy.add(j.id); }
    roster.jobs = roster.jobs.filter((j) => keep(j) || busy.has(j.id));
    removed = before - roster.jobs.length;
  }
  for (const x of list) {
    for (const d of datesOf(x, t, to)) {
      // Already there: made by this schedule, by Jobber for the same street, or added by hand at that address.
      if (roster.jobs.some((j) => j.date === d && !j.sample && (j.ser === x.id || (j.rec && j.rec === x.key) || (x.key && streetKey(j.address) === x.key)))) continue;
      roster.jobs.push(makeVisit(x, d)); added++;
    }
  }
  if (added || removed) await s.set("roster", { ...roster, savedAt: new Date().toISOString() });
  return { added, removed };
}

// Proposals from the recurring visits Jobber has put on the roster: one per street.
export async function fromJobber(s) {
  const [roster, list, books] = await Promise.all([loadRoster(s), loadSeries(s), loadBooks(s)]);
  const have = new Set(list.map((x) => x.key));
  const by = {};
  for (const j of roster.jobs) if (j.rec && j.src === "jobber" && !have.has(j.rec)) (by[j.rec] ||= []).push(j);
  const t = bneToday(), out = [];
  for (const [key, js] of Object.entries(by)) {
    js.sort((a, b) => a.date.localeCompare(b.date));
    const gaps = [];
    for (let i = 1; i < js.length; i++) { const g = dn(js[i].date) - dn(js[i - 1].date); if (g > 0) gaps.push(g); }
    gaps.sort((a, b) => a - b);
    const med = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 14;
    const every = [7, 14, 21, 28].reduce((a, b) => (Math.abs(b - med) < Math.abs(a - med) ? b : a), 14);
    const future = js.filter((j) => j.date >= t), last = js[js.length - 1], ref = future[0] || last;
    let next = ref.date;
    while (next < t) next = addDays(next, every);
    const phone = /Client:\s*([+\d][\d\s]{7,15}\d)/.exec(js.map((j) => j.notes || "").join(" "))?.[1] || "";
    out.push({ key, client: ref.client, address: ref.address, suburb: ref.suburb, phone, every, next, start: ref.start, end: ref.end, staff: ref.staff || [], visits: js.length, price: books.recur[key] ?? null });
  }
  return out.sort((a, b) => a.client.localeCompare(b.client));
}
