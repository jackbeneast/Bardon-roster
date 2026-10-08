// Jobber sync. Jobber publishes every visit as a calendar feed (.ics). We read
// that feed, put recurring visits straight onto the roster, keep their times in
// step with Jobber, and list one-off jobs that aren't on the roster yet so Jack
// can add them with one tap. The feed URL is a private link, kept only in Blobs.
import { randomBytes } from "node:crypto";
import { loadRoster } from "./core.mjs";

const BNE = 10 * 3600e3; // Brisbane has no daylight saving
const pad = (n) => String(n).padStart(2, "0");
export const bneToday = () => new Date(Date.now() + BNE).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const uid = (p) => p + Date.now().toString(36) + randomBytes(3).toString("hex");
export const fyStart = (d = bneToday()) => (+d.slice(5, 7) >= 7 ? d.slice(0, 4) : String(+d.slice(0, 4) - 1)) + "-07-01";

// ---------- .ics parsing ----------
function unfold(text) { return String(text).replace(/\r\n/g, "\n").replace(/\n[ \t]/g, ""); }
function unescape(v) { return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1"); }

// Wall-clock time in an IANA zone -> UTC ms.
function zoned(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  try {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const p = Object.fromEntries(f.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    const asIf = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return guess - (asIf - guess);
  } catch { return guess - BNE; }
}
function parseWhen(params, v) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { ms: Date.UTC(+y, +mo - 1, +d) - BNE, allDay: true };
  if (z) return { ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)), allDay: false };
  const tz = /TZID=([^;:]+)/.exec(params)?.[1];
  return { ms: tz ? zoned(+y, +mo, +d, +h, +mi, +(s || 0), tz) : Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)) - BNE, allDay: false };
}

export function parseIcs(text) {
  const out = [];
  let ev = null;
  for (const line of unfold(text).split("\n")) {
    if (line === "BEGIN:VEVENT") { ev = {}; continue; }
    if (line === "END:VEVENT") { if (ev && ev.uid && ev.start) out.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = line.indexOf(":"); if (i < 0) continue;
    const head = line.slice(0, i), val = line.slice(i + 1);
    const name = head.split(";")[0].toUpperCase(), params = head.slice(name.length);
    if (name === "UID") ev.uid = val.trim();
    else if (name === "SUMMARY") ev.summary = unescape(val).trim();
    else if (name === "DESCRIPTION") ev.desc = unescape(val).trim();
    else if (name === "LOCATION") ev.location = unescape(val).trim();
    else if (name === "STATUS") ev.status = val.trim().toUpperCase();
    else if (name === "DTSTART") ev.start = parseWhen(params, val);
    else if (name === "DTEND") ev.end = parseWhen(params, val);
  }
  return out.filter((e) => e.status !== "CANCELLED");
}

// ---------- turning a Jobber visit into roster terms ----------
const HONOR = /^(mr|mrs|ms|miss|dr)\.?\s+/i;
export const streetKey = (a) => { const m = /(\d+[a-z]?)\s+([a-z]+)/i.exec(String(a || "").replace(/^(unit|u)\s*\d+\s*[,/]\s*/i, "")); return m ? (m[1] + " " + m[2]).toLowerCase() : ""; };
const norm = (s) => String(s || "").toLowerCase().replace(HONOR, "").replace(/[^a-z0-9& ]/g, "").replace(/\s+/g, " ").trim();
const REC = /weekly|fortnightly|monthly|ongoing|regular|recurring|open home/i;

export function serviceOf(t, rec) {
  if (rec) return "Regular clean";
  if (/pre.?sale/i.test(t)) return "Pre-sale clean";
  if (/bond|end of lease|exit clean/i.test(t)) return "Bond clean";
  if (/deep/i.test(t)) return "Deep clean";
  if (/commercial|office/i.test(t)) return "Commercial";
  return "Other";
}

function splitLocation(loc) {
  const parts = String(loc || "").split(",").map((x) => x.trim()).filter(Boolean);
  const st = parts.findIndex((p) => /^(queensland|qld|nsw|new south wales|victoria|vic)\b/i.test(p));
  if (st > 0) return { address: parts.slice(0, st - 1).join(", "), suburb: parts[st - 1] };
  return { address: parts[0] || "", suburb: parts[1] || "" };
}

export function toVisit(ev) {
  const sum = ev.summary || "";
  const dash = sum.indexOf(" - ");
  let client = dash > 0 ? sum.slice(0, dash).replace(HONOR, "").trim() : "";
  const rest = dash > 0 ? sum.slice(dash + 3) : sum;
  const title = rest.split("|")[0].trim() || rest.trim();
  const { address, suburb } = splitLocation(ev.location);
  const endMs = ev.end ? ev.end.ms : ev.start.ms + 3 * 3600e3;
  const long = ev.start.allDay || endMs - ev.start.ms >= 20 * 3600e3;
  // "Anytime" visits come through as a 24-hour block: use the middle of it for the day.
  const at = (ms) => new Date(ms + BNE).toISOString();
  const date = long ? at((ev.start.ms + endMs) / 2).slice(0, 10) : at(ev.start.ms).slice(0, 10);
  const start = long ? "08:00" : at(ev.start.ms).slice(11, 16);
  let end = long ? "16:00" : at(endMs).slice(11, 16);
  if (!long && at(endMs).slice(0, 10) !== date) end = "23:59";
  const noName = !client;
  if (!client) client = address || title || "Jobber job";
  return { noName, uid: ev.uid, date, start, end, client, title, address, suburb, anytime: long, rec: REC.test(sum), sk: streetKey(address || rest), summary: sum };
}

// A street seen on 3+ different weeks is recurring even without the word "weekly".
export function classify(visits) {
  // Visits with no client in the title borrow the client seen at the same street.
  const names = {};
  for (const v of visits) if (!v.noName && v.sk) names[v.sk] ||= v.client;
  for (const v of visits) if (v.noName && names[v.sk]) v.client = names[v.sk];
  const byKey = {};
  for (const v of visits) if (v.sk) (byKey[v.sk] ||= []).push(v);
  for (const list of Object.values(byKey)) {
    const weeks = new Set(list.map((v) => Math.floor(Date.parse(v.date) / (7 * 864e5))));
    if (weeks.size >= 3 && list.some((v) => v.rec)) list.forEach((v) => { if (REC.test(v.summary)) v.rec = true; });
    else if (weeks.size >= 4) list.forEach((v) => (v.rec = true));
  }
  return visits;
}

// Is this visit already on the roster (added by hand or from a quote)?
function matchJob(v, jobs) {
  return jobs.find((j) => !j.sample && j.date === v.date && (j.jid === v.uid ||
    (v.sk && streetKey(j.address) === v.sk) || (!j.address && norm(j.client) === norm(v.client))));
}

const jobSig = (v) => `${v.date}|${v.start}|${v.end}`;

function makeJob(v, owner, extra = {}) {
  const o = {
    id: uid("j"), date: v.date, start: v.start, end: v.end, client: v.client.slice(0, 120), suburb: v.suburb.slice(0, 80),
    address: v.address.slice(0, 160), service: serviceOf(v.title, v.rec), staff: owner ? [owner] : [], share: randomBytes(18).toString("hex"),
    notes: `From Jobber: ${v.title}${v.anytime ? " (anytime visit, check the time)" : ""}.`.slice(0, 2000),
    src: "jobber", jid: v.uid, js: jobSig(v), addedAt: new Date().toISOString(), ...extra,
  };
  if (v.rec) o.rec = v.sk;
  return o;
}

export async function loadJobber(s) {
  const j = (await s.get("jobber")) || {};
  return { url: j.url || "", skip: Array.isArray(j.skip) ? j.skip : [], last: j.last || null, series: j.series || [], pending: j.pending || [] };
}

export async function fetchFeed(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url.replace(/^webcal:/i, "https:"), { signal: ctl.signal, headers: { accept: "text/calendar" } });
    if (!r.ok) throw new Error(`Jobber said ${r.status}. Check the calendar link.`);
    const text = await r.text();
    if (!/BEGIN:VCALENDAR/.test(text)) throw new Error("That link isn't a calendar feed. Copy the link from Jobber's calendar sync settings.");
    return text;
  } finally { clearTimeout(t); }
}

// The sync itself. Recurring visits are applied to the roster; one-offs are listed for review.
// opts.add = [uid] one-offs to add now, opts.ignore = [uid] to stop suggesting.
export async function syncJobber(s, opts = {}) {
  const cfg = await loadJobber(s);
  if (!cfg.url) return { ok: false, error: "Add your Jobber calendar link first." };
  const visits = classify(parseIcs(await fetchFeed(cfg.url)).map(toVisit)).filter((v) => v.address && !/assessment|request|reminder/i.test(v.summary));
  const today = bneToday(), from = fyStart(), to = addDays(today, 120);
  const inWin = visits.filter((v) => v.date >= from && v.date <= to);
  const skip = new Set([...cfg.skip, ...(opts.ignore || [])]);
  const want = new Set(opts.add || []);
  const roster = await loadRoster(s);
  const owner = roster.team.find((t) => t.owner)?.id;
  const byJid = new Map(roster.jobs.filter((j) => j.jid).map((j) => [j.jid, j]));
  let added = 0, updated = 0, removed = 0, linked = 0;
  const pending = [];

  // One-offs added together: consecutive days at the same street become one multi-day booking.
  const oneOffGroups = {};
  for (const v of inWin) {
    const have = byJid.get(v.uid);
    if (have) {
      // Jobber moved it: follow, unless Jack has since changed it here too.
      if (have.js && have.js !== jobSig(v)) {
        if (`${have.date}|${have.start}|${have.end}` === have.js) { have.date = v.date; have.start = v.start; have.end = v.end; updated++; }
        have.js = jobSig(v);
      }
      continue;
    }
    if (skip.has(v.uid)) continue;
    const m = matchJob(v, roster.jobs);
    if (m) { if (!m.jid) { m.jid = v.uid; m.js = jobSig(v); byJid.set(v.uid, m); linked++; } continue; }
    if (v.rec) { const j = makeJob(v, owner); roster.jobs.push(j); byJid.set(v.uid, j); added++; continue; }
    if (want.has(v.uid)) { (oneOffGroups[v.sk || v.uid] ||= []).push(v); continue; }
    pending.push(v);
  }
  for (const list of Object.values(oneOffGroups)) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const group = run.length > 1 ? uid("g") : null, share = randomBytes(18).toString("hex");
      for (const v of run) { const j = makeJob(v, owner, { share, ...(group ? { group } : {}) }); roster.jobs.push(j); added++; }
      run = [];
    };
    for (const v of list) { if (run.length && addDays(run[run.length - 1].date, 1) !== v.date) flush(); run.push(v); }
    flush();
  }

  // Cancelled in Jobber: future visits we imported that are no longer in the feed.
  const feedUids = new Set(visits.map((v) => v.uid));
  const lastFeedDate = visits.reduce((m, v) => (v.date > m ? v.date : m), "");
  roster.jobs = roster.jobs.filter((j) => {
    if (j.src === "jobber" && j.jid && j.date > today && j.date <= lastFeedDate && !feedUids.has(j.jid)) { removed++; return false; }
    return true;
  });

  // Recurring series, so Jack can set a price per visit once.
  const series = {};
  for (const j of roster.jobs) if (j.rec) {
    const x = (series[j.rec] ||= { key: j.rec, client: j.client, address: j.address, suburb: j.suburb, title: "", visits: 0, next: "", last: "" });
    x.visits++; if (j.date >= today && (!x.next || j.date < x.next)) x.next = j.date; if (j.date < today && j.date > x.last) x.last = j.date;
  }
  for (const v of visits) if (v.rec && series[v.sk] && !series[v.sk].title) series[v.sk].title = v.title;

  if (added || updated || removed || linked) await s.set("roster", { ...roster, savedAt: new Date().toISOString() });
  const last = { at: new Date().toISOString(), added, updated, removed, linked, visits: visits.length };
  const slim = pending.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 200)
    .map(({ uid, date, start, end, client, title, address, suburb, anytime }) => ({ uid, date, start, end, client, title, address, suburb, anytime }));
  await s.set("jobber", { url: cfg.url, skip: [...skip].slice(-2000), last, series: Object.values(series), pending: slim });
  return { ok: true, ...last, pending: slim, series: Object.values(series) };
}
