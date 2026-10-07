import { randomBytes } from "node:crypto";
import { store, json, loadRoster, loadAllLive, checkAdmin, roomsOf, DEFAULT_ROOMS, LOCK } from "../../lib/core.mjs";

// ---- sample jobs, so a new agent's link isn't empty on first open ----
// Three clearly labelled jobs: finished yesterday (report), on site today, booked later this week.
// Hidden from the team's roster; only Jack and the tagged agent see them.
const BNE = 10 * 3600 * 1000; // Brisbane is UTC+10 all year
const day = (n) => new Date(Date.now() + BNE + n * 86400000).toISOString().slice(0, 10);
const at = (d, hm) => new Date(`${d}T${hm}:00+10:00`).toISOString();
const sid = () => "s" + randomBytes(6).toString("hex");
const stok = () => randomBytes(18).toString("hex");

function makeSamples(agentId, roster) {
  const owner = roster.team.find((t) => t.owner);
  const mate = roster.team.find((t) => !t.owner);
  const staff = [owner, mate].filter(Boolean).map((t) => t.id);
  const base = { agentId, staff, sample: true, client: "Sample job (agent demo)", notes: "Sample job for the agent portal demo. Not a real booking." };
  const y = day(-1), t = day(0), u = day(3);
  const jobs = [
    { ...base, id: sid(), share: stok(), date: y, start: "08:00", end: "15:00", address: "Sample: 21 Example St", suburb: "Bardon", service: "Pre-sale clean", readyBy: "Photography next morning" },
    { ...base, id: sid(), share: stok(), date: t, start: "08:00", end: "15:00", address: "Sample: 7 Demo Tce", suburb: "Paddington", service: "Pre-sale clean", readyBy: "Open home Sat 10am" },
    { ...base, id: sid(), share: stok(), date: u, start: "08:00", end: "14:00", address: "Sample: 3 Preview Ave", suburb: "Ashgrove", service: "Deep clean", readyBy: "Photography 9am next day" },
  ];
  const rooms = DEFAULT_ROOMS;
  const arrived = (d) => Object.fromEntries(staff.map((id, i) => [id, at(d, i ? "08:05" : "07:55")]));
  const by = (i) => staff[i % staff.length];
  const live = {};
  // Finished yesterday: every room done, notes for the agent, locked up, marked ready.
  live[jobs[0].id] = {
    arrived: arrived(y), photos: [],
    rooms: Object.fromEntries(rooms.map((r, i) => [r, { s: "d", by: by(i), at: at(y, ["10:10", "11:20", "12:05", "12:40", "13:15", "14:05"][i] || "14:05") }])),
    flags: [
      { id: "f1", t: "Oven door seal cracked", d: "Cleaned fully, but the seal is split along the bottom edge. Worth replacing before photos if the oven will be shown open.", by: by(0), at: at(y, "10:05") },
      { id: "f2", t: "Mould returning through shower silicone", d: "Main bathroom. Treated and cleaned, but it's under the silicone, so it will come back. A re-seal would fix it properly.", by: by(1), at: at(y, "11:15") },
    ],
    lock: Object.fromEntries(Object.keys(LOCK).map((k) => [k, at(y, "14:40")])),
    eta: "14:45", done: at(y, "14:45"), updated: at(y, "14:45"),
  };
  // On site today: two rooms done, one underway, one note.
  live[jobs[1].id] = {
    arrived: arrived(t), photos: [], lock: {},
    rooms: { [rooms[0]]: { s: "d", by: by(0), at: at(t, "10:15") }, [rooms[1]]: { s: "d", by: by(1), at: at(t, "11:05") }, [rooms[2]]: { s: "p", by: by(0), at: at(t, "11:10") } },
    flags: [{ id: "f1", t: "Scuff marks on hallway wall", d: "Light scuffs at hand height that won't wipe off without lifting the paint. A touch-up would help before photos.", by: by(1), at: at(t, "09:30") }],
    eta: "14:30", updated: at(t, "11:10"),
  };
  return { jobs, live };
}


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
      if (!job) return json({ error: "This link has expired. Call Jack at Bardon Clean on 0406 216 212 for a new one." }, 404);
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
    if (b.action === "sample") {
      if (!(await checkAdmin(s, req))) return json({ error: "Wrong password" }, 401);
      const a = agents.find((x) => x.id === b.agentId);
      if (!a) return json({ error: "Pick an agent" }, 400);
      const old = roster.jobs.filter((j) => j.sample && j.agentId === a.id);
      for (const j of old) await s.del(`live/${j.id}`);
      roster.jobs = roster.jobs.filter((j) => !(j.sample && j.agentId === a.id));
      if (!b.remove) {
        const { jobs, live } = makeSamples(a.id, roster);
        roster.jobs.push(...jobs);
        for (const [id, L] of Object.entries(live)) await s.set(`live/${id}`, L);
      }
      await s.set("roster", { ...roster, savedAt: new Date().toISOString() });
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
