// Leads pipeline for Jack: every enquiry from first contact to "come back".
// Built from data the hub already has (quote requests, quotes, deposit
// invoices, roster jobs), so nothing is typed twice.
//   GET  (admin)  → { stages: { new, quoted, booked, done }, lost }
//   POST (admin)  { action: "dismiss" | "undismiss", key }
import { store, json, loadRoster, loadAllLive, checkAdmin } from "../../lib/core.mjs";
import { loadDocs, isDepositInv, today, addDays } from "../../lib/docs.mjs";
import { loadRequests, SERVICES } from "../../lib/requests.mjs";
import { bookingsOf } from "../../public/lib/profit.mjs";

const mob = (raw) => {
  const x = String(raw || "").replace(/[^\d+]/g, "").replace(/^\+61/, "0").replace(/^61(?=4\d{8}$)/, "0");
  return /^04\d{8}$/.test(x) ? x : "";
};
const notesMob = (notes) => { const m = /Client:\s*([+\d][\d\s]{7,15}\d)/.exec(notes || ""); return m ? mob(m[1]) : ""; };
const daysSince = (iso, t) => (iso ? Math.max(0, Math.round((Date.parse(t + "T00:00:00Z") - Date.parse(String(iso).slice(0, 10) + "T00:00:00Z")) / 864e5)) : null);
const kind = (svc) => { const s = String(svc || "").toLowerCase(); return /bond|lease|vacate/.test(s) ? "bond" : /pre.?sale/.test(s) ? "presale" : /deep|move.?in/.test(s) ? "deep" : /regular/.test(s) ? "regular" : "other"; };

export async function buildPipeline(s) {
  const t = today();
  const [roster, docs, reqs, live, dis] = await Promise.all([loadRoster(s), loadDocs(s), loadRequests(s), loadAllLive(s), s.get("pipe/dismissed")]);
  const dismissed = dis || {};
  const jobs = roster.jobs.filter((j) => !j.sample);
  const jobById = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const quotes = docs.filter((d) => d.kind === "quote");
  const quoteIds = new Set(quotes.map((q) => q.id));
  const out = { new: [], quoted: [], booked: [], done: [] }, lost = [];

  // 1. New enquiries: website requests nobody has quoted yet.
  for (const r of reqs) {
    if (r.status !== "new" || (r.quoteId && quoteIds.has(r.quoteId))) continue;
    out.new.push({
      key: "r:" + r.id, name: r.name, phone: mob(r.phone), service: (SERVICES[r.service] || SERVICES.other).hub,
      where: r.suburb, wanted: r.date || "", age: daysSince(r.at, t), source: r.heard || "", req: r.id, seen: !!r.seen,
    });
  }

  // 2. Quoted and 5. lost.
  const deposits = docs.filter((d) => d.kind === "invoice" && isDepositInv(d));
  for (const q of quotes) {
    const base = { key: "q:" + q.id, name: q.client?.name || "Client", phone: mob(q.client?.phone), service: q.service || "", where: q.suburb || "", total: q.totals.total, num: q.num, doc: q.id };
    if (q.state === "declined" || q.state === "expired") { if (daysSince(q.created, t) <= 60) lost.push({ ...base, why: q.state }); continue; }
    if (q.state !== "accepted") {
      out.quoted.push({ ...base, draft: q.state === "draft", views: q.views || 0, opened: q.viewedAt ? daysSince(q.viewedAt, t) : null, sent: daysSince(q.sentAt || q.created, t), validUntil: q.validUntil || "" });
      continue;
    }
    // 3. Booked: accepted quote whose clean hasn't happened yet.
    const j = q.jobId && jobById[q.jobId];
    const days = j ? jobs.filter((x) => (x.group || x.id) === (j.group || j.id)).sort((a, b) => a.date.localeCompare(b.date)) : [];
    const last = days.length ? days[days.length - 1].date : "";
    if (j && last < t) continue; // finished: shows under Done from the roster
    const dep = deposits.find((d) => d.quoteId === q.id);
    out.booked.push({ ...base, date: j ? days[0].date : q.serviceDate || "", onRoster: !!j, deposit: dep ? (dep.state === "paid" ? "paid" : dep.state === "draft" ? "not sent" : "unpaid") : "none" });
  }

  // 4. Done: one-off bookings finished in the last 30 days, with the follow-up that fits.
  for (const b of bookingsOf(jobs)) {
    const j = b.j, k = kind(j.service);
    if (j.rec || k === "regular") continue;
    const L = live[b.days[b.days.length - 1].id];
    if (!(b.last < t || (b.last === t && L?.done)) || b.last < addDays(t, -30)) continue;
    const key = "j:" + b.key;
    const follow = k === "presale" || k === "bond" ? ["review_request", "movein_offer"] : ["review_request", "regular_offer"];
    if (k === "bond") follow.splice(1, 0, "inspection_check");
    out.done.push({ key, name: j.client || "Client", phone: notesMob(j.notes), service: j.service || "", where: j.suburb || "", date: b.last, ago: daysSince(b.last, t), follow, job: j.id, dismissed: !!dismissed[key] });
  }

  out.new.sort((a, b) => (b.age ?? 0) - (a.age ?? 0)); // oldest unanswered first
  out.quoted.sort((a, b) => (b.sent ?? 0) - (a.sent ?? 0));
  out.booked.sort((a, b) => (a.date || "9").localeCompare(b.date || "9"));
  out.done.sort((a, b) => (a.dismissed - b.dismissed) || b.date.localeCompare(a.date));
  const value = (l) => Math.round(l.reduce((a, x) => a + (x.total || 0), 0));
  return { today: t, stages: out, lost, totals: { quoted: value(out.quoted.filter((x) => !x.draft)), booked: value(out.booked) } };
}

export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  if (req.method === "GET") return json(await buildPipeline(s));
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const key = String(b.key || "").slice(0, 80);
  if (!/^[rqj]:[\w-]+$/.test(key)) return json({ error: "Bad card" }, 400);
  const d = (await s.get("pipe/dismissed")) || {};
  if (b.action === "dismiss") d[key] = new Date().toISOString();
  else if (b.action === "undismiss") delete d[key];
  else return json({ error: "Unknown action" }, 400);
  await s.set("pipe/dismissed", d);
  return json({ ok: true });
};

export const config = { path: "/api/pipeline" };
