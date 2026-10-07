import { randomBytes } from "node:crypto";
import { store, json, loadRoster, loadLive, checkAdmin, roomsOf } from "../../lib/core.mjs";

const MAX = 5 * 1024 * 1024;
const ID = /^[a-f0-9]{24}$/;

// Before/after photos. The roster resizes to JPEG before upload.
// GET is by unguessable id so agent and vendor pages can show them in <img>.
export default async (req) => {
  const u = new URL(req.url);
  const s = await store();

  if (req.method === "GET") {
    const j = u.searchParams.get("j") || "", p = u.searchParams.get("p") || "";
    if (!/^[\w-]{1,40}$/.test(j) || !ID.test(p)) return new Response("Not found", { status: 404 });
    const buf = await s.getBin(`photo/${j}/${p}`);
    if (!buf) return new Response("Not found", { status: 404 });
    return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=604800, immutable" } });
  }

  const roster = await loadRoster(s);
  const job = roster.jobs.find((x) => x.id === u.searchParams.get("job"));
  if (!job) return json({ error: "That job isn't on the roster any more." }, 404);
  const admin = await checkAdmin(s, req);
  const pid = u.searchParams.get("person") || "";
  if (!admin && !(job.staff || []).includes(pid)) return json({ error: "Only the team on this job can add photos." }, 403);
  const L = await loadLive(s, job.id);

  if (req.method === "DELETE") {
    const id = u.searchParams.get("id") || "";
    if (!ID.test(id)) return json({ error: "Bad photo" }, 400);
    L.photos = L.photos.filter((ph) => ph.id !== id);
    await s.set(`live/${job.id}`, L);
    await s.del(`photo/${job.id}/${id}`);
    return json({ ok: true, live: L });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const room = u.searchParams.get("room"), kind = u.searchParams.get("kind");
  if (!roomsOf(job).includes(room) || !["before", "after"].includes(kind)) return json({ error: "Pick a room and before or after" }, 400);
  if (L.photos.length >= 150) return json({ error: "This job has the maximum number of photos." }, 400);
  const buf = await req.arrayBuffer();
  const b = new Uint8Array(buf);
  if (!b.length || b.length > MAX) return json({ error: "Photo is too large. Try again." }, 413);
  if (!(b[0] === 0xff && b[1] === 0xd8)) return json({ error: "That file isn't a photo." }, 400);
  const id = randomBytes(12).toString("hex");
  await s.setBin(`photo/${job.id}/${id}`, buf);
  L.photos.push({ id, room, kind, by: admin && !pid ? "admin" : pid, at: new Date().toISOString() });
  L.updated = new Date().toISOString();
  await s.set(`live/${job.id}`, L);
  return json({ ok: true, live: L });
};

export const config = { path: "/api/photo" };
