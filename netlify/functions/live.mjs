import { store, json, loadRoster, loadLive, loadConfirms, checkAdmin, roomsOf, LOCK, shiftOf } from "../../lib/core.mjs";
import { autoWrap, clockedHours } from "../../lib/clock.mjs";
import { paySet } from "../../public/lib/wages.mjs";
import { notify, firstName, where, fmtTime, clockNow } from "../../lib/notify.mjs";

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
  let wrapCheck = false;
  const now = new Date().toISOString();
  const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

  switch (b.action) {
    case "arrive": {
      const who = b.who && (admin || b.who === pid) ? b.who : pid;
      if (!onJob(who)) return json({ error: "That person isn't on this job." }, 400);
      if (b.undo) { delete L.arrived[who]; delete L.left[who]; }
      else {
        const first = !L.arrived[who];
        L.arrived[who] = now;
        const p = roster.team.find((x) => x.id === who);
        if (first && p && !p.owner) {
          const st = shiftOf(job, who).start;
          await notify(s, { type: "arrive", title: `${firstName(p.name)} arrived at ${where(job)}`, body: `${clockNow()}${st ? ` (shift starts ${fmtTime(st)})` : ""}`, tags: "round_pushpin", priority: 2, url: "/" });
        }
      }
      break;
    }
    case "leave": {
      const who = b.who && (admin || b.who === pid) ? b.who : pid;
      if (!onJob(who)) return json({ error: "That person isn't on this job." }, 400);
      if (b.undo) { delete L.left[who]; break; }
      if (!L.arrived[who]) return json({ error: "Tap \"I've arrived\" first, then clock off when you leave." }, 400);
      const first = !L.left[who];
      L.left[who] = now;
      const p = roster.team.find((x) => x.id === who);
      if (first && p && !p.owner) {
        const h = clockedHours(L.arrived[who], now, paySet(roster.pay).lunch);
        await notify(s, { type: "leave", title: `${firstName(p.name)} clocked off at ${where(job)}`, body: `${clockNow()}${h != null ? ` · ${h} h paid` : ""}`, tags: "wave", priority: 2, url: "/" });
      }
      wrapCheck = true;
      break;
    }
    case "room": {
      if (!roomsOf(job).includes(b.room)) return json({ error: "Unknown room" }, 400);
      if (b.status === "w") delete L.rooms[b.room];
      else if (b.status === "p" || b.status === "d") L.rooms[b.room] = { s: b.status, by: pid, at: now };
      else return json({ error: "Bad status" }, 400);
      break;
    }
    case "item": { // one checklist tick inside a room
      if (!roomsOf(job).includes(b.room)) return json({ error: "Unknown room" }, 400);
      const id = str(b.item, 24);
      if (!/^[a-z]_[a-z]{2,16}$/.test(id)) return json({ error: "Unknown checklist item" }, 400);
      const r = (L.items[b.room] ||= {});
      if (b.value) r[id] = { by: pid, at: now }; else delete r[id];
      if (!Object.keys(r).length) delete L.items[b.room];
      // First tick in a room moves it to "Doing" so the agent sees progress.
      if (b.value && !L.rooms[b.room]) L.rooms[b.room] = { s: "p", by: pid, at: now };
      break;
    }
    case "flag": {
      const t = str(b.title, 120);
      if (!t) return json({ error: "Add a short title" }, 400);
      if (L.flags.length >= 30) return json({ error: "Too many notes on this job" }, 400);
      L.flags.push({ id: Math.random().toString(36).slice(2, 10), t, d: str(b.detail, 600), by: pid, at: now });
      if (!admin) {
        const p = roster.team.find((x) => x.id === pid);
        await notify(s, { type: "flag", title: `Note at ${where(job)}: ${t}`, body: `${str(b.detail, 600)}${p ? `\nFrom ${firstName(p.name)}` : ""}${job.agentId ? "\nThe agent can see this." : ""}`, tags: "warning", priority: 4, url: "/" });
      }
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
      if (b.undo) delete L.done;
      else {
        const first = !L.done;
        L.done = now;
        wrapCheck = true;
        if (first && !admin) {
          const rs = roomsOf(job), d = rs.filter((r) => L.rooms[r]?.s === "d").length, lk = Object.keys(LOCK).filter((k) => L.lock[k]).length;
          const ph = L.photos.filter((p) => p.kind === "after").length;
          await notify(s, { type: "finish", title: `${where(job)} is ready`, body: `Finished ${clockNow()} · ${d}/${rs.length} rooms · ${lk}/${Object.keys(LOCK).length} lock-up checks · ${ph} after photo${ph === 1 ? "" : "s"}`, tags: "sparkles", url: "/" });
        }
      }
      break;
    default:
      return json({ error: "Unknown action" }, 400);
  }
  L.updated = now;
  await s.set(`live/${job.id}`, L);
  if (wrapCheck) {
    try { await autoWrap(s, roster, job, new Date(Date.now() + 10 * 3600e3).toISOString().slice(0, 10), await loadConfirms(s)); }
    catch (e) { console.error("auto wrap failed", e); }
  }
  return json({ ok: true, live: L });
};

export const config = { path: "/api/live" };
