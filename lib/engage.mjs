// Client engagement: when clients open the links Bardon Clean sends them (quotes,
// invoices, receipts, job reports, the agent portal), how long they actually spend
// reading, how far they scroll and what they tap.
//
// The browser page sends small beacons (public/lib/track.js): one when a visit starts,
// then updates while it's on screen and when it's closed. Time only counts while the
// page is visible, so a link left open in a background tab doesn't inflate it.
//
// Storage:
//   eng/<clientKey>  { key, name, kind, sessions: [newest first, capped] }
//   engidx           { [clientKey]: { name, kind, last, n, ms } }   (for the list screen)
//   engstart         ISO time tracking began (stats only count items sent after it)
import { loadRoster } from "./core.mjs";
import { findByToken, totals } from "./docs.mjs";

const MAX_SESSIONS = 200;
const MAX_ACTS = 30;
const SID = /^[a-z0-9]{8,32}$/;

export const clientKey = (name) => "c:" + String(name || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
const money = (v) => "$" + Math.round(v).toLocaleString("en-AU");
const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

// Work out who and what a link token belongs to. Never trust the browser for this.
export async function resolve(s, p, t) {
  if (typeof t !== "string" || t.length < 16 || t.length > 80) return null;
  if (p === "q" || p === "i" || p === "r") {
    const d = await findByToken(s, t);
    if (!d || d.status === "draft") return null;
    const name = d.client?.name || "Client";
    const tt = totals(d);
    const type = p === "r" ? "receipt" : d.kind;
    const label = p === "r" ? `Receipt for invoice #${d.num}` : `${d.kind === "quote" ? "Quote" : "Invoice"} #${d.num}`;
    const sub = [d.kind === "quote" ? money(tt.total) : money(tt.total), d.service, d.suburb].filter(Boolean).join(" · ");
    return { key: clientKey(name), name, kind: "client", item: { type, id: d.id + (p === "r" ? ":r" : ""), label, sub } };
  }
  if (p === "v") {
    const roster = await loadRoster(s);
    const job = roster.jobs.find((j) => j.share === t);
    if (!job) return null;
    const name = job.client || "Client";
    const sub = [job.service, job.suburb].filter(Boolean).join(" · ");
    return { key: clientKey(name), name, kind: "client", item: { type: "report", id: "job:" + (job.group || job.id), label: `Job report${job.address ? " · " + job.address : ""}`.slice(0, 120), sub } };
  }
  if (p === "s") { // a view-only copy the client shared with someone else
    const m = await s.get(`vshare/${t}`);
    if (!m) return null;
    const roster = await loadRoster(s);
    const job = roster.jobs.find((j) => (j.group || j.id) === m.bk);
    if (!job) return null;
    const name = job.client || "Client";
    return { key: clientKey(name), name, kind: "client", item: { type: "report", id: "shared:" + m.bk, label: `Shared view${job.address ? " · " + job.address : ""} (someone they sent it to)`.slice(0, 120), sub: [job.service, job.suburb].filter(Boolean).join(" · ") } };
  }
  if (p === "a") {
    const roster = await loadRoster(s);
    const a = (roster.agents || []).find((x) => x.token === t);
    if (!a) return null;
    return { key: "a:" + a.id, name: a.name + (a.agency ? ` (${a.agency})` : ""), kind: "agent", item: { type: "portal", id: "agent:" + a.id, label: "Agent portal", sub: a.agency || "" } };
  }
  return null;
}

// One beacon from a client page. ev: "open" starts a visit, "beat" updates it.
export async function record(s, b) {
  const sid = String(b.sid || "");
  if (!SID.test(sid)) return false;
  const who = await resolve(s, String(b.p || ""), b.t);
  if (!who) return false;
  const now = new Date();
  const nowIso = now.toISOString();
  if (!(await s.get("engstart"))) await s.set("engstart", { at: nowIso });

  const rec = (await s.get(`eng/${who.key}`)) || { key: who.key, name: who.name, kind: who.kind, sessions: [] };
  rec.name = who.name;
  let ses = rec.sessions.find((x) => x.sid === sid);
  if (!ses) {
    ses = {
      sid, at: nowIso, last: nowIso, item: who.item, ms: 0, sc: 0, acts: [],
      dev: b.dev === "desktop" ? "desktop" : b.dev === "tablet" ? "tablet" : "mobile",
    };
    rec.sessions.unshift(ses);
    if (rec.sessions.length > MAX_SESSIONS) rec.sessions.length = MAX_SESSIONS;
  }
  // Time on page can never be more than the time since the visit began (plus a little slack).
  const cap = now - Date.parse(ses.at) + 5000;
  const ms = Math.max(0, Math.min(Number(b.ms) || 0, cap, 6 * 3600e3));
  if (ms > ses.ms) ses.ms = Math.round(ms);
  const sc = Math.max(0, Math.min(100, Math.round(Number(b.sc) || 0)));
  if (sc > ses.sc) ses.sc = sc;
  if (Array.isArray(b.acts)) {
    for (const a of b.acts.slice(0, MAX_ACTS)) {
      const label = str(a && a.a, 60);
      const at = a && typeof a.at === "string" && !isNaN(Date.parse(a.at)) ? a.at : nowIso;
      if (!label || ses.acts.length >= MAX_ACTS) continue;
      if (ses.acts.some((x) => x.a === label && x.at === at)) continue;
      ses.acts.push({ a: label, at });
    }
  }
  ses.last = nowIso;
  await s.set(`eng/${who.key}`, rec);

  const idx = (await s.get("engidx")) || {};
  idx[who.key] = {
    name: who.name, kind: who.kind, last: nowIso,
    n: rec.sessions.length, ms: rec.sessions.reduce((t, x) => t + (x.ms || 0), 0),
  };
  await s.set("engidx", idx);
  return true;
}

// Group a client's visits by the thing they opened.
export function itemsOf(sessions) {
  const by = {};
  for (const x of sessions) {
    const it = (by[x.item.id] ||= { ...x.item, opens: 0, ms: 0, sc: 0, first: x.at, last: x.at, acts: 0 });
    it.opens++; it.ms += x.ms || 0; it.sc = Math.max(it.sc, x.sc || 0); it.acts += (x.acts || []).length;
    if (x.at < it.first) it.first = x.at;
    if (x.at > it.last) it.last = x.at;
    Object.assign(it, { label: x.item.label, sub: x.item.sub });
  }
  return by;
}

// Everything a client has been sent through the hub, whether they opened it or not.
export function sentByClient(docs, roster) {
  const out = {};
  for (const d of docs) {
    if (d.archived || d.status === "draft" || !d.token) continue;
    const key = clientKey(d.client?.name || "Client");
    const c = (out[key] ||= { name: d.client?.name || "Client", phone: "", items: [] });
    if (!c.phone && d.client?.phone) c.phone = d.client.phone;
    const tt = d.totals || totals(d);
    c.items.push({
      type: d.kind, id: d.id, label: `${d.kind === "quote" ? "Quote" : "Invoice"} #${d.num}`,
      sub: [money(tt.total), d.service, d.suburb].filter(Boolean).join(" · "),
      sent: d.sentAt || d.created || "", state: d.state || "", doc: d.id,
    });
  }
  const today = new Date(Date.now() + 10 * 3600e3).toISOString().slice(0, 10);
  const seen = new Set();
  for (const j of roster.jobs || []) {
    if (!j.share || j.sample || j.date > today) continue;
    const id = "job:" + (j.group || j.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const key = clientKey(j.client || "Client");
    const c = (out[key] ||= { name: j.client || "Client", phone: "", items: [] });
    c.items.push({ type: "report", id, label: `Job report${j.address ? " · " + j.address : ""}`.slice(0, 120), sub: [j.service, j.suburb].filter(Boolean).join(" · "), sent: j.date + "T08:00:00+10:00", share: j.share });
  }
  return out;
}
