// Growth hub (/marketing): the marketing and advertising side of the hub, built on data
// the hub already holds. Every number is measured in leads, won quotes and revenue,
// never likes or clicks. Nothing here sends a marketing message on its own: drafts open
// in Messages for Jack to edit and send. The one exception is the optional instant
// "got your request" text, which is off until Jack switches it on.
//
// Blobs (all under mkt/):
//   mkt/settings   see DEFAULTS
//   mkt/reviews    { <clientKey>: { name, bk, asked, reminded, left } }      review requests
//   mkt/ratings    [ { date, rating, count } ]                              Google rating snapshots
//   mkt/agents     [ prospect ]                                             agent pipeline
//   mkt/spend      [ { id, month, channel, amt, note } ]                    ad and marketing spend
//   mkt/consent    { <04 mobile>: { name, at, via } }                       marketing opt-ins
//   mkt/rewards    { <request id>: { at, note } }                           referral rewards given
//   mkt/pr         [ { id, kind, name, outlet, contact, status, date, link, notes } ]
//   mkt/brand      { blocks: [ { id, title, text } ], files: [ { id, title, url } ] }
//   mkt/agentdone  { <agent id>:<quarter> : iso }                           quarterly wrap sent
import { randomBytes } from "node:crypto";
import { loadRoster, loadAllLive, bookingLive } from "./core.mjs";
import { loadDocs, addDays } from "./docs.mjs";
import { loadRequests, SERVICES } from "./requests.mjs";
import { loadIndex, loadThread } from "./messages.mjs";
import { loadBooks, loadExpenses, quoteTotals } from "./books.mjs";
import { loadTemplates } from "./templates.mjs";
import { clientKey } from "./engage.mjs";
import { kindOf, bneToday } from "./plus.mjs";
import { bookingsOf, priceOf, dueDates } from "../public/lib/profit.mjs";
import { capacity, rebook, agentsCard } from "./desk.mjs";

const SITE = () => (process.env.URL || "https://bardon-roster.netlify.app").replace(/\/$/, "");
export const REVIEW_FALLBACK = "https://g.page/r/CU7gM1yn91KEEAE/review";
export const OPT_OUT = "Reply STOP to opt out.";
const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").trim().slice(0, n) : "");
const nid = (p) => p + Date.now().toString(36) + randomBytes(3).toString("hex");
const first = (n) => String(n || "").replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] || "there";
export const mob = (raw) => { const x = String(raw || "").replace(/[^\d+]/g, "").replace(/^\+61/, "0").replace(/^61(?=4\d{8}$)/, "0"); return /^04\d{8}$/.test(x) ? x : ""; };
const notesMob = (notes) => { const m = /Client:\s*([+\d][\d\s]{7,15}\d)/.exec(notes || ""); return m ? mob(m[1]) : ""; };
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const place = (j) => String(j.address || j.suburb || "your place").replace(/^Sample:\s*/, "");
export const textHref = (phone, name, draft) => `/messages/#/t/${phone}?name=${encodeURIComponent(name || "")}${draft ? "&draft=" + encodeURIComponent(draft) : ""}`;
const median = (a) => { if (!a.length) return null; const x = a.slice().sort((p, q) => p - q), m = Math.floor(x.length / 2); return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
const quarterOf = (d) => d.slice(0, 4) + "Q" + (Math.floor((+d.slice(5, 7) - 1) / 3) + 1);
const qStart = (d) => { const m = Math.floor((+d.slice(5, 7) - 1) / 3) * 3 + 1; return `${d.slice(0, 4)}-${String(m).padStart(2, "0")}-01`; };

// ---------------- settings ----------------
export const DEFAULTS = {
  ackOn: false,
  ackText: "Hi {first}, thanks for your request for a {service} in {suburb}. It's come through to Jack at Bardon Clean and he'll be in touch soon. - Bardon Clean",
  respondMins: 15,     // target for a first reply during the day
  reviewTarget: 6,     // new Google reviews a month
  reviewRemindDays: 3, // one reminder after this many days
  quietPct: 60,        // a week under this % booked is a quiet week
  agentEvery: 21,      // days between touches with partner agents
};
export async function loadMktSettings(s) { return { ...DEFAULTS, ...((await s.get("mkt/settings")) || {}) }; }
export function cleanMktSettings(b, prev) {
  const o = { ...prev };
  if (typeof b.ackOn === "boolean") o.ackOn = b.ackOn;
  if (typeof b.ackText === "string" && b.ackText.trim().length >= 10) o.ackText = b.ackText.trim().slice(0, 400);
  const num = (k, lo, hi) => { if (b[k] === undefined || b[k] === "") return; const v = Math.round(Number(b[k])); if (isFinite(v) && v >= lo && v <= hi) o[k] = v; };
  num("respondMins", 1, 600); num("reviewTarget", 0, 100); num("reviewRemindDays", 1, 30); num("quietPct", 0, 100); num("agentEvery", 7, 120);
  return o;
}
export function fillAck(tpl, r) {
  const S = SERVICES[r.service] || SERVICES.other;
  return String(tpl).replace(/\{first\}/g, first(r.name)).replace(/\{service\}/g, S.label.toLowerCase()).replace(/\{suburb\}/g, r.suburb || "your area").replace(/\s+-\s+Bardon Clean$/, " - Bardon Clean");
}

// ---------------- consent (Spam Act) ----------------
export async function loadConsent(s) { return (await s.get("mkt/consent")) || {}; }
export async function addConsent(s, phoneRaw, name, via) {
  const p = mob(phoneRaw); if (!p) return false;
  const c = await loadConsent(s);
  if (!c[p]) { c[p] = { name: str(name, 120), at: new Date().toISOString(), via: str(via, 60) }; await s.set("mkt/consent", c); }
  return true;
}
// "yes" (opted in), "out" (unsubscribed: never send marketing), or "client" (existing client, no record)
export function consentOf(phone, consent, idx) {
  if (!phone) return "none";
  if (idx[phone] && idx[phone].optout) return "out";
  return consent[phone] ? "yes" : "client";
}

// ---------------- where a lead came from ----------------
export const HEARD_LABEL = {
  google: "Google search", maps: "Google Maps & reviews", referral: "Friend or family", agent: "Real estate agent", instagram: "Instagram",
  facebook: "Facebook", repeat: "Past client", flyer: "Flyer or letterbox", vehicle: "Saw the van or car", media: "News or media", other: "Other",
};
// Paid channels Jack can log spend against, and the sources each one owns.
export const CHANNELS = {
  google_ads: "Google Ads", meta_ads: "Facebook & Instagram ads", flyers: "Flyers & letterbox", vehicle: "Vehicle wrap", directories: "Directories & listings", other: "Other marketing",
};
export function channelOf(r) {
  const src = String(r.src || "").toLowerCase(), u = r.utm || {}, med = String(u.medium || "").toLowerCase(), us = String(u.source || src).toLowerCase();
  if (r.refBy) return { label: "Client referral link", channel: "" };
  if (r.gclid || (/cpc|ppc|paid/.test(med) && /google/.test(us))) return { label: "Google Ads", channel: "google_ads" };
  if (r.fbclid || (/cpc|ppc|paid/.test(med) && /facebook|instagram|meta|fb|ig/.test(us))) return { label: "Facebook & Instagram ads", channel: "meta_ads" };
  if (r.heard) {
    const l = HEARD_LABEL[r.heard] || r.heard;
    return { label: l, channel: r.heard === "flyer" ? "flyers" : r.heard === "vehicle" ? "vehicle" : "" };
  }
  if (/^gbp|google.?business|business\.google/.test(us)) return { label: "Google Maps & reviews", channel: "" };
  if (/instagram|^ig/.test(us)) return { label: "Instagram", channel: "" };
  if (/flyer/.test(us)) return { label: "Flyer or letterbox", channel: "flyers" };
  if (src === "client-link") return { label: "Client link (book again)", channel: "" };
  if (/google\./.test(us)) return { label: "Google search", channel: "" };
  if (src && !/bardonclean|netlify/.test(src)) return { label: "Link: " + src, channel: "" };
  if (/bardonclean/.test(src)) return { label: "Website (source not given)", channel: "" };
  return { label: "Not given", channel: "" };
}

async function base(s) {
  const [roster, docs, rawLive, books, reqs, idx, consent, tpl, set] = await Promise.all([
    loadRoster(s), loadDocs(s), loadAllLive(s), loadBooks(s), loadRequests(s), loadIndex(s), loadConsent(s), loadTemplates(s), loadMktSettings(s),
  ]);
  const live = bookingLive(roster, rawLive);
  return { roster, docs, live, books, reqs, idx, consent, tpl, set, B: bookingsOf(roster.jobs), t: bneToday(), qt: quoteTotals(docs) };
}
function phoneFor(days, docs) {
  const ids = new Set(days.map((d) => d.id));
  const q = docs.find((d) => d.kind === "quote" && ids.has(d.jobId) && d.client?.phone);
  return mob(q?.client?.phone) || days.map((d) => notesMob(d.notes)).find(Boolean) || mob(days[0].phone) || "";
}

// First reply to a lead: the earliest text Jack sent them (not the automatic acknowledgement),
// or the quote going out, whichever came first. Minutes, or null if not replied yet.
async function firstReply(s, r, qById) {
  const at = Date.parse(r.at), cands = [];
  const p = mob(r.phone);
  if (p) {
    const t = await loadThread(s, p);
    const o = (t.msgs || []).find((m) => m.dir === "out" && Date.parse(m.at) >= at && !/^ack:/.test(m.ref || ""));
    if (o) cands.push(Date.parse(o.at));
  }
  const q = r.quoteId && qById[r.quoteId];
  if (q && q.sentAt && Date.parse(q.sentAt) >= at) cands.push(Date.parse(q.sentAt));
  if (r.replied && Date.parse(r.replied) >= at) cands.push(Date.parse(r.replied));
  if (!cands.length) return null;
  return Math.max(0, Math.round((Math.min(...cands) - at) / 60000));
}

// Every lead in the window with its channel, outcome and first-reply time.
export async function leadRows(s, C, days) {
  const from = addDays(C.t, -days);
  const qById = Object.fromEntries(C.docs.filter((d) => d.kind === "quote").map((d) => [d.id, d]));
  const rows = [];
  for (const r of C.reqs) {
    if (r.at.slice(0, 10) < from) continue;
    const ch = channelOf(r), q = r.quoteId && qById[r.quoteId];
    rows.push({
      id: r.id, at: r.at, name: r.name, phone: mob(r.phone), service: (SERVICES[r.service] || SERVICES.other).label, svc: r.service,
      suburb: r.suburb || "", source: ch.label, channel: ch.channel, status: r.status,
      quoted: !!q && q.state !== "draft", won: !!q && q.state === "accepted", revenue: q && q.state === "accepted" ? q.totals.total : 0,
      reply: await firstReply(s, r, qById), gclid: r.gclid || "", email: r.email || "", wonAt: q && q.acceptedAt ? q.acceptedAt : "",
    });
  }
  return rows;
}

// ---------------- leads & speed ----------------
export async function leadsPart(s) {
  const C = await base(s), rows = await leadRows(s, C, 90);
  const waiting = rows.filter((r) => r.status === "new" && r.reply == null && !r.quoted).map((r) => ({ ...r, mins: Math.round((Date.now() - Date.parse(r.at)) / 60000) }));
  const r30 = rows.filter((r) => r.at.slice(0, 10) >= addDays(C.t, -30)), replied = r30.filter((r) => r.reply != null).map((r) => r.reply);
  const svc = {};
  for (const r of rows) { const x = (svc[r.service] ||= { service: r.service, leads: 0, quoted: 0, won: 0, revenue: 0 }); x.leads++; if (r.quoted) x.quoted++; if (r.won) { x.won++; x.revenue += r.revenue; } }
  return {
    settings: { ackOn: C.set.ackOn, ackText: C.set.ackText, respondMins: C.set.respondMins },
    waiting: waiting.sort((a, b) => b.mins - a.mins),
    speed: { n: r30.length, replied: replied.length, median: median(replied), within: replied.filter((m) => m <= C.set.respondMins).length, hour: replied.filter((m) => m <= 60).length },
    byService: Object.values(svc).map((x) => ({ ...x, revenue: Math.round(x.revenue) })).sort((a, b) => b.leads - a.leads),
    recent: rows.slice(0, 40).map((r) => ({ id: r.id, at: r.at, name: r.name, service: r.service, suburb: r.suburb, source: r.source, reply: r.reply, quoted: r.quoted, won: r.won })),
  };
}

// ---------------- sources, spend and ads ----------------
export async function loadSpend(s) { const v = await s.get("mkt/spend"); return Array.isArray(v) ? v : []; }
export async function sourcesPart(s, days = 90) {
  const C = await base(s), rows = await leadRows(s, C, days), from = addDays(C.t, -days);
  const m = {};
  const row = (k, ch) => (m[k] ||= { source: k, channel: ch || "", leads: 0, quoted: 0, won: 0, revenue: 0 });
  for (const r of rows) { const x = row(r.source, r.channel); x.leads++; if (r.quoted) x.quoted++; if (r.won) { x.won++; x.revenue += r.revenue; } }
  // Agent bookings go straight onto the roster (no request), so count them from the roster.
  const agents = Object.fromEntries((C.roster.agents || []).map((a) => [a.id, a]));
  for (const b of C.B) {
    if (!b.j.agentId || b.date < from || b.date > C.t) continue;
    const a = agents[b.j.agentId], x = row(`Agent: ${a ? a.name + (a.agency ? ", " + a.agency : "") : "agent"}`);
    x.leads++; x.quoted++; x.won++; x.revenue += priceOf(b, C.books, C.qt).price || 0;
  }
  // Spend in the window: the Growth hub's spend log by channel, plus untagged Marketing expenses.
  const spend = (await loadSpend(s)).filter((x) => x.month + "-31" >= from);
  const byCh = {};
  for (const x of spend) byCh[x.channel] = (byCh[x.channel] || 0) + x.amt;
  const exps = (await loadExpenses(s)).filter((e) => e.cat === "Marketing" && e.date >= from);
  const fixedMk = C.books.fixed.filter((f) => f.cat === "Marketing").reduce((n, f) => n + dueDates(f, from, C.t).length * f.amt, 0);
  const channels = Object.entries(CHANNELS).map(([k, label]) => {
    const won = rows.filter((r) => r.channel === k && r.won), leads = rows.filter((r) => r.channel === k).length;
    const amt = Math.round(byCh[k] || 0), rev = Math.round(won.reduce((n, r) => n + r.revenue, 0));
    return { key: k, label, spend: amt, leads, won: won.length, revenue: rev, perLead: leads && amt ? Math.round(amt / leads) : null, perWon: won.length && amt ? Math.round(amt / won.length) : null, roas: amt ? Math.round((rev / amt) * 10) / 10 : null };
  }).filter((c) => c.spend || c.leads);
  const out = Object.values(m).map((x) => ({ ...x, revenue: Math.round(x.revenue), rate: x.quoted ? Math.round((x.won / x.quoted) * 100) : null })).sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);
  const total = out.reduce((n, x) => n + x.revenue, 0);
  const share = (re) => total ? Math.round((out.filter((x) => re.test(x.source)).reduce((n, x) => n + x.revenue, 0) / total) * 100) : 0;
  return {
    days, from, rows: out, channels, spend: (await loadSpend(s)).slice().sort((a, b) => b.month.localeCompare(a.month)).slice(0, 60),
    other: { expenses: Math.round(exps.reduce((n, e) => n + e.amt, 0)), fixed: Math.round(fixedMk) },
    shares: { agents: share(/^Agent|Real estate agent/), repeat: share(/Past client|Client link|Client referral|Friend or family/), total: Math.round(total) },
    gclidWon: rows.filter((r) => r.gclid && r.won).length, gclidLeads: rows.filter((r) => r.gclid).length, chLabels: CHANNELS,
  };
}
// Google Ads offline conversion import (GCLID template). Won quotes from ad clicks in the last 90 days.
export async function gclidCsv(s) {
  const C = await base(s), rows = (await leadRows(s, C, 90)).filter((r) => r.gclid && r.won && r.wonAt);
  const fmt = (iso) => { const d = new Date(Date.parse(iso) + 10 * 3600e3).toISOString(); return `${d.slice(0, 10)} ${d.slice(11, 19)}+1000`; };
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = ["Parameters:TimeZone=+1000", "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency"];
  for (const r of rows) lines.push([q(r.gclid), q("Won job"), q(fmt(r.wonAt)), Math.round(r.revenue * 100) / 100, "AUD"].join(","));
  return lines.join("\n") + "\n";
}
export async function saveSpend(s, b) {
  const l = await loadSpend(s);
  const month = /^\d{4}-\d{2}$/.test(b.month || "") ? b.month : bneToday().slice(0, 7);
  const channel = CHANNELS[b.channel] ? b.channel : "other", amt = Math.round(Number(b.amt) * 100) / 100;
  if (!(amt > 0 && amt < 1e6)) return { error: "Add the amount spent." };
  l.push({ id: nid("sp"), month, channel, amt, note: str(b.note, 160) });
  await s.set("mkt/spend", l.slice(-500));
  return { ok: true };
}

// ---------------- reviews ----------------
export async function reviewsPart(s) {
  const C = await base(s), set = C.set, rec = (await s.get("mkt/reviews")) || {}, ratings = (await s.get("mkt/ratings")) || [];
  const link = C.tpl.reviewLink || REVIEW_FALLBACK, t = C.t;
  const ask = [], remind = [], waiting = [], done = [];
  const seen = new Set();
  for (const b of C.B.slice().sort((x, y) => y.last.localeCompare(x.last))) {
    const j = b.j, L = C.live[b.days[b.days.length - 1].id] || {};
    const finished = b.last < t || (b.last === t && L.done);
    if (!finished || daysBetween(b.last, t) > 45) continue;
    const ck = clientKey(j.client || place(j));
    if (seen.has(ck)) continue; // one ask per client, from their latest clean
    seen.add(ck);
    const r = rec[ck] || {}, phone = phoneFor(b.days, C.docs), svc = String(j.service || "clean").toLowerCase();
    const item = { key: ck, bk: b.key, name: j.client || "Client", service: j.service || "Clean", suburb: j.suburb || "", date: b.last, phone, asked: r.asked || "", reminded: r.reminded || "", left: r.left || "", agent: !!j.agentId };
    if (r.left) { done.push(item); continue; }
    if (!r.asked) {
      item.draft = `Hi ${first(j.client)}, thanks again for having Bardon Clean at ${place(j)}. If you have a minute, an honest Google review really helps a small local business like ours, and mentioning it was a ${svc} helps people looking for the same thing:\n${link}\n\nJack`;
      ask.push(item);
    } else if (!r.reminded && daysBetween(r.asked.slice(0, 10), t) >= set.reviewRemindDays && daysBetween(r.asked.slice(0, 10), t) <= 21) {
      item.draft = `Hi ${first(j.client)}, Jack from Bardon Clean. Just a gentle follow-up in case the review link got buried. Only if you have a minute, no worries at all if not:\n${link}`;
      remind.push(item);
    } else waiting.push(item);
  }
  for (const i of [...ask, ...remind]) { i.out = !!(i.phone && C.idx[i.phone] && C.idx[i.phone].optout); i.href = i.phone && !i.out ? textHref(i.phone, i.name, i.draft) : ""; }
  const m0 = t.slice(0, 7);
  const asked30 = Object.values(rec).filter((r) => r.asked && r.asked.slice(0, 10) >= addDays(t, -30)).length;
  const leftMonth = Object.values(rec).filter((r) => r.left && r.left.slice(0, 7) === m0).length;
  // Google's own count, from the snapshots Jack logs: new this month = latest minus the last one before the month.
  const sorted = ratings.slice().sort((a, b) => a.date.localeCompare(b.date)), latest = sorted[sorted.length - 1] || null;
  const before = sorted.filter((x) => x.date < m0 + "-01").pop();
  const newMonth = latest && before ? latest.count - before.count : null;
  return {
    link, linkSet: !!C.tpl.reviewLink, target: set.reviewTarget, remindDays: set.reviewRemindDays,
    ask, remind, waiting: waiting.slice(0, 30), done: done.slice(0, 30),
    stats: { asked30, leftMonth, newMonth, latest }, ratings: sorted.slice(-24).reverse(),
  };
}
export async function markReview(s, b) {
  const rec = (await s.get("mkt/reviews")) || {}, k = str(b.key, 120);
  if (!k) return { error: "Missing client" };
  const r = rec[k] || {};
  const f = { asked: "asked", reminded: "reminded", left: "left" }[b.field];
  if (!f) return { error: "Unknown field" };
  if (b.value === false) delete r[f]; else r[f] = new Date().toISOString();
  r.name = str(b.name, 120) || r.name || ""; r.bk = str(b.bk, 80) || r.bk || "";
  rec[k] = r; await s.set("mkt/reviews", rec);
  return { ok: true };
}
export async function addRating(s, b) {
  const rating = Math.round(Number(b.rating) * 10) / 10, count = Math.round(Number(b.count));
  if (!(rating >= 1 && rating <= 5) || !(count >= 0 && count < 100000)) return { error: "Add the star rating (1 to 5) and the number of reviews." };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : bneToday();
  const l = ((await s.get("mkt/ratings")) || []).filter((x) => x.date !== date);
  l.push({ date, rating, count });
  await s.set("mkt/ratings", l.slice(-120));
  return { ok: true };
}

// ---------------- agents pipeline ----------------
export const STAGES = [["target", "Target"], ["intro", "Introduced"], ["met", "Met"], ["first", "First job"], ["regular", "Regular"], ["paused", "Not now"]];
export async function loadProspects(s) { const v = await s.get("mkt/agents"); return Array.isArray(v) ? v : []; }
export async function agentsPart(s) {
  const C = await base(s), set = C.set, pros = await loadProspects(s), cards = await agentsCard(s), t = C.t;
  const done = (await s.get("mkt/agentdone")) || {};
  const demo = `${SITE()}/demo/agent`;
  const byPhone = Object.fromEntries(cards.filter((c) => c.phone).map((c) => [c.phone, c]));
  const used = new Set();
  const list = pros.map((p) => {
    const c = (p.agentId && cards.find((x) => x.id === p.agentId)) || (mob(p.phone) && byPhone[mob(p.phone)]) || null;
    if (c) used.add(c.id);
    const stage = c && c.jobs >= 2 && ["target", "intro", "met", "first"].includes(p.stage) ? "regular" : c && c.jobs >= 1 && ["target", "intro", "met"].includes(p.stage) ? "first" : p.stage;
    return { ...p, stage, partner: c, phone: mob(p.phone) || (c && c.phone) || "" };
  });
  for (const c of cards) if (!used.has(c.id)) list.push({ id: "roster:" + c.id, agentId: c.id, name: c.name, agency: c.agency, phone: c.phone, stage: c.jobs >= 2 ? "regular" : c.jobs >= 1 ? "first" : "met", partner: c, fromRoster: true, log: [] });
  const lastTouch = (p) => { const l = (p.log || []).map((x) => x.at).sort().pop() || ""; const m = p.partner && p.partner.lastContact; return [l, m].filter(Boolean).sort().pop() || ""; };
  const qs = qStart(t), qk = quarterOf(t);
  for (const p of list) {
    p.last = lastTouch(p);
    p.due = p.stage !== "paused" && ((p.next && p.next <= t) || (p.stage === "target" && !p.last && !p.next) || (["first", "regular"].includes(p.stage) && (!p.last || daysBetween(p.last.slice(0, 10), t) >= set.agentEvery)));
    const f = first(p.name);
    if (p.stage === "target") p.draft = `Hi ${f}, it's Jack East from Bardon Clean. We're a pre-sale and deep cleaning team based in Bardon. I built a portal for agents that shows live progress and the after photos for each listing we clean. Here's a 1-minute demo: ${demo}\nWould you be open to a quick coffee, or me dropping off some info?`;
    else if (p.stage === "intro" || p.stage === "met") p.draft = `Hi ${f}, Jack from Bardon Clean. Thanks again for your time. If you've got a listing coming up that needs a pre-sale clean, I'd love to look after it. Happy to quote from photos.`;
    else if (["first", "regular"].includes(p.stage) && p.partner) {
      const jobs = C.B.filter((b) => b.j.agentId === p.partner.id && b.date >= qs && b.date <= t);
      p.quarter = { n: jobs.length, list: jobs.map((b) => place(b.j)) };
      p.wrapSent = !!done[p.partner.id + ":" + qk];
      p.draft = jobs.length
        ? `Hi ${f}, Jack from Bardon Clean. Thanks for trusting us with ${jobs.length === 1 ? "your listing" : jobs.length + " of your listings"} this quarter (${p.quarter.list.slice(0, 4).join(", ")}${jobs.length > 4 ? " and more" : ""}). The reports and photos are all in your portal: ${SITE()}/a/${p.partner.token}\nAnything coming up I can help with?`
        : `Hi ${f}, Jack from Bardon Clean. Just checking in. If you've got anything coming up that needs a pre-sale clean, I'd love to help. Your portal is here any time: ${SITE()}/a/${p.partner.token}`;
    }
    if (p.draft && p.phone) p.href = textHref(p.phone, p.name, p.draft);
  }
  const order = Object.fromEntries(STAGES.map(([k], i) => [k, i]));
  list.sort((a, b) => (b.due - a.due) || (order[a.stage] - order[b.stage]) || a.name.localeCompare(b.name));
  return { stages: STAGES, list, every: set.agentEvery, quarter: qk, active: cards.filter((c) => c.lastJob && daysBetween(c.lastJob, t) <= 90).length };
}
export async function saveProspect(s, b) {
  const l = await loadProspects(s);
  const name = str(b.name, 120);
  if (name.length < 2) return { error: "Add the agent's name." };
  const stage = STAGES.some(([k]) => k === b.stage) ? b.stage : "target";
  const fields = { name, agency: str(b.agency, 120), suburb: str(b.suburb, 80), phone: str(b.phone, 30), email: str(b.email, 160), stage, next: /^\d{4}-\d{2}-\d{2}$/.test(b.next || "") ? b.next : "", notes: str(b.notes, 1500), agentId: str(b.agentId, 60) };
  const id = str(b.id, 60);
  const i = l.findIndex((x) => x.id === id);
  if (i >= 0) l[i] = { ...l[i], ...fields };
  else l.push({ id: id && id.startsWith("roster:") ? nid("ag") : nid("ag"), ...fields, log: [], at: new Date().toISOString() });
  await s.set("mkt/agents", l);
  return { ok: true };
}
export async function logProspect(s, b) {
  const l = await loadProspects(s), id = str(b.id, 60), text = str(b.text, 300) || "Touched base";
  let p = l.find((x) => x.id === id);
  if (!p && id.startsWith("roster:")) { // first log on a portal agent: start a pipeline card for them
    const roster = await loadRoster(s), a = (roster.agents || []).find((x) => "roster:" + x.id === id);
    if (!a) return { error: "Agent not found" };
    p = { id: nid("ag"), name: a.name, agency: a.agency || "", suburb: "", phone: a.phone || "", email: a.email || "", stage: "first", next: "", notes: "", agentId: a.id, log: [], at: new Date().toISOString() };
    l.push(p);
  }
  if (!p) return { error: "Agent not found" };
  p.log = [...(p.log || []), { at: new Date().toISOString(), t: text }].slice(-50);
  if (/^\d{4}-\d{2}-\d{2}$/.test(b.next || "")) p.next = b.next; else if (p.next && p.next <= bneToday()) p.next = "";
  if (STAGES.some(([k]) => k === b.stage)) p.stage = b.stage;
  await s.set("mkt/agents", l);
  if (b.wrap && p.agentId) { const d = (await s.get("mkt/agentdone")) || {}; d[p.agentId + ":" + quarterOf(bneToday())] = new Date().toISOString(); await s.set("mkt/agentdone", d); }
  return { ok: true };
}
export async function delProspect(s, id) { await s.set("mkt/agents", (await loadProspects(s)).filter((x) => x.id !== id)); return { ok: true }; }

// ---------------- past clients: nudges, consent, referrals ----------------
export async function clientsPart(s) {
  const C = await base(s), t = C.t;
  const rb = await rebook(s);
  const nudges = rb.map((x) => {
    const c = consentOf(x.phone, C.consent, C.idx);
    const draft = /STOP/.test(x.draft) ? x.draft : `${x.draft} ${OPT_OUT}`;
    return { ...x, consent: c, draft, href: x.phone && c !== "out" ? textHref(x.phone, x.name, draft) : "" };
  });
  // Referral links that exist, and the leads they brought in.
  const refKeys = await s.list("ref/");
  const refs = (await Promise.all(refKeys.map(async (k) => ({ code: k.slice(4), ...((await s.get(k)) || {}) })))).filter((x) => x.name || x.bk);
  const rewards = (await s.get("mkt/rewards")) || {};
  const qById = Object.fromEntries(C.docs.filter((d) => d.kind === "quote").map((d) => [d.id, d]));
  const referred = C.reqs.filter((r) => r.refBy).map((r) => {
    const q = r.quoteId && qById[r.quoteId];
    return { id: r.id, name: r.name, at: r.at, by: r.refBy.name || "a past client", byCode: r.refBy.code, won: !!q && q.state === "accepted", revenue: q && q.state === "accepted" ? Math.round(q.totals.total) : 0, reward: rewards[r.id] || null };
  });
  const refCount = {};
  for (const r of referred) refCount[r.byCode] = (refCount[r.byCode] || 0) + 1;
  // Recent happy, finished clients who don't have a referral link yet.
  const withRef = new Set(refs.map((r) => r.bk));
  const fbKeys = new Set((await s.list("fb/")).map((k) => k.slice(3)));
  const askRef = [];
  for (const b of C.B.slice().sort((x, y) => y.last.localeCompare(x.last))) {
    if (b.last >= t || daysBetween(b.last, t) > 60 || withRef.has(b.key) || b.j.sample) continue;
    const fb = fbKeys.has(b.key) ? await s.get(`fb/${b.key}`) : null;
    if (fb && fb.mood === "issue") continue;
    askRef.push({ bk: b.key, name: b.j.client || "Client", service: b.j.service || "", date: b.last, phone: phoneFor(b.days, C.docs), happy: !!(fb && fb.mood === "happy") });
    if (askRef.length >= 15) break;
  }
  const phones = new Set();
  for (const b of C.B) { const p = phoneFor(b.days, C.docs); if (p) phones.add(p); }
  const counts = { clients: phones.size, yes: 0, out: 0 };
  for (const p of phones) { const c = consentOf(p, C.consent, C.idx); if (c === "yes") counts.yes++; if (c === "out") counts.out++; }
  return {
    nudges, referred: referred.sort((a, b) => b.at.localeCompare(a.at)),
    refs: refs.map((r) => ({ code: r.code, name: r.name || "", suburb: r.suburb || "", at: r.at || "", n: refCount[r.code] || 0, link: `${SITE()}/quote?src=ref-${r.code}` })).sort((a, b) => b.n - a.n || String(b.at).localeCompare(String(a.at))),
    askRef, consent: counts,
    consentList: Object.entries(C.consent).map(([p, x]) => ({ phone: p, name: x.name, at: x.at, via: x.via, out: !!(C.idx[p] && C.idx[p].optout) })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200),
  };
}
export async function setReward(s, b) {
  const r = (await s.get("mkt/rewards")) || {}, id = str(b.id, 60);
  if (!id) return { error: "Missing referral" };
  if (b.value === false) delete r[id]; else r[id] = { at: new Date().toISOString(), note: str(b.note, 160) };
  await s.set("mkt/rewards", r); return { ok: true };
}

// ---------------- PR and brand library ----------------
export async function loadPr(s) { const v = await s.get("mkt/pr"); return Array.isArray(v) ? v : []; }
export async function savePr(s, b) {
  const l = await loadPr(s), id = str(b.id, 60);
  const kind = ["contact", "pitch", "coverage"].includes(b.kind) ? b.kind : "pitch";
  const name = str(b.name, 160);
  if (name.length < 2) return { error: kind === "contact" ? "Add their name." : "Add a title." };
  const f = { kind, name, outlet: str(b.outlet, 120), contact: str(b.contact, 160), status: str(b.status, 40), date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : bneToday(), link: /^https?:\/\//.test(b.link || "") ? str(b.link, 400) : "", notes: str(b.notes, 2000) };
  const i = l.findIndex((x) => x.id === id);
  if (i >= 0) l[i] = { ...l[i], ...f }; else l.push({ id: nid("pr"), ...f });
  await s.set("mkt/pr", l); return { ok: true };
}
export async function delPr(s, id) { await s.set("mkt/pr", (await loadPr(s)).filter((x) => x.id !== id)); return { ok: true }; }

// Only facts Jack has stated about the business. He edits or adds to these himself.
export const BRAND_SEED = {
  blocks: [
    { id: "b1", title: "What we do", text: "Bardon Clean is a premium residential cleaning business in Brisbane's inner west, specialising in pre-sale, bond and deep cleaning." },
    { id: "b2", title: "Our team", text: "We pay our team above award, with overtime on bigger jobs." },
    { id: "b3", title: "Insurance", text: "$20 million public liability, WorkCover, professional indemnity, income protection, and property and equipment insurance." },
    { id: "b4", title: "How we clean", text: "Fresh microfibre cloths on every clean, never reused between homes. Tools cleaned before and after every clean. Products tested and refined constantly." },
    { id: "b5", title: "Why we started", text: "Jack started Bardon Clean in 2025 after seeing too many people have bad experiences with cleaners." },
    { id: "b6", title: "Contact", text: "hello@bardonclean.au · bardonclean.au · Text 0468 193 772" },
  ],
  files: [
    { id: "f1", title: "Website", url: "https://bardonclean.au/" },
    { id: "f2", title: "Quote form", url: "https://bardon-roster.netlify.app/quote" },
    { id: "f3", title: "Agent portal demo", url: "https://bardon-roster.netlify.app/demo/agent" },
  ],
};
export async function loadBrand(s) { return (await s.get("mkt/brand")) || BRAND_SEED; }
export async function saveBrand(s, b) {
  const blocks = (Array.isArray(b.blocks) ? b.blocks : []).map((x) => ({ id: str(x.id, 40) || nid("b"), title: str(x.title, 80), text: str(x.text, 2000) })).filter((x) => x.title || x.text).slice(0, 60);
  const files = (Array.isArray(b.files) ? b.files : []).map((x) => ({ id: str(x.id, 40) || nid("f"), title: str(x.title, 80), url: /^https?:\/\//.test(x.url || "") ? str(x.url, 500) : "" })).filter((x) => x.title && x.url).slice(0, 60);
  await s.set("mkt/brand", { blocks, files }); return { ok: true };
}

// ---------------- quiet weeks ----------------
export async function weeksAhead(s, quietPct) {
  const cap = await capacity(s), per = cap.perDay || 2, weeks = [];
  let cur = null;
  for (const d of cap.days) {
    if (d.dow === 1 || !cur) { cur = { from: d.date, to: d.date, open: 0, used: 0, free: 0 }; weeks.push(cur); }
    cur.to = d.date;
    if (d.closed) continue;
    cur.open += per; cur.used += Math.min(per, d.jobs.length);
    if (!d.jobs.length && d.free) cur.free++;
  }
  return weeks.filter((w) => w.open).map((w) => ({ ...w, pct: Math.round((w.used / w.open) * 100), quiet: Math.round((w.used / w.open) * 100) < quietPct }));
}

// ---------------- overview ----------------
export async function overviewPart(s) {
  const C = await base(s), set = C.set, t = C.t;
  const [src, rv, ag, cl, wk] = await Promise.all([sourcesPart(s, 90), reviewsPart(s), agentsPart(s), clientsPart(s), weeksAhead(s, set.quietPct)]);
  const rows30 = await leadRows(s, C, 30);
  const replied = rows30.filter((r) => r.reply != null).map((r) => r.reply);
  const waiting = rows30.filter((r) => r.status === "new" && r.reply == null && !r.quoted);
  const quoted = rows30.filter((r) => r.quoted), won = rows30.filter((r) => r.won);
  const monthSpend = (await loadSpend(s)).filter((x) => x.month === t.slice(0, 7)).reduce((n, x) => n + x.amt, 0);
  const quiet = wk.filter((w) => w.quiet);
  const levers = [];
  if (quiet.length) {
    const due = ag.list.filter((p) => p.due).length;
    if (due) levers.push({ label: `${due} agent${due === 1 ? "" : "s"} due a touch`, tab: "agents" });
    const nud = cl.nudges.filter((x) => x.href).length;
    if (nud) levers.push({ label: `${nud} past client${nud === 1 ? "" : "s"} worth a nudge`, tab: "clients" });
    if (cl.askRef.length) levers.push({ label: `${cl.askRef.length} recent client${cl.askRef.length === 1 ? "" : "s"} to send a referral link`, tab: "clients" });
    levers.push({ label: monthSpend ? "Lift your ad budget for the quiet dates" : "Consider a short Google Ads burst for the quiet dates", tab: "ads" });
  }
  const todo = [
    waiting.length && { n: waiting.length, label: `lead${waiting.length === 1 ? "" : "s"} waiting on a first reply`, tab: "leads" },
    rv.ask.length + rv.remind.length && { n: rv.ask.length + rv.remind.length, label: "review request" + (rv.ask.length + rv.remind.length === 1 ? "" : "s") + " ready", tab: "reviews" },
    ag.list.filter((p) => p.due).length && { n: ag.list.filter((p) => p.due).length, label: "agent touch" + (ag.list.filter((p) => p.due).length === 1 ? "" : "es") + " due", tab: "agents" },
    cl.nudges.filter((x) => x.href).length && { n: cl.nudges.filter((x) => x.href).length, label: "past client nudge" + (cl.nudges.filter((x) => x.href).length === 1 ? "" : "s"), tab: "clients" },
    cl.referred.filter((r) => r.won && !r.reward).length && { n: cl.referred.filter((r) => r.won && !r.reward).length, label: "referral reward" + (cl.referred.filter((r) => r.won && !r.reward).length === 1 ? "" : "s") + " to give", tab: "clients" },
  ].filter(Boolean);
  return {
    today: t, todo,
    revenue: { total: src.shares.total, agents: src.shares.agents, repeat: src.shares.repeat, top: src.rows.slice(0, 5) },
    funnel: { leads: rows30.length, quoted: quoted.length, won: won.length, rate: quoted.length ? Math.round((won.length / quoted.length) * 100) : null },
    speed: { median: median(replied), target: set.respondMins, waiting: waiting.length, n: replied.length },
    reviews: { asked30: rv.stats.asked30, leftMonth: rv.stats.leftMonth, newMonth: rv.stats.newMonth, latest: rv.stats.latest, target: set.reviewTarget },
    weeks: wk, quiet: quiet.length, levers,
    channels: src.channels, agentsActive: ag.active, consent: cl.consent,
  };
}

// ---------------- scheduled nudges (from checks) ----------------
export async function growthWeek(s) {
  const o = await overviewPart(s);
  const lines = [];
  if (o.revenue.total) lines.push(`Last 90 days: $${o.revenue.total.toLocaleString("en-AU")} won · ${o.revenue.agents}% from agents · ${o.revenue.repeat}% repeat & referral`);
  lines.push(`Last 30 days: ${o.funnel.leads} leads, ${o.funnel.quoted} quoted, ${o.funnel.won} won`);
  if (o.speed.median != null) lines.push(`Median first reply: ${o.speed.median < 60 ? o.speed.median + " min" : Math.round(o.speed.median / 6) / 10 + " h"}`);
  if (o.quiet) lines.push(`${o.quiet} quiet week${o.quiet === 1 ? "" : "s"} in the next four`);
  for (const x of o.todo) lines.push(`${x.n} ${x.label}`);
  return { type: "growth_week", title: "Monday growth check", body: lines.join("\n"), tags: "chart_with_upwards_trend", url: "/marketing/" };
}
