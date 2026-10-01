import { store, json, loadRoster, checkAdmin, sig } from "../../lib/core.mjs";

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
  await s.set(key, rec);
  return json({ ok: true, confirm: rec });
};

export const config = { path: "/api/confirm" };
