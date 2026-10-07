import { store, json, loadRoster, loadAllLive, checkAdmin, roomsOf, LOCK } from "../../lib/core.mjs";

const first = (n) => String(n || "").replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] || "Team";

// What an agent (or vendor) is allowed to see about a job. No client name, team notes or phone numbers.
function view(job, roster, L, withShare) {
  const team = (job.staff || []).map((id) => roster.team.find((t) => t.id === id)).filter(Boolean)
    .map((t) => ({ id: t.id, name: first(t.name), owner: !!t.owner }));
  const live = L || {};
  const o = {
    id: job.id, date: job.date, start: job.start, end: job.end,
    address: job.address, suburb: job.suburb, service: job.service, readyBy: job.readyBy || "",
    rooms: roomsOf(job), team,
    live: {
      arrived: live.arrived || {}, rooms: live.rooms || {}, flags: (live.flags || []).map(({ id, t, d, at }) => ({ id, t, d, at })),
      photos: (live.photos || []).map(({ id, room, kind, at }) => ({ id, room, kind, at })),
      lock: live.lock || {}, eta: live.eta || "", done: live.done || "", updated: live.updated || "",
    },
  };
  if (withShare && job.share) o.share = job.share;
  return o;
}

export default async (req) => {
  const s = await store();
  const roster = await loadRoster(s);
  const agents = roster.agents || [];
  const u = new URL(req.url);

  if (req.method === "GET") {
    const k = u.searchParams.get("k") || "", v = u.searchParams.get("v") || "";
    const live = await loadAllLive(s);
    const base = { lock: LOCK, phone: "0406 216 212" };
    if (v) {
      const job = v.length >= 16 && roster.jobs.find((j) => j.share === v);
      if (!job) return json({ error: "This link has expired. Ask your agent for a new one." }, 404);
      const a = agents.find((x) => x.id === job.agentId);
      return json({ ...base, mode: "vendor", agent: a ? { name: a.name, agency: a.agency } : null, jobs: [view(job, roster, live[job.id], false)] });
    }
    if (k) {
      const a = k.length >= 16 && agents.find((x) => x.token === k);
      if (!a) return json({ error: "This link isn't active. Contact Jack at Bardon Clean for a new one." }, 404);
      const jobs = roster.jobs.filter((j) => j.agentId === a.id).map((j) => view(j, roster, live[j.id], true));
      return json({ ...base, mode: "agent", agent: { name: a.name, agency: a.agency }, jobs });
    }
    if (await checkAdmin(s, req)) {
      const as = u.searchParams.get("as") || "";
      const jobs = roster.jobs.filter((j) => (as ? j.agentId === as : true))
        .map((j) => ({ ...view(j, roster, live[j.id], true), agentId: j.agentId || "", client: j.client }));
      return json({ ...base, mode: "admin", agents: agents.map(({ id, name, agency }) => ({ id, name, agency })), jobs });
    }
    return json({ error: "Open this page from the link Bardon Clean sent you." }, 401);
  }

  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
    if (b.action === "dismiss") {
      if (!(await checkAdmin(s, req))) return json({ error: "Wrong password" }, 401);
      await s.del(`req/${String(b.id || "").slice(0, 40)}`);
      return json({ ok: true });
    }
    if (b.action === "book") {
      const a = typeof b.k === "string" && b.k.length >= 16 && agents.find((x) => x.token === b.k);
      if (!a) return json({ error: "This link isn't active. Call Jack on 0406 216 212." }, 404);
      const str = (x, n) => (typeof x === "string" ? x.trim().slice(0, n) : "");
      const r = {
        id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), agentId: a.id, agent: a.name, agency: a.agency,
        address: str(b.address, 160), suburb: str(b.suburb, 80), service: str(b.service, 40), readyDate: str(b.readyDate, 10),
        readyFor: str(b.readyFor, 40), access: str(b.access, 60), beds: str(b.beds, 4), baths: str(b.baths, 4),
        invoice: str(b.invoice, 40), notes: str(b.notes, 1500), at: new Date().toISOString(),
      };
      if (!r.address || !/^\d{4}-\d{2}-\d{2}$/.test(r.readyDate)) return json({ error: "Add the address and the date it needs to be ready." }, 400);
      const n = (await s.list("req/")).length;
      if (n >= 100) return json({ error: "Couldn't send right now. Call Jack on 0406 216 212." }, 429);
      await s.set(`req/${r.id}`, r);
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  }
  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/agent" };
