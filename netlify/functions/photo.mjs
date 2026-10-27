import { randomBytes } from "node:crypto";
import { store, json, loadRoster, loadBooking, daysOf, checkAdmin, roomsOf } from "../../lib/core.mjs";
import { teamSession, needLogin } from "../../lib/teamauth.mjs";
import { sortPhotos, sortConfigured } from "../../lib/photosort.mjs";

const MAX = 5 * 1024 * 1024;
const TMAX = 400 * 1024;
const LIMIT = 3000;
const ID = /^[a-f0-9]{24}$/;
const isJpeg = (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8;

// Before/after photos. The roster resizes to JPEG (plus a small thumbnail) before upload.
// Upload is two steps so a batch can go up several at a time without the
// live record being overwritten by parallel requests:
//   POST ?stage=bin  body = thumbnail bytes then full bytes (tl = thumbnail length) -> { id }
//   POST ?stage=add  JSON { ids, room?, kind? } -> adds them to the job (no room = "to sort")
//   POST ?stage=tag  JSON { ids, room, kind } -> sorts photos into a room and before/after
//   POST ?stage=auto JSON { ids } (up to 6) -> Claude sorts them; unsure ones stay "to sort"
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
    return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=604800, immutable" } });
  }

  const roster = await loadRoster(s);
  const job = roster.jobs.find((x) => x.id === u.searchParams.get("job"));
  if (!job) return json({ error: "That job isn't on the roster any more." }, 404);
  const admin = await checkAdmin(s, req);
  let pid = u.searchParams.get("person") || "";
  if (!admin) {
    const me = await teamSession(s, req, roster);
    if (!me) return needLogin(json);
    if (pid && pid !== me.pid) return json({ error: "You're logged in as someone else. Log out and back in as yourself." }, 403);
    pid = me.pid;
  }
  if (!admin && !(job.staff || []).includes(pid)) return json({ error: "Only the team on this job can add photos." }, 403);
  const stage = u.searchParams.get("stage") || "";

  // Step 1: store the image only. Nothing on the job changes yet.
  if (req.method === "POST" && stage === "bin") {
    const b = new Uint8Array(await req.arrayBuffer());
    const tl = Math.max(0, parseInt(u.searchParams.get("tl") || "0", 10) || 0);
    if (!b.length || b.length > MAX + TMAX || tl > TMAX || tl >= b.length) return json({ error: "Photo is too large. Try again." }, 413);
    const thumb = b.subarray(0, tl), full = b.subarray(tl);
    if (!isJpeg(full) || (tl && !isJpeg(thumb))) return json({ error: "That file isn't a photo." }, 400);
    const id = randomBytes(12).toString("hex"), hj = daysOf(roster, job)[0].id; // a booking's photos live on its first day
    await s.setBin(`photo/${hj}/${id}`, full.slice().buffer);
    if (tl) await s.setBin(`photo/${hj}/${id}.t`, thumb.slice().buffer);
    return json({ ok: true, id });
  }

  let body = {};
  if (req.method === "POST" || (req.method === "DELETE" && !u.searchParams.get("id"))) {
    try { body = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  }
  const ids = [...new Set(Array.isArray(body.ids) ? body.ids.filter((x) => ID.test(x)) : [])];
  const bk = await loadBooking(s, roster, job), L = bk.H, hj = bk.home.id;
  const save = async (extra = {}) => json({ ok: true, ...(await bk.save()), ...extra });
  const tagOk = (room, kind) => roomsOf(job).includes(room) && ["before", "after"].includes(kind);

  if (req.method === "DELETE") {
    const del = u.searchParams.get("id") ? [u.searchParams.get("id")] : ids;
    if (!del.length || !del.every((x) => ID.test(x))) return json({ error: "Bad photo" }, 400);
    const where = Object.fromEntries(L.photos.map((ph) => [ph.id, ph.j || hj]));
    L.photos = L.photos.filter((ph) => !del.includes(ph.id));
    await Promise.all(del.flatMap((id) => [s.del(`photo/${where[id] || hj}/${id}`), s.del(`photo/${where[id] || hj}/${id}.t`)]));
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
    const ok = await Promise.all(fresh.map(async (id) => !!((await s.getBin(`photo/${hj}/${id}.t`)) || (await s.getBin(`photo/${hj}/${id}`)))));
    const add = fresh.filter((_, i) => ok[i]);
    if (L.photos.length + add.length > LIMIT) return json({ error: `This job is at the ${LIMIT} photo limit. Delete some first.` }, 400);
    const at = new Date().toISOString(), by = admin && !pid ? "admin" : pid;
    const taken = body.taken && typeof body.taken === "object" ? body.taken : {};
    add.forEach((id) => { const t = Number(taken[id]); L.photos.push({ id, room, kind, by, at, j: hj, ...(t > 1e12 && t < 4e12 ? { tk: new Date(t).toISOString() } : {}) }); });
    return save({ added: add.length, missing: fresh.length - add.length });
  }

  // Sort photos into a room and before/after. Splitting kind from room lets a batch be
  // marked "before" first and given rooms later; a manual sort clears the auto-sorted flag.
  if (stage === "tag") {
    if (!ids.length) return json({ error: "Select some photos first" }, 400);
    const kOk = ["before", "after"].includes(body.kind), rOk = roomsOf(job).includes(body.room);
    if (!(kOk && rOk) && !(body.only === "kind" && kOk) && !(body.only === "room" && rOk)) return json({ error: "Pick a room and before or after" }, 400);
    L.photos.forEach((p) => { if (ids.includes(p.id)) { if (body.only !== "kind") p.room = body.room; if (body.only !== "room") p.kind = body.kind; delete p.ai; } });
    return save();
  }

  // Jack has checked the auto-sorted photos: clear the flag.
  if (stage === "ok") {
    L.photos.forEach((p) => { if (!ids.length || ids.includes(p.id)) delete p.ai; });
    return save();
  }

  // Claude sorts a small batch from the thumbnails. Anything it isn't sure of stays "to sort".
  // Photos it sorted carry ai:1 so they show up under "Check auto-sorted".
  if (stage === "auto") {
    if (!admin) return json({ error: "Only Jack can auto-sort" }, 403);
    if (!sortConfigured()) return json({ error: "Auto-sort needs the Claude key (ANTHROPIC_API_KEY) in Netlify", off: true }, 503);
    const pick = L.photos.filter((p) => ids.includes(p.id)).slice(0, 6);
    if (!pick.length) return json({ error: "No photos" }, 400);
    const imgs = (await Promise.all(pick.map(async (p) => {
      const buf = (await s.getBin(`photo/${p.j || hj}/${p.id}.t`)) || (await s.getBin(`photo/${p.j || hj}/${p.id}`));
      return buf ? { p, b64: Buffer.from(buf).toString("base64"), at: (p.tk || p.at || "").slice(11, 16) } : null;
    }))).filter(Boolean);
    if (!imgs.length) return json({ error: "Couldn't load those photos" }, 404);
    let res;
    try { res = await sortPhotos(imgs.map((x) => ({ b64: x.b64, at: x.at ? `taken ${x.at}` : "" })), roomsOf(job), { timeout: 7000 }); }
    catch (e) { return json({ error: e.message, off: e.status === 503 }, e.status || 502); }
    // The sorter takes a few seconds, so re-read the job before saving: anything uploaded or
    // sorted by hand in the meantime is kept.
    const fresh = await loadBooking(s, await loadRoster(s), job);
    let sorted = 0, partial = 0;
    imgs.forEach((x, i) => {
      const r = res[i] || {}, cur = fresh.H.photos.find((p) => p.id === x.p.id); if (!cur || (cur.room && cur.kind)) return;
      if (r.room && !cur.room) cur.room = r.room;
      if (r.kind && !cur.kind) cur.kind = r.kind;
      if (cur.room && cur.kind) { cur.ai = 1; sorted++; } else if (cur.room || cur.kind) { cur.ai = 1; partial++; }
    });
    return json({ ok: true, ...(await fresh.save()), sorted, partial, tried: imgs.length });
  }

  return json({ error: "Unknown request" }, 400);
};

export const config = { path: "/api/photo" };
