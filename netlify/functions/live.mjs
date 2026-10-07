import { store, json, loadRoster, loadLive, checkAdmin, roomsOf, LOCK } from "../../lib/core.mjs";

// Live progress on a job: arrivals, rooms, flags for the agent, lock-up, finish.
// The team posts from the roster (same trust as shift confirmations); Jack can do everything.
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const s = await store();
  const roster = await loadRoster(s);
  const job = roster.jobs.find((j) => j.id === b.jobId);
  if (!job) return json({ error: "That job isn't on the roster any more. Refresh the page." }, 404);
  const admin = await checkAdmin(s, req);
  const owner = roster.team.find((t) => t.owner);
  let pid = String(b.personId || "");
  const onJob = (id) => (job.staff || []).includes(id);
  if (!admin && !onJob(pid)) return json({ error: "Only the team on this job can update it." }, 403);
  if (admin && !pid) pid = owner ? owner.id : "admin";

  const L = await loadLive(s, job.id);
  const now = new Date().toISOString();
  const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

  switch (b.action) {
    case "arrive": {
      const who = b.who && (admin || b.who === pid) ? b.who : pid;
      if (!onJob(who)) return json({ error: "That person isn't on this job." }, 400);
      if (b.undo) delete L.arrived[who]; else L.arrived[who] = now;
      break;
    }
    case "room": {
      if (!roomsOf(job).includes(b.room)) return json({ error: "Unknown room" }, 400);
      if (b.status === "w") delete L.rooms[b.room];
      else if (b.status === "p" || b.status === "d") L.rooms[b.room] = { s: b.status, by: pid, at: now };
      else return json({ error: "Bad status" }, 400);
      break;
    }
    case "flag": {
      const t = str(b.title, 120);
      if (!t) return json({ error: "Add a short title" }, 400);
      if (L.flags.length >= 30) return json({ error: "Too many notes on this job" }, 400);
      L.flags.push({ id: Math.random().toString(36).slice(2, 10), t, d: str(b.detail, 600), by: pid, at: now });
      break;
    }
    case "unflag":
      L.flags = L.flags.filter((f) => f.id !== b.id);
      break;
    case "lock":
      if (!LOCK[b.item]) return json({ error: "Unknown item" }, 400);
      if (b.value) L.lock[b.item] = now; else delete L.lock[b.item];
      break;
    case "eta": {
      if (!admin) return json({ error: "Only Jack can change the finish time" }, 401);
      const t = str(b.time, 5);
      if (t && !/^\d{2}:\d{2}$/.test(t)) return json({ error: "Bad time" }, 400);
      if (t) L.eta = t; else delete L.eta;
      break;
    }
    case "finish":
      if (b.undo) delete L.done; else L.done = now;
      break;
    default:
      return json({ error: "Unknown action" }, 400);
  }
  L.updated = now;
  await s.set(`live/${job.id}`, L);
  return json({ ok: true, live: L });
};

export const config = { path: "/api/live" };
