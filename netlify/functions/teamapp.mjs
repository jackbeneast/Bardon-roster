// Team app content: weekly focus, toolkit guides, house rules.
//   GET                 (anyone with the team link) -> { sections, content, admin }
//   GET  ?img=<id>      a guide photo
//   PUT  { content }    (admin) save everything
//   POST ?img=1         (admin) JPEG body -> { id }
//   POST { action: "reset" } (admin) back to the starter content
import { randomBytes } from "node:crypto";
import { store, json, checkAdmin } from "../../lib/core.mjs";
import { teamSession, needLogin } from "../../lib/teamauth.mjs";
import { SECTIONS, DEFAULT, cleanContent, loadContent } from "../../lib/teamapp.mjs";

export default async (req) => {
  const s = await store(), u = new URL(req.url);

  if (req.method === "GET") {
    const img = u.searchParams.get("img");
    if (img) {
      if (!/^[a-f0-9]{24}$/.test(img)) return new Response("Not found", { status: 404 });
      const buf = await s.getBin(`tkimg/${img}`);
      if (!buf) return new Response("Not found", { status: 404 });
      return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } });
    }
    const admin = await checkAdmin(s, req);
    if (!admin && !(await teamSession(s, req))) return needLogin(json);
    return json({ sections: SECTIONS, content: await loadContent(s), admin });
  }

  if (!(await checkAdmin(s, req))) return json({ error: "Only Jack can change this. Log in to the hub on this phone first." }, 401);

  if (req.method === "POST" && u.searchParams.get("img")) {
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length < 100 || buf.length > 1500000 || buf[0] !== 0xff || buf[1] !== 0xd8) return json({ error: "That photo didn't come through. Try another." }, 400);
    const id = randomBytes(12).toString("hex");
    await s.setBin(`tkimg/${id}`, buf);
    return json({ ok: true, id });
  }

  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  if (req.method === "POST" && b.action === "reset") {
    await s.del("teamapp");
    return json({ ok: true, content: { ...DEFAULT, starter: true } });
  }
  if (req.method === "PUT") {
    const content = { ...cleanContent(b.content || {}), updated: new Date().toISOString() };
    await s.set("teamapp", content);
    return json({ ok: true, content });
  }
  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/teamapp" };
