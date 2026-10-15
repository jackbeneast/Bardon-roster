// Invoice now for regular (recurring) cleans: hours worked × Jack's hourly rate
// for that client, plus GST. The rate is remembered per regular client.
import { loadRoster, loadConfirms, shiftOf } from "./core.mjs";
import { loadBooks } from "./books.mjs";
import { loadSeries } from "./series.mjs";
import { bookingDays, clockSummary } from "./clock.mjs";
import { loadDocs, loadSettings, newDoc, saveDoc, today, addDays } from "./docs.mjs";
import { paySet } from "../public/lib/wages.mjs";
import { streetKey } from "./jobber.mjs";

const r2 = (v) => Math.round(v * 100) / 100;
const hm = (t) => (/^\d{2}:\d{2}$/.test(t || "") ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : NaN);
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDay = (d) => { const x = new Date(d + "T00:00:00Z"); return `${DAY[x.getUTCDay()]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
const norm = (v) => String(v || "").trim().toLowerCase();

// The key the client's hourly rate is saved under: the regular schedule's street key,
// else the job's street, else the client's name.
export function rateKey(job) {
  return job.rec || streetKey(job.address || "") || "c:" + norm(job.client).replace(/\W+/g, "").slice(0, 30);
}

// Best guess at the hours to bill, with where it came from.
async function hoursFor(s, roster, days, books) {
  const key = days[0].group || days[0].id;
  const team = Object.fromEntries(roster.team.map((t) => [t.id, t]));
  const nm = (id) => String(team[id]?.name || "Someone").split(" ")[0];
  const a = books.actuals[key];
  if (a && a.staff && !a.skip) {
    const tot = r2(Object.values(a.staff).reduce((x, v) => x + v, 0));
    if (tot > 0) return { hours: tot, from: "logged", detail: Object.entries(a.staff).filter(([, h]) => h > 0).map(([id, h]) => `${nm(id)} ${h} h`).join(" · ") };
  }
  const confirms = await loadConfirms(s);
  const cs = await clockSummary(s, roster, days, confirms);
  const tot = r2(Object.values(cs.staff).reduce((x, v) => x + v, 0));
  if (tot > 0 && !cs.missing.length) return { hours: tot, from: "clock", detail: Object.entries(cs.staff).map(([id, h]) => `${nm(id)} ${h} h`).join(" · ") };
  // Rostered hours, less the unpaid lunch the team gets on long shifts.
  const lunch = paySet(roster.pay).lunch, per = {};
  for (const j of days) for (const pid of j.staff || []) {
    if (confirms[j.id]?.[pid]?.s === "no") continue;
    const sh = shiftOf(j, pid), span = (hm(sh.end) - hm(sh.start)) / 60;
    if (span > 0) per[pid] = r2((per[pid] || 0) + span - (lunch && span > 4.5 ? 0.5 : 0));
  }
  let rt = r2(Object.values(per).reduce((x, v) => x + v, 0));
  if (!rt) { const span = (hm(days[0].end) - hm(days[0].start)) / 60; rt = span > 0 ? r2(span) : 0; }
  return { hours: rt, from: tot > 0 ? "partclock" : "roster", detail: Object.entries(per).map(([id, h]) => `${nm(id)} ${h} h`).join(" · ") };
}

// The client's details from their most recent quote or invoice, else the schedule or job notes.
function clientFor(job, days, docs, series) {
  const ad = norm(job.address), cl = norm(job.client), ids = new Set(days.map((d) => d.id));
  const hits = docs.filter((d) => (d.jobId && ids.has(d.jobId)) || (ad && norm(d.site) === ad) || (cl && norm(d.client?.name) === cl))
    .sort((a, b) => (b.created || "").localeCompare(a.created || ""));
  const c = { name: job.client || "", contact: "", email: "", phone: "", address: job.address || "" };
  for (const d of hits) {
    const x = d.client || {};
    if (!c.contact && x.contact) c.contact = x.contact;
    if (!c.email && x.email) c.email = x.email;
    if (!c.phone && x.phone) c.phone = x.phone;
    if (x.address && c.address === (job.address || "")) c.address = x.address;
  }
  const ser = series.find((x) => x.id === job.ser || (job.rec && x.key === job.rec));
  if (!c.phone && ser?.phone) c.phone = ser.phone;
  if (!c.phone) c.phone = /Client:\s*([+\d][\d\s]{7,15}\d)/.exec(days.map((j) => j.notes || "").join(" "))?.[1] || "";
  return c;
}

async function ctx(s, jobId) {
  const roster = await loadRoster(s);
  const job = roster.jobs.find((j) => j.id === jobId && !j.sample);
  if (!job) return null;
  const days = bookingDays(roster, job);
  const [books, docs, series, set] = await Promise.all([loadBooks(s), loadDocs(s), loadSeries(s), loadSettings(s)]);
  const ids = new Set(days.map((d) => d.id));
  const existing = docs.filter((d) => d.kind === "invoice" && !d.archived && d.jobId && ids.has(d.jobId)).map((d) => ({ id: d.id, num: d.num, state: d.state, total: d.totals.total }));
  return { roster, job: days[0], days, books, docs, series, set, existing, rates: books.rates };
}

// What the "Invoice now" sheet needs to show.
export async function jobInvoicePlan(s, jobId) {
  const c = await ctx(s, jobId);
  if (!c) return null;
  const { job, days, books, docs, series, set, existing, rates, roster } = c;
  const h = await hoursFor(s, roster, days, books);
  const k = rateKey(job);
  return {
    jobId: job.id, client: job.client || "", address: job.address || "", suburb: job.suburb || "", service: job.service || "",
    date: days[days.length - 1].date, first: job.date, days: days.length,
    hours: Math.round(h.hours * 4) / 4, hoursFrom: h.from, hoursDetail: h.detail,
    rate: rates[k] ?? null, gst: set.gst !== false,
    contact: clientFor(job, days, docs, series), existing,
  };
}

// Make the invoice (a draft, so Jack previews it before it goes).
export async function createJobInvoice(s, b) {
  const c = await ctx(s, String(b.jobId || ""));
  if (!c) return { error: "That job isn't on the roster any more.", status: 404 };
  const hours = Number(b.hours), rate = Number(b.rate);
  if (!(hours > 0 && hours <= 500)) return { error: "Enter the hours to bill.", status: 400 };
  if (!(rate > 0 && rate <= 2000)) return { error: "Enter your hourly rate.", status: 400 };
  const { job, days, docs, series, set } = c;
  const last = days[days.length - 1].date, gst = set.gst !== false;
  const hrs = r2(hours), rt = r2(rate);
  const when = days.length > 1 ? `${longDay(job.date)} to ${longDay(last)}` : longDay(job.date);
  const inv = await newDoc(s, set, {
    kind: "invoice", status: "draft", regular: true, jobId: job.id,
    client: clientFor(job, days, docs, series), site: job.address || "", suburb: job.suburb || "", service: job.service || "Regular clean",
    serviceDate: last, issued: today(), dueDate: addDays(today(), set.invoiceDueDays || 0), gst, showTerms: false, notes: "",
    items: [{
      title: `${job.service || "Regular clean"}${job.address ? ` | ${job.address}` : ""}`,
      desc: `Clean on ${when}.\n${hrs} ${hrs === 1 ? "hour" : "hours"} at $${rt.toFixed(2)} per hour${gst ? " + GST" : ""}.`,
      qty: hrs, price: rt,
    }],
  });
  await saveDoc(s, inv);
  // Remember the rate for this client, and put the amount on the job for profit.
  const bk = (await s.get("books")) || {};
  const sub = r2(hrs * rt), total = gst ? r2(sub * 1.1) : sub;
  const next = { ...bk, prices: { ...(bk.prices || {}), [job.group || job.id]: total } };
  if (b.remember !== false) next.rates = { ...(bk.rates || {}), [rateKey(job)]: rt };
  await s.set("books", next);
  return { id: inv.id, num: inv.num, total };
}
