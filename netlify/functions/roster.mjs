import { store, json, loadRoster, loadConfirms, checkAdmin, adminIsSet } from "../../lib/core.mjs";

function clean(data) {
  if (!data || !Array.isArray(data.team) || !Array.isArray(data.jobs)) return null;
  const str = (v, n = 2000) => (typeof v === "string" ? v.slice(0, n) : "");
  const team = data.team.slice(0, 100).map((t) => {
    const o = { id: str(t.id, 40), name: str(t.name, 80) };
    if (t.owner) o.owner = true;
    if (t.phone) o.phone = str(t.phone, 30);
    return o;
  }).filter((t) => t.id && t.name);
  const ids = new Set(team.map((t) => t.id));
  const jobs = data.jobs.slice(0, 2000).map((j) => {
    const o = {
      id: str(j.id, 40), date: str(j.date, 10), start: str(j.start, 5), end: str(j.end, 5),
      client: str(j.client, 120), suburb: str(j.suburb, 80), address: str(j.address, 160),
      service: str(j.service, 40), notes: str(j.notes, 2000),
      staff: (Array.isArray(j.staff) ? j.staff : []).filter((x) => ids.has(x)),
    };
    if (j.shifts && typeof j.shifts === "object") {
      const sh = {};
      for (const [k, v] of Object.entries(j.shifts)) if (ids.has(k) && v) sh[k] = { start: str(v.start, 5), end: str(v.end, 5) };
      if (Object.keys(sh).length) o.shifts = sh;
    }
    return o;
  }).filter((j) => j.id && /^\d{4}-\d{2}-\d{2}$/.test(j.date));
  return { team, jobs };
}

export default async (req) => {
  const s = await store();
  const admin = await checkAdmin(s, req);

  if (req.method === "GET") {
    const roster = await loadRoster(s);
    const confirms = await loadConfirms(s);
    const team = admin ? roster.team : roster.team.map(({ phone, ...t }) => t);
    return json({ team, jobs: roster.jobs, confirms, admin, adminSet: await adminIsSet(s) });
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
