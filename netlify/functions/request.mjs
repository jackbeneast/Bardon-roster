// Quote requests from the public form.
//   POST (public)  { ...answers, photos: [base64 jpeg], hp, t }  -> { ok, first }
//   GET  ?photo=<id>  the photo (unguessable id, so <img> can show it in the hub)
//   GET  (admin)   -> { requests, labels }
//   POST (admin)   { action: "status", id, status, quoteId? } | { action: "delete", id }
import { store, json, checkAdmin } from "../../lib/core.mjs";
import { cleanRequest, loadRequests, lines, rid, pid, ipKey, SERVICES, EXTRAS } from "../../lib/requests.mjs";
import { notify, firstName } from "../../lib/notify.mjs";
import { sendSms, mmReady } from "../../lib/mm.mjs";

const PHOTO = /^[a-f0-9]{24}$/;
const MAXPHOTO = 1.5 * 1024 * 1024, MAXN = 8;
const isJpeg = (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8;

export default async (req) => {
  const s = await store();
  const u = new URL(req.url);

  if (req.method === "GET") {
    const p = u.searchParams.get("photo");
    if (p) {
      if (!PHOTO.test(p)) return new Response("Not found", { status: 404 });
      const buf = await s.getBin(`reqphoto/${p}`);
      if (!buf) return new Response("Not found", { status: 404 });
      return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=604800, immutable" } });
    }
    if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
    const list = await loadRequests(s);
    return json({ requests: list.map((r) => ({ ...r, lines: lines(r), serviceLabel: SERVICES[r.service]?.label || "", hubService: SERVICES[r.service]?.hub || "Other" })) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Something went wrong sending that. Please try again." }, 400); }

  // ---- Admin ----
  if (b.action) {
    if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
    const key = `req/${String(b.id || "").replace(/[^\w]/g, "")}`;
    const r = await s.get(key);
    if (!r) return json({ error: "That request was deleted" }, 404);
    if (b.action === "status" && ["new", "quoted", "archived"].includes(b.status)) {
      r.status = b.status; r.seen = true;
      if (b.quoteId) r.quoteId = String(b.quoteId).slice(0, 40);
      await s.set(key, r); return json({ ok: true });
    }
    if (b.action === "seen") { r.seen = true; await s.set(key, r); return json({ ok: true }); }
    if (b.action === "delete") {
      await Promise.all((r.photos || []).map((p) => s.del(`reqphoto/${p}`)));
      await s.del(key); return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  }

  // ---- Public submit ----
  // Bots fill the hidden field or submit instantly. Pretend it worked.
  if (b.hp || !(Number(b.t) >= 4000)) return json({ ok: true, first: "" });
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "";
  const rateKey = `reqrate/${ipKey(ip)}/${new Date().toISOString().slice(0, 13)}`;
  const n = ((await s.get(rateKey))?.n || 0) + 1;
  if (n > 6) return json({ error: "That's a few requests in a short time. Text Jack on 0468 193 772 and he'll sort it out." }, 429);
  await s.set(rateKey, { n });

  const { req: r, error } = cleanRequest(b);
  if (error) return json({ error }, 400);
  r.id = rid(); r.at = new Date().toISOString(); r.status = "new"; r.photos = [];
  for (const p of (Array.isArray(b.photos) ? b.photos : []).slice(0, MAXN)) {
    try {
      const buf = Buffer.from(String(p).replace(/^data:image\/\w+;base64,/, ""), "base64");
      if (!isJpeg(buf) || buf.length > MAXPHOTO) continue;
      const id = pid(); await s.setBin(`reqphoto/${id}`, buf); r.photos.push(id);
    } catch { /* skip a bad photo, keep the request */ }
  }
  await s.set(`req/${r.id}`, r);

  const S = SERVICES[r.service];
  const size = [r.beds != null ? `${r.beds} bed` : "", r.baths != null ? `${r.baths} bath` : ""].filter(Boolean).join(" ");
  await notify(s, {
    type: "request", title: `New request: ${S.label}, ${r.suburb}`,
    body: [`${r.name} · ${r.phone}`, [size, r.extras.length ? r.extras.map((x) => EXTRAS[x].toLowerCase()).join(", ") : ""].filter(Boolean).join(" · "), r.date ? `Date: ${r.date}` : "", r.photos.length ? `${r.photos.length} photo${r.photos.length > 1 ? "s" : ""}` : ""].filter(Boolean).join("\n"),
    tags: "inbox_tray", priority: 5, url: `/money/#/req/${r.id}`,
  });

  // A short confirmation from the business number. No promised turnaround.
  if (mmReady()) {
    const first = firstName(r.name);
    const sent = await sendSms(r.phone, `Hi ${first}, thanks for your quote request for a ${S.label.toLowerCase()}${r.suburb ? ` in ${r.suburb}` : ""}. Jack will look over the details and be in touch. If anything else would help with the quote, just reply here. - Jack, Bardon Clean`, `req:${r.id}`);
    if (sent.ok) { r.texted = true; await s.set(`req/${r.id}`, r); }
  }
  return json({ ok: true, first: firstName(r.name) });
};

export const config = { path: "/api/request" };
