// Notifications for Jack: every event is logged to the activity feed in the
// hub, and pushed to his phone through the free ntfy app when a topic is set.
// A notification must never break the action that caused it, so nothing here throws.
import { randomBytes } from "node:crypto";

// Every kind of notification, grouped for the settings screen.
// [type, label, default on]
export const TYPES = [
  ["Team", [
    ["shift_yes", "Shift accepted", true],
    ["shift_no", "Shift declined", true],
    ["ack", "First-day info read", true],
    ["arrive", "Arrived on site", true],
    ["late", "Not checked in 15 min after start", true],
    ["flag", "Note or issue added on a job", true],
    ["finish", "Job marked ready", true],
    ["unfinished", "Not marked ready an hour after finish", true],
    ["tomorrow", "5pm check: tomorrow's shifts not confirmed or unassigned", true],
  ]],
  ["Clients", [
    ["quote_view", "Quote opened", true],
    ["quote_accept", "Quote accepted", true],
    ["quote_follow", "Quote opened 3 days ago, not accepted yet", true],
    ["quote_expiry", "Quote expires in 2 days", true],
    ["inv_view", "Invoice opened", true],
    ["paid", "Card payment received", true],
    ["deposit", "4pm check: deposits still unpaid", true],
    ["overdue", "Invoice becomes overdue", true],
  ]],
  ["Agents", [
    ["booking", "Booking request from an agent", true],
  ]],
  ["Money", [
    ["jobber", "New Jobber jobs not on the roster", true],
    ["money_week", "Monday 7am: last week's profit and what's missing", true],
  ]],
];
const DEFAULT_OFF = TYPES.flatMap(([, l]) => l.filter((t) => !t[2]).map((t) => t[0]));
const KNOWN = new Set(TYPES.flatMap(([, l]) => l.map((t) => t[0])));

export async function loadNotify(s) {
  const n = (await s.get("notify")) || {};
  return { topic: n.topic || "", off: Array.isArray(n.off) ? n.off : DEFAULT_OFF, server: n.server || "https://ntfy.sh" };
}
export function cleanNotify(b, prev) {
  const topic = typeof b.topic === "string" ? b.topic.trim() : prev.topic;
  if (topic && !/^[\w-]{12,64}$/.test(topic)) return null;
  const off = Array.isArray(b.off) ? b.off.filter((x) => KNOWN.has(x)) : prev.off;
  return { topic, off, server: prev.server };
}
export const newTopic = () => "bardon-" + randomBytes(12).toString("hex");

const SITE = () => (process.env.URL || "https://bardon-roster.netlify.app").replace(/\/$/, "");

// Push to ntfy. Waits at most 4 seconds so a slow push never holds up the team.
async function push(n, e) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const headers = { Title: ascii(e.title), Tags: e.tags || "", Priority: String(e.priority || 3) };
    if (e.url) headers.Click = SITE() + e.url;
    const r = await fetch(`${n.server}/${n.topic}`, { method: "POST", body: e.body || e.title, headers, signal: ctl.signal });
    return r.ok;
  } catch { return false; } finally { clearTimeout(timer); }
}
// HTTP header values must be plain text; ntfy shows the emoji from Tags instead.
const ascii = (t) => String(t || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "").slice(0, 200);

// Log an event to the activity feed and push it. e = {type, title, body, url, priority, tags}
export async function notify(s, e) {
  try {
    const at = new Date().toISOString();
    const rec = { type: e.type, title: String(e.title).slice(0, 200), body: String(e.body || "").slice(0, 600), url: e.url || "", at };
    await s.set(`act/${at}-${randomBytes(3).toString("hex")}`, rec);
    const n = await loadNotify(s);
    if (n.topic && !n.off.includes(e.type)) await push(n, e);
  } catch { /* never break the caller */ }
}

// Send a test straight away, so Jack can check his phone is set up.
export async function testPush(s) {
  const n = await loadNotify(s);
  if (!n.topic) return false;
  return push(n, { title: "Bardon Clean notifications are on", body: "You'll get a ping here when shifts are accepted, quotes and invoices are opened, and more.", tags: "bell", url: "/" });
}

// The latest events for the hub's activity feed. Prunes anything older than 60 days.
export async function loadActivity(s, limit = 100) {
  const keys = (await s.list("act/")).sort().reverse();
  const cutoff = "act/" + new Date(Date.now() - 60 * 86400e3).toISOString();
  const old = keys.filter((k) => k < cutoff);
  if (old.length) await Promise.all(old.slice(0, 200).map((k) => s.del(k)));
  const recent = keys.filter((k) => k >= cutoff).slice(0, limit);
  return (await Promise.all(recent.map((k) => s.get(k)))).filter(Boolean);
}

// For scheduled checks: true the first time a key is seen, false after that.
export async function once(s, key) {
  if (await s.get(`sent/${key}`)) return false;
  await s.set(`sent/${key}`, { at: new Date().toISOString() });
  return true;
}

// ---- wording helpers (Brisbane is UTC+10 all year) ----
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtTime(t) { if (!t) return ""; const h = +t.slice(0, 2), m = t.slice(3, 5); return (h % 12 || 12) + (m === "00" ? "" : ":" + m) + (h >= 12 ? "pm" : "am"); }
export function fmtDay(d) { const x = new Date(d + "T00:00:00Z"); return `${DAY[x.getUTCDay()]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]}`; }
export function clockNow() { return fmtTime(new Date(Date.now() + 10 * 3600e3).toISOString().slice(11, 16)); }
export const firstName = (n) => String(n || "").replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] || "Someone";
export const where = (j) => j.address || j.suburb || j.client || "a job";
export const money = (v) => "$" + (+v || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
