import { randomBytes } from "node:crypto";
import { store, json, loadRoster, loadLive, checkAdmin, roomsOf } from "../../lib/core.mjs";

const MAX = 5 * 1024 * 1024;
const TMAX = 400 * 1024;
const LIMIT = 300;
const ID = /^[a-f0-9]{24}$/;
const isJpeg = (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8;

// Before/after photos. The roster resizes to JPEG (plus a small thumbnail) before upload.
// Upload is two steps so a batch can go up several at a time without the
// live record being overwritten by parallel requests:
//   POST ?stage=bin  body = thumbnail bytes then full bytes (tl = thumbnail length) -> { id }
//   POST ?stage=add  JSON { ids, room?, kind? } -> adds them to the job (no room = "to sort")
//   POST ?stage=tag  JSON { ids, room, kind } -> sorts photos into a room and before/after
//   DELETE ?id= or JSON { ids }
// GET is by unguessable id so agent and vendor pages can show them in <img>. &s=t gives the thumbnail.
export default async (req) => {
  const u = new URL(req.url);
  const s = await store();

  if (req.method === "GET") {
    const j = u.searchParams.get("j") || "", p = u.searchParams.get("p") || "";
    if (!/^[\w-]{1,40}$/.test(j) || !ID.test(p)) return new Response("Not found", { status: 404 });
    let buf = u.searchParams.get("s") === "t" ? await s.getBin(`photo/${j}/${p}.t`) : null;
    if (!buf) buf = await s.getBin(`photo/${j}/${p}`);
    if (!buf) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=604800, immutable" } });
  }

  const roster = await loadRoster(s);
  const job = roster.jobs.find((x) => x.id === u.searchParams.get("job"));
  if (!job) return json({ error: "That job isn't on the roster any more." }, 404);
  const admin = await checkAdmin(s, req);
  const pid = u.searchParams.get("person") || "";
  if (!admin && !(job.staff || []).includes(pid)) return json({ error: "Only the team on this job can add photos." }, 403);
  const stage = u.searchParams.get("stage") || "";

  // Step 1: store the image only. Nothing on the job changes yet.
  if (req.method === "POST" && stage === "bin") {
    const b = new Uint8Array(await req.arrayBuffer());
    const tl = Math.max(0, parseInt(u.searchParams.get("tl") || "0", 10) || 0);
    if (!b.length || b.length > MAX + TMAX || tl > TMAX || tl >= b.length) return json({ error: "Photo is too large. Try again." }, 413);
    const thumb = b.subarray(0, tl), full = b.subarray(tl);
    if (!isJpeg(full) || (tl && !isJpeg(thumb))) return json({ error: "That file isn't a photo." }, 400);
    const id = randomBytes(12).toString("hex");
    await s.setBin(`photo/${job.id}/${id}`, full.slice().buffer);
    if (tl) await s.setBin(`photo/${job.id}/${id}.t`, thumb.slice().buffer);
    return json({ ok: true, id });
  }

  let body = {};
  if (req.method === "POST" || (req.method === "DELETE" && !u.searchParams.get("id"))) {
    try { body = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  }
  const ids = [...new Set(Array.isArray(body.ids) ? body.ids.filter((x) => ID.test(x)) : [])];
  const L = await loadLive(s, job.id);
  const save = async () => { L.updated = new Date().toISOString(); await s.set(`live/${job.id}`, L); return json({ ok: true, live: L }); };
  const tagOk = (room, kind) => roomsOf(job).includes(room) && ["before", "after"].includes(kind);

  if (req.method === "DELETE") {
    const del = u.searchParams.get("id") ? [u.searchParams.get("id")] : ids;
    if (!del.length || !del.every((x) => ID.test(x))) return json({ error: "Bad photo" }, 400);
    L.photos = L.photos.filter((ph) => !del.includes(ph.id));
    await Promise.all(del.flatMap((id) => [s.del(`photo/${job.id}/${id}`), s.del(`photo/${job.id}/${id}.t`)]));
    return save();
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Step 2: put uploaded photos on the job, sorted or not.
  if (stage === "add") {
    if (!ids.length) return json({ error: "No photos" }, 400);
    const room = body.room || "", kind = body.kind || "";
    if ((room || kind) && !tagOk(room, kind)) return json({ error: "Pick a room and before or after" }, 400);
    const have = new Set(L.photos.map((p) => p.id));
    const fresh = ids.filter((id) => !have.has(id));
    // Check each image really saved (reads the small thumbnail, or the full photo for old-style uploads)
    const ok = await Promise.all(fresh.map(async (id) => !!((await s.getBin(`photo/${job.id}/${id}.t`)) || (await s.getBin(`photo/${job.id}/${id}`)))));
    const add = fresh.filter((_, i) => ok[i]);
    if (L.photos.length + add.length > LIMIT) return json({ error: `This job is at the ${LIMIT} photo limit. Delete some first.` }, 400);
    const at = new Date().toISOString(), by = admin && !pid ? "admin" : pid;
    add.forEach((id) => L.photos.push({ id, room, kind, by, at }));
    L.updated = at; await s.set(`live/${job.id}`, L);
    return json({ ok: true, live: L, added: add.length, missing: fresh.length - add.length });
  }

  // Sort photos into a room and before/after.
  if (stage === "tag") {
    if (!ids.length) return json({ error: "Select some photos first" }, 400);
    if (!tagOk(body.room, body.kind)) return json({ error: "Pick a room and before or after" }, 400);
    L.photos.forEach((p) => { if (ids.includes(p.id)) { p.room = body.room; p.kind = body.kind; } });
    return save();
  }

  return json({ error: "Unknown request" }, 400);
};

export const config = { path: "/api/photo" };
