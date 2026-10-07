import { randomBytes } from "node:crypto";
import { store, json, loadRoster, loadConfirms, loadAcks, loadAllLive, checkAdmin, adminIsSet } from "../../lib/core.mjs";

// Wage-estimate settings: pay cycle, rates, lunch rule, extra public holidays.
function cleanPay(p) {
  if (!p || typeof p !== "object") return null;
  const d = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const n = (v) => { const x = Number(v); return isFinite(x) && x > 0 && x < 1000 ? Math.round(x * 100) / 100 : undefined; };
  const o = { cycle: p.cycle === 2 ? 2 : 1, lunch: p.lunch !== false };
  if (d(p.anchor)) o.anchor = p.anchor;
  if (p.rates && typeof p.rates === "object") {
    const r = {};
    for (const k of ["wk", "el", "sat", "sun", "ph"]) { const v = n(p.rates[k]); if (v) r[k] = v; }
    o.rates = r;
  }
  if (Array.isArray(p.ph)) o.ph = [...new Set(p.ph.map(d).filter(Boolean))].slice(0, 100);
  return o;
}

function clean(data) {
  if (!data || !Array.isArray(data.team) || !Array.isArray(data.jobs)) return null;
  const str = (v, n = 2000) => (typeof v === "string" ? v.slice(0, n) : "");
  const team = data.team.slice(0, 100).map((t) => {
    const o = { id: str(t.id, 40), name: str(t.name, 80) };
    if (t.owner) o.owner = true;
    if (t.phone) o.phone = str(t.phone, 30);
    if (t.newStarter) o.newStarter = true;
    return o;
  }).filter((t) => t.id && t.name);
  const ids = new Set(team.map((t) => t.id));
  const agents = (Array.isArray(data.agents) ? data.agents : []).slice(0, 200).map((a) => {
    const o = { id: str(a.id, 40), name: str(a.name, 80), agency: str(a.agency, 80), token: str(a.token, 64) };
    if (a.phone) o.phone = str(a.phone, 30);
    return o;
  }).filter((a) => a.id && a.name && a.token.length >= 16);
  const aids = new Set(agents.map((a) => a.id));
  const jobs = data.jobs.slice(0, 2000).map((j) => {
    const o = {
      id: str(j.id, 40), date: str(j.date, 10), start: str(j.start, 5), end: str(j.end, 5),
      client: str(j.client, 120), suburb: str(j.suburb, 80), address: str(j.address, 160),
      service: str(j.service, 40), notes: str(j.notes, 2000), meet: str(j.meet, 300),
      staff: (Array.isArray(j.staff) ? j.staff : []).filter((x) => ids.has(x)),
    };
    if (j.agentId && aids.has(j.agentId)) o.agentId = j.agentId;
    if (j.readyBy) o.readyBy = str(j.readyBy, 120);
    if (j.sample) o.sample = true;
    if (j.share && String(j.share).length >= 16) o.share = str(j.share, 64);
    if (Array.isArray(j.rooms)) {
      const seen = new Set(), r = [];
      for (const x of j.rooms) { const n = str(x, 40).trim(); const k = n.toLowerCase(); if (n && !seen.has(k)) { seen.add(k); r.push(n); } }
      if (r.length) o.rooms = r.slice(0, 30);
    }
    if (j.shifts && typeof j.shifts === "object") {
      const sh = {};
      for (const [k, v] of Object.entries(j.shifts)) if (ids.has(k) && v) sh[k] = { start: str(v.start, 5), end: str(v.end, 5) };
      if (Object.keys(sh).length) o.shifts = sh;
    }
    return o;
  }).filter((j) => j.id && /^\d{4}-\d{2}-\d{2}$/.test(j.date));
  const info = {};
  if (data.info && typeof data.info === "object") for (const k of ["wear", "bring", "meet", "extra"]) info[k] = str(data.info[k], 1500);
  const pay = cleanPay(data.pay);
  return { team, jobs, info, agents, ...(pay ? { pay } : {}) };
}

export default async (req) => {
  const s = await store();
  const admin = await checkAdmin(s, req);

  if (req.method === "GET") {
    const roster = await loadRoster(s);
    // Every real job gets a private client link. Backfill older jobs once.
    if (admin && roster.jobs.some((j) => !j.sample && !j.share)) {
      roster.jobs.forEach((j) => { if (!j.sample && !j.share) j.share = randomBytes(18).toString("hex"); });
      await s.set("roster", { ...roster, savedAt: new Date().toISOString() });
    }
    const confirms = await loadConfirms(s);
    const team = admin ? roster.team : roster.team.map(({ phone, ...t }) => t);
    const acks = await loadAcks(s);
    const live = await loadAllLive(s);
    const jobs = admin ? roster.jobs : roster.jobs.filter((j) => !j.sample).map(({ share, ...j }) => j);
    const out = { team, jobs, info: roster.info || {}, confirms, acks, live, admin, adminSet: await adminIsSet(s) };
    if (admin) {
      out.agents = roster.agents || [];
      out.pay = roster.pay || null;
      const keys = await s.list("req/");
      out.requests = (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean).sort((a, b) => a.at.localeCompare(b.at));
      // Unread count for the activity bell.
      const seen = (await s.get("actseen"))?.at || "";
      out.actUnread = (await s.list("act/")).filter((k) => k.slice(4) > seen).length;
      out.notifyOn = !!(await s.get("notify"))?.topic;
    }
    return json(out);
  }

  if (req.method === "PUT") {
    if (!admin) return json({ error: "Wrong password" }, 401);
    let body; try { body = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
    const data = clean(body);
    if (!data) return json({ error: "Bad data" }, 400);
    await s.set("roster", { ...data, savedAt: new Date().toISOString() });
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/roster" };
