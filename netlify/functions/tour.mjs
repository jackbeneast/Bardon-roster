import { store, json, loadRoster, loadBooking, checkAdmin } from "../../lib/core.mjs";
import { bunnyOn, createUpload, deleteVideo, videoState } from "../../lib/bunny.mjs";
import { GUID, TOUR_LIMIT, refreshTours } from "../../lib/tour.mjs";

// Walkthrough videos for a job (the property tour on the client and agent links).
//   POST ?stage=start  { title }        -> Bunny video slot + signed upload; the phone uploads straight to Bunny
//   POST ?stage=add    { id, title }    -> puts the uploaded video on the job (shows once Bunny has processed it)
//   POST ?stage=abort  { id }           -> an upload that didn't finish: remove the empty slot from Bunny
//   POST ?stage=title  { id, title }    -> rename (Jack only)
//   POST ?stage=status                  -> check processing progress
//   DELETE ?id=                         -> remove from the job and from Bunny (Jack only)
// Every call: ?job=<job id>&person=<team id>. Jack (admin key) or the team on that job.
export default async (req) => {
  const u = new URL(req.url);
  const s = await store();
  if (!bunnyOn()) {
    // Tell Jack what the function can see, so a typo or wrong scope in Netlify is obvious. Names only, never values.
    const near = (await checkAdmin(s, req)) ? Object.keys(process.env).filter((k) => /bunny|stream/i.test(k)) : [];
    const hint = near.length ? ` The hub can see ${near.join(", ")}, but needs it named exactly BUNNY_STREAM_KEY.` : " The hub can't see any Bunny key yet. In Netlify, check its scope includes Functions, then redeploy.";
    return json({ error: "Video isn't set up yet." + hint }, 503);
  }
  const roster = await loadRoster(s);
  const job = roster.jobs.find((x) => x.id === u.searchParams.get("job"));
  if (!job) return json({ error: "That job isn't on the roster any more." }, 404);
  const admin = await checkAdmin(s, req);
  const pid = u.searchParams.get("person") || "";
  if (!admin && !(job.staff || []).includes(pid)) return json({ error: "Only the team on this job can add videos." }, 403);
  const stage = u.searchParams.get("stage") || "";
  const str = (x, n) => (typeof x === "string" ? x.trim().replace(/\s+/g, " ").slice(0, n) : "");

  let body = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { body = {}; } }
  const id = String(u.searchParams.get("id") || body.id || "");

  try {
    if (req.method === "POST" && stage === "start") {
      const cur = (await loadBooking(s, roster, job)).H.tour || [];
      if (cur.length >= TOUR_LIMIT) return json({ error: `This job already has ${TOUR_LIMIT} videos. Delete one first.` }, 400);
      const title = str(body.title, 120) || `Walkthrough · ${job.suburb || job.address || "property"}`;
      return json({ ok: true, ...(await createUpload(title)) });
    }

    if (req.method === "POST" && stage === "abort") {
      if (!GUID.test(id)) return json({ error: "Bad video" }, 400);
      const bk = await loadBooking(s, roster, job);
      if (bk.H.tour.some((v) => v.id === id)) return json({ ok: true }); // already on the job: keep it
      await deleteVideo(id);
      return json({ ok: true });
    }

    const bk = await loadBooking(s, roster, job), L = bk.H;
    L.tour = L.tour || [];

    if (req.method === "POST" && stage === "add") {
      if (!GUID.test(id)) return json({ error: "Bad video" }, 400);
      if (!L.tour.some((v) => v.id === id)) {
        if (L.tour.length >= TOUR_LIMIT) return json({ error: `This job already has ${TOUR_LIMIT} videos. Delete one first.` }, 400);
        let st = { ready: false, secs: 0, progress: 0 };
        try { st = await videoState(id); } catch (e) { if (e.status === 404) return json({ error: "That video didn't reach Bunny. Upload it again." }, 400); }
        L.tour.push({ id, title: str(body.title, 120) || `Walkthrough ${L.tour.length + 1}`, by: admin && !pid ? "admin" : pid, at: new Date().toISOString(), ready: st.ready, secs: st.secs, pct: st.progress });
      }
      return json({ ok: true, ...(await bk.save()) });
    }

    if (req.method === "POST" && stage === "title") {
      if (!admin) return json({ error: "Only Jack can rename videos." }, 403);
      const v = L.tour.find((x) => x.id === id);
      const t = str(body.title, 120);
      if (!v || !t) return json({ error: "Add a name" }, 400);
      v.title = t;
      return json({ ok: true, ...(await bk.save()) });
    }

    if (req.method === "POST" && stage === "status") {
      await refreshTours(s, roster, [job]);
      return json({ ok: true, ...(await loadBooking(s, roster, job)).view() });
    }

    if (req.method === "DELETE") {
      if (!admin) return json({ error: "Only Jack can delete videos." }, 403);
      if (!GUID.test(id)) return json({ error: "Bad video" }, 400);
      await deleteVideo(id);
      L.tour = L.tour.filter((v) => v.id !== id);
      return json({ ok: true, ...(await bk.save()) });
    }
  } catch (e) {
    return json({ error: e.message || "Something went wrong" }, e.status && e.status < 600 ? e.status : 500);
  }
  return json({ error: "Unknown request" }, 400);
};

export const config = { path: "/api/tour" };
