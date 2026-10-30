import { store, json, loadRoster, loadBooking, checkAdmin } from "../../lib/core.mjs";
import { loadBa, saveBa } from "../../lib/reportba.mjs";

// Jack's picks of before & afters for each client report (admin only).
//   GET                              -> { ba: { [booking key]: { st, ids, at } } }
//   POST { jobId, ids: [after ids] } -> pairs go on the client's report (up to 3)
//   POST { jobId, skip: true }       -> no before & afters on the report
//   POST { jobId, reset: true }      -> undecided again (the hub asks again)
export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req))) return json({ error: "Log in to do that" }, 401);
  if (req.method === "GET") return json({ ba: await loadBa(s) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const roster = await loadRoster(s);
  const job = roster.jobs.find((j) => j.id === b.jobId);
  if (!job) return json({ error: "That job isn't on the roster any more." }, 404);
  const bk = await loadBooking(s, roster, job);
  const out = await saveBa(s, job.group || job.id, b, bk.H.photos || []);
  return json(out, out.error ? 400 : 200);
};

export const config = { path: "/api/reportba" };
