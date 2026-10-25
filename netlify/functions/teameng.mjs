// Team engagement: how the team uses the team app (/me).
//   POST (from the app, via sendBeacon, text/plain JSON):
//     { pid, sid, ev: "open"|"beat", ms, scr: {screen: ms}, acts: [{a, at}], dev, home }
//     { pid, ev: "tour", act: "start"|"step"|"done"|"skip", step, of, v }
//     { pid, ev: "invited" }   (admin only, when Jack sends the invite text)
//   GET            (admin) every team member's summary + what the team uses
//   GET ?p=<pid>   (admin) one person's sessions
// Jack's own visits (logged in to the hub) are never counted.
// Storage: teng/<pid> { sessions: [newest first, capped], tour, invited, first, home }
import { store, json, checkAdmin, loadRoster } from "../../lib/core.mjs";

const SID = /^[a-z0-9]{8,32}$/, PID = /^[\w-]{1,40}$/, MAX = 150;
const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const SCREENS = new Set(["today", "job", "room", "wrap", "guide", "kit", "me", "pay", "slip", "intro", "who"]);

async function record(s, b, admin) {
  const pid = String(b.pid || "");
  if (!PID.test(pid)) return;
  const roster = await loadRoster(s);
  if (!roster.team.some((t) => t.id === pid && !t.owner)) return;
  const k = `teng/${pid}`, r = (await s.get(k)) || { sessions: [] }, now = new Date().toISOString();

  if (b.ev === "invited") { if (!admin) return; r.invited = now; await s.set(k, r); return; }
  if (admin) return;

  if (b.ev === "tour") {
    const T = (r.tour ||= {}), step = Math.max(0, Math.min(20, parseInt(b.step, 10) || 0)), of = Math.max(1, Math.min(20, parseInt(b.of, 10) || 1));
    const v = Math.max(1, parseInt(b.v, 10) || 1);
    if (T.v !== v) { for (const x of Object.keys(T)) delete T[x]; T.v = v; }
    T.of = of;
    if (b.act === "start" && !T.started) T.started = now;
    if (b.act === "step" || b.act === "start") T.max = Math.max(T.max || 0, step + 1);
    if (b.act === "done") { T.done = now; T.max = of; delete T.skipped; }
    if (b.act === "skip" && !T.done) { T.skipped = now; T.skipAt = step + 1; }
    T.last = now;
    await s.set(k, r);
    return;
  }

  const sid = String(b.sid || "");
  if (!SID.test(sid)) return;
  let x = r.sessions.find((z) => z.sid === sid);
  if (!x) {
    if (b.ev !== "open") return;
    x = { sid, at: now, ms: 0, scr: {}, acts: [], dev: ["mobile", "tablet", "desktop"].includes(b.dev) ? b.dev : "mobile" };
    r.sessions.unshift(x);
    r.sessions = r.sessions.slice(0, MAX);
    if (!r.first) r.first = now;
  }
  x.last = now;
  const ms = Number(b.ms);
  if (isFinite(ms) && ms >= x.ms && ms < 12 * 3600e3) x.ms = Math.round(ms);
  if (b.scr && typeof b.scr === "object") for (const [n, v] of Object.entries(b.scr)) {
    if (!SCREENS.has(n)) continue; const t = Number(v);
    if (isFinite(t) && t >= 0 && t < 12 * 3600e3) x.scr[n] = Math.max(x.scr[n] || 0, Math.round(t));
  }
  if (Array.isArray(b.acts)) {
    const seen = new Set(x.acts.map((a) => a.a + a.at));
    for (const a of b.acts.slice(0, 40)) {
      const it = { a: str(a.a, 80), at: str(a.at, 30) };
      if (it.a && !seen.has(it.a + it.at) && x.acts.length < 60) { x.acts.push(it); seen.add(it.a + it.at); }
    }
  }
  if (b.home) { x.home = true; r.home = r.home || now; }
  await s.set(k, r);
}

export default async (req) => {
  const s = await store();
  const admin = await checkAdmin(s, req);

  if (req.method === "POST") {
    let b; try { b = JSON.parse(await req.text()); } catch { return new Response(null, { status: 204 }); }
    try { await record(s, b || {}, admin); } catch (e) { console.error("teameng", e); }
    return new Response(null, { status: 204 });
  }
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!admin) return json({ error: "Log in first" }, 401);

  const u = new URL(req.url), roster = await loadRoster(s);
  const team = roster.team.filter((t) => !t.owner);
  const one = u.searchParams.get("p");
  if (one) {
    if (!PID.test(one)) return json({ error: "Bad id" }, 400);
    const m = team.find((t) => t.id === one), r = (await s.get(`teng/${one}`)) || { sessions: [] };
    return json({ pid: one, name: m ? m.name : "Former team member", ...r });
  }

  const now = Date.now(), wk = new Date(now - 7 * 864e5).toISOString(), mo = new Date(now - 30 * 864e5).toISOString();
  const people = [], scr = {}, acts = {};
  for (const t of team) {
    const r = (await s.get(`teng/${t.id}`)) || { sessions: [] };
    const w = r.sessions.filter((x) => x.at >= wk), m = r.sessions.filter((x) => x.at >= mo);
    // Days used in the last 7 (Brisbane days)
    const days = new Set(w.map((x) => new Date(Date.parse(x.at) + 10 * 3600e3).toISOString().slice(0, 10)));
    for (const x of m) {
      for (const [n, v] of Object.entries(x.scr || {})) scr[n] = (scr[n] || 0) + v;
      for (const a of x.acts || []) { const key = a.a.replace(/^(Opened guide|Viewed payslip): .*/, "$1"); acts[key] = (acts[key] || 0) + 1; }
    }
    people.push({
      pid: t.id, name: t.name, invited: r.invited || "", first: r.first || "", last: r.sessions[0]?.last || r.sessions[0]?.at || "",
      home: r.home || "", tour: r.tour || null,
      week: { visits: w.length, ms: w.reduce((a, x) => a + (x.ms || 0), 0), days: days.size },
      month: { visits: m.length, ms: m.reduce((a, x) => a + (x.ms || 0), 0) },
      total: r.sessions.length,
    });
  }
  // Most-read guides and payslips across the team (last 30 days)
  const guides = {};
  for (const t of team) {
    const r = (await s.get(`teng/${t.id}`)) || { sessions: [] };
    for (const x of r.sessions.filter((z) => z.at >= mo)) for (const a of x.acts || []) {
      const g = a.a.match(/^Opened guide: (.*)$/); if (g) guides[g[1]] = (guides[g[1]] || 0) + 1;
    }
  }
  people.sort((a, b) => (b.last || "").localeCompare(a.last || ""));
  return json({ people, screens: scr, acts, guides, tourV: ((await s.get("teamapp")) || {}).tourV || 1 });
};

export const config = { path: "/api/teameng" };
