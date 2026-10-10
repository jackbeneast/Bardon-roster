// Two-way client texting through Mobile Message, kept in the hub.
// One conversation per mobile number: thr/<04xxxxxxxx>. A small index blob
// (msgindex) keeps the inbox fast. Replies arrive by webhook from Mobile
// Message, and the inbox also pulls /v1/inbound as a backstop, so a missed
// webhook never loses a reply. Every write is idempotent on the message id.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { auMobile, mmReady } from "./mm.mjs";

const MAX_MSGS = 400;
const API = "https://api.mobilemessage.com.au/v1";
const SITE = () => (process.env.URL || "https://bardon-roster.netlify.app").replace(/\/$/, "");
const auth = () => "Basic " + Buffer.from(`${process.env.MM_API_USER}:${process.env.MM_API_PASS}`).toString("base64");

// Mobile Message gives times as UTC, sometimes without a zone marker.
export function isoUtc(v) {
  if (!v) return new Date().toISOString();
  let t = String(v).trim().replace(" ", "T");
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(t)) t += "Z";
  const ms = Date.parse(t);
  return isNaN(ms) ? new Date().toISOString() : new Date(ms).toISOString();
}
// Same reply via webhook or via polling -> same id.
const inId = (from, at, text) => "i" + createHash("sha256").update(`${from}|${at.slice(0, 19)}|${text}`).digest("hex").slice(0, 20);

export async function loadIndex(s) { return (await s.get("msgindex")) || {}; }
export async function loadThread(s, phone) {
  return (await s.get(`thr/${phone}`)) || { phone, msgs: [], unread: 0 };
}

async function saveThread(s, t) {
  t.msgs.sort((a, b) => a.at.localeCompare(b.at));
  if (t.msgs.length > MAX_MSGS) t.msgs = t.msgs.slice(-MAX_MSGS);
  const last = t.msgs[t.msgs.length - 1];
  t.lastAt = last ? last.at : t.lastAt || "";
  await s.set(`thr/${t.phone}`, t);
  const idx = await loadIndex(s);
  idx[t.phone] = {
    name: t.name || "", last: last ? last.text.slice(0, 140) : "", lastAt: t.lastAt, lastDir: last ? last.dir : "",
    unread: t.unread || 0, archived: !!t.archived, optout: !!t.optout,
  };
  await s.set("msgindex", idx);
}

// Log a text the hub just sent. Called from sendSms, so every client text
// (quotes, invoices, confirmations, lead replies) shows in the conversation.
export async function logOut(s, toRaw, text, id, ref = "", name = "") {
  const phone = auMobile(toRaw);
  if (!phone) return;
  const t = await loadThread(s, phone);
  const mid = id || "o" + randomBytes(8).toString("hex");
  if (t.msgs.some((m) => m.id === mid)) return;
  t.msgs.push({ id: mid, dir: "out", text: String(text).slice(0, 1500), at: new Date().toISOString(), status: "sent", ref: String(ref || "").slice(0, 60) });
  if (name && !t.name) t.name = String(name).slice(0, 120);
  t.unread = 0;
  t.archived = false;
  await saveThread(s, t);
}

// A reply from a client. Returns the thread if it was new, else null.
export async function logIn(s, fromRaw, text, receivedAt, kind = "inbound") {
  const phone = auMobile(fromRaw);
  if (!phone) return null;
  const at = isoUtc(receivedAt);
  const t = await loadThread(s, phone);
  if (kind === "unsubscribe") {
    if (t.optout) return null;
    t.optout = true;
    t.msgs.push({ id: inId(phone, at, "STOP"), dir: "sys", text: "Unsubscribed from your texts. Mobile Message will block further texts to this number.", at });
    await saveThread(s, t);
    return t;
  }
  const msg = String(text || "").slice(0, 1600);
  const id = inId(phone, at, msg);
  if (t.msgs.some((m) => m.id === id)) return null;
  t.msgs.push({ id, dir: "in", text: msg, at });
  t.unread = (t.unread || 0) + 1;
  t.archived = false;
  await saveThread(s, t);
  return t;
}

// Delivery receipts. Long texts arrive one receipt per part.
export async function logStatus(s, toRaw, messageId, status) {
  const phone = auMobile(toRaw);
  if (!phone || !messageId) return;
  const t = await s.get(`thr/${phone}`);
  if (!t) return;
  const m = t.msgs.find((x) => x.id === messageId);
  if (!m || m.status === "failed" || m.status === status) return;
  m.status = status === "failed" ? "failed" : "delivered";
  await s.set(`thr/${phone}`, t);
}

export async function markRead(s, phone) {
  const t = await s.get(`thr/${phone}`);
  if (!t || !t.unread) return;
  t.unread = 0;
  await saveThread(s, t);
}

export async function setMeta(s, phone, patch) {
  const t = await loadThread(s, phone);
  if (typeof patch.name === "string") t.name = patch.name.trim().slice(0, 120);
  if (typeof patch.archived === "boolean") t.archived = patch.archived;
  await saveThread(s, t);
}

export const unreadCount = (idx) => Object.values(idx).filter((x) => !x.archived).reduce((n, x) => n + (x.unread || 0), 0);

// ---- webhooks ----
// The hook URL carries a private key, so nobody else can post fake replies.
// If Jack also sets a signing secret (MM_WEBHOOK_SECRET), signatures are checked too.
export async function hookKey(s) {
  let h = await s.get("mmhook");
  if (!h || !h.key) { h = { key: randomBytes(18).toString("hex") }; await s.set("mmhook", h); }
  return h;
}
export const hookUrl = (key) => `${SITE()}/api/mm-hook?k=${key}`;

export function verifySig(req, raw) {
  const secret = process.env.MM_WEBHOOK_SECRET;
  if (!secret) return true;
  const ts = req.headers.get("x-mm-timestamp") || "", sig = req.headers.get("x-mm-signature") || "";
  if (!ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const want = createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
  const a = Buffer.from(want), b = Buffer.from(sig.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

async function mm(method, path, body) {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", authorization: auth() }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}

// Point Mobile Message's inbound and delivery webhooks at the hub.
export async function connectHooks(s) {
  if (!mmReady()) return { ok: false, error: "Mobile Message isn't connected yet. Add MM_API_USER and MM_API_PASS in Netlify." };
  const h = await hookKey(s), url = hookUrl(h.key);
  try {
    for (const type of ["inbound", "status"]) {
      const r = await mm("POST", "/webhooks", { type, url });
      if (r.status === 401) return { ok: false, error: "Mobile Message rejected the login. Check MM_API_USER and MM_API_PASS in Netlify." };
      if (!r.ok) return { ok: false, error: r.d.error || r.d.message || `Mobile Message didn't accept the ${type} link.` };
    }
  } catch { return { ok: false, error: "Couldn't reach Mobile Message. Try again." }; }
  await s.set("mmhook", { ...h, on: true, at: new Date().toISOString() });
  return { ok: true };
}

// Backstop: pull recent replies straight from Mobile Message.
// Runs at most once a minute, looks back two days.
export async function pullInbound(s, force = false) {
  if (!mmReady()) return 0;
  const st = (await s.get("mmpull")) || {};
  if (!force && st.at && Date.now() - Date.parse(st.at) < 60e3) return 0;
  await s.set("mmpull", { at: new Date().toISOString() });
  const from = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  let added = 0;
  try {
    const r = await mm("GET", `/inbound?from=${from}&limit=200`);
    if (!r.ok) return 0;
    for (const m of r.d.results || []) if (await logIn(s, m.from, m.message, m.received_at, m.type || "inbound")) added++;
  } catch { /* the webhook is the main path; a failed pull is fine */ }
  return added;
}

// ---- who is this number? ----
// Built from quote requests, quotes/invoices, agents and the team.
export function directory({ requests = [], docs = [], agents = [], team = [], contacts = [] }) {
  const out = {};
  const add = (raw, name, ctx) => {
    const p = auMobile(raw);
    if (!p) return;
    const e = (out[p] ||= { name: "", ctx: [] });
    if (!e.name && name) e.name = String(name).trim();
    if (ctx) e.ctx.push(ctx);
  };
  for (const r of requests) add(r.phone, r.name, { kind: "lead", at: r.at, label: `Quote request · ${r.serviceLabel || ""}${r.suburb ? ", " + r.suburb : ""}`.replace(/ · ,/, " ·").replace(/ · $/, ""), href: `/money/#/req/${r.id}` });
  for (const d of docs) if (d.client) add(d.client.phone, d.client.name, { kind: d.kind, at: d.created, label: `${d.kind === "invoice" ? "Invoice" : "Quote"} #${d.num}${d.service ? " · " + d.service : ""}${d.suburb ? ", " + d.suburb : ""}`, href: `/money/#/doc/${d.id}`, state: d.state || d.status || "" });
  for (const a of agents) add(a.phone, a.name, { kind: "agent", label: `Agent${a.agency ? " · " + a.agency : ""}` });
  for (const t of team) add(t.phone, t.name, { kind: "team", label: "Team" });
  // Saved contacts fill gaps only: a lead or client keeps its richer label.
  for (const c of contacts) if (!out[auMobile(c.phone)]?.ctx.length) add(c.phone, c.name, { kind: "contact", at: c.at, label: c.note ? `Contact · ${c.note}` : "Contact" });
  for (const e of Object.values(out)) e.ctx.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return out;
}

// ---- saved contacts ----
// People Jack wants to text who aren't a lead, client, agent or team member:
// added by hand or brought in from his phone's contacts. One per mobile.
export async function loadContacts(s) { return (await s.get("contacts")) || []; }
export async function saveContacts(s, list) {
  const cur = await loadContacts(s), byPhone = new Map(cur.map((c) => [c.phone, c]));
  let added = 0, updated = 0;
  for (const x of (list || []).slice(0, 2000)) {
    const phone = auMobile(x && x.phone);
    if (!phone) continue;
    const name = String((x && x.name) || "").trim().slice(0, 120);
    const note = String((x && x.note) || "").trim().slice(0, 60);
    const had = byPhone.get(phone);
    if (had) {
      if ((name && had.name !== name) || (note && had.note !== note)) { if (name) had.name = name; if (note) had.note = note; updated++; }
    } else { byPhone.set(phone, { phone, name, note, at: new Date().toISOString() }); added++; }
  }
  await s.set("contacts", [...byPhone.values()]);
  return { added, updated };
}
export async function removeContact(s, phone) {
  const cur = await loadContacts(s);
  await s.set("contacts", cur.filter((c) => c.phone !== phone));
}
