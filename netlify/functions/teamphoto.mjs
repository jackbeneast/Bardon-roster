// Cleaner photos for the client's "your team" card. Only shown once Jack has
// ticked that the cleaner is OK with clients seeing it.
//   GET  ?p=<team id>         (public) the photo, if allowed
//   GET  ?list=1              (admin)  { photos: { id: { v, ok } } }
//   POST ?id=<team id>        (admin)  JPEG body: set the photo
//   POST { action: "ok", id, ok } | { action: "delete", id }  (admin)
import { store, json, checkAdmin } from "../../lib/core.mjs";

export async function loadTeamPhotos(s) { return (await s.get("teamphotos")) || {}; }
const okId = (v) => /^[\w-]{1,40}$/.test(v || "");

export default async (req) => {
  const s = await store(), u = new URL(req.url);
  const meta = await loadTeamPhotos(s);
  if (req.method === "GET") {
    if (u.searchParams.get("list")) {
      if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
      return json({ photos: meta });
    }
    const id = u.searchParams.get("p") || "";
    const admin = await checkAdmin(s, req);
    if (!okId(id) || !meta[id] || (!meta[id].ok && !admin)) return new Response("Not found", { status: 404 });
    const buf = await s.getBin(`teamphoto/${id}`);
    if (!buf) return new Response("Not found", { status: 404 });
    return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" } });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  const qid = u.searchParams.get("id");
  if (qid) {
    if (!okId(qid)) return json({ error: "Bad id" }, 400);
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length < 100 || buf.length > 600000 || buf[0] !== 0xff || buf[1] !== 0xd8) return json({ error: "That photo didn't come through. Try another." }, 400);
    await s.setBin(`teamphoto/${qid}`, buf);
    meta[qid] = { v: Date.now().toString(36), ok: !!meta[qid]?.ok };
    await s.set("teamphotos", meta);
    return json({ ok: true, photos: meta });
  }
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  if (!okId(b.id)) return json({ error: "Bad id" }, 400);
  if (b.action === "ok") { if (!meta[b.id]) return json({ error: "Add a photo first" }, 400); meta[b.id].ok = !!b.ok; }
  else if (b.action === "delete") { delete meta[b.id]; await s.del(`teamphoto/${b.id}`); }
  else return json({ error: "Unknown action" }, 400);
  await s.set("teamphotos", meta);
  return json({ ok: true, photos: meta });
};

export const config = { path: "/api/teamphoto" };
