import { store, json, loadRoster, checkAdmin, sig, shiftOf } from "../../lib/core.mjs";
import { notify, fmtDay, fmtTime, firstName, where } from "../../lib/notify.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const s = await store();
  const roster = await loadRoster(s);
  const job = roster.jobs.find((j) => j.id === b.jobId);
  const person = roster.team.find((t) => t.id === b.personId);
  if (!job || !person || !(job.staff || []).includes(person.id)) return json({ error: "That shift isn't on the roster any more. Refresh the page." }, 404);
  const key = `confirm/${job.id}/${person.id}`;

  if (b.status === "wait") {
    if (!(await checkAdmin(s, req))) return json({ error: "Only Jack can clear a confirmation" }, 401);
    await s.del(key);
    return json({ ok: true });
  }
  if (b.status !== "yes" && b.status !== "no") return json({ error: "Bad status" }, 400);
  const rec = { s: b.status, k: sig(job, person.id), at: new Date().toISOString() };
  if (b.status === "no" && typeof b.reason === "string" && b.reason.trim()) rec.reason = b.reason.trim().slice(0, 300);
  const prev = await s.get(key);
  await s.set(key, rec);
  // Ping Jack, unless it's the same answer tapped twice. Jack ticking it himself doesn't ping.
  if (!(prev && prev.s === rec.s && prev.k === rec.k) && !(await checkAdmin(s, req))) {
    const sh = shiftOf(job, person.id), when = `${fmtDay(job.date)} ${fmtTime(sh.start)}`;
    const name = firstName(person.name);
    if (rec.s === "yes") await notify(s, { type: "shift_yes", title: `${name} accepted ${when}`, body: `${where(job)}${job.service ? " · " + job.service : ""}`, tags: "white_check_mark", url: "/" });
    else await notify(s, { type: "shift_no", title: `${name} can't make ${when}`, body: `${where(job)}${rec.reason ? "\nReason: " + rec.reason : ""}\nTap to reassign.`, tags: "x", priority: 5, url: "/" });
  }
  return json({ ok: true, confirm: rec });
};

export const config = { path: "/api/confirm" };
