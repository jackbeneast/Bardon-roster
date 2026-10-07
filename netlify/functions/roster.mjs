import { store, json, loadRoster, loadConfirms, loadAcks, loadAllLive, checkAdmin, adminIsSet, ROOMS } from "../../lib/core.mjs";

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
    if (j.share && String(j.share).length >= 16) o.share = str(j.share, 64);
    if (Array.isArray(j.rooms)) { const r = j.rooms.filter((x) => ROOMS.includes(x)); if (r.length) o.rooms = r; }
    if (j.shifts && typeof j.shifts === "object") {
      const sh = {};
      for (const [k, v] of Object.entries(j.shifts)) if (ids.has(k) && v) sh[k] = { start: str(v.start, 5), end: str(v.end, 5) };
      if (Object.keys(sh).length) o.shifts = sh;
    }
    return o;
  }).filter((j) => j.id && /^\d{4}-\d{2}-\d{2}$/.test(j.date));
  const info = {};
  if (data.info && typeof data.info === "object") for (const k of ["wear", "bring", "meet", "extra"]) info[k] = str(data.info[k], 1500);
  return { team, jobs, info, agents };
}

export default async (req) => {
  const s = await store();
  const admin = await checkAdmin(s, req);

  if (req.method === "GET") {
    const roster = await loadRoster(s);
    const confirms = await loadConfirms(s);
    const team = admin ? roster.team : roster.team.map(({ phone, ...t }) => t);
    const acks = await loadAcks(s);
    const live = await loadAllLive(s);
    const jobs = admin ? roster.jobs : roster.jobs.map(({ share, ...j }) => j);
    const out = { team, jobs, info: roster.info || {}, confirms, acks, live, admin, adminSet: await adminIsSet(s) };
    if (admin) {
      out.agents = roster.agents || [];
      const keys = await s.list("req/");
      out.requests = (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean).sort((a, b) => a.at.localeCompare(b.at));
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
