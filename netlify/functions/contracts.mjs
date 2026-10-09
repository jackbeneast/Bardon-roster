// Employment contracts. Jack creates a personal signing link; the new starter
// reads and signs at /contract; the signed copy (details, typed name, drawn
// signature, full agreement text) is kept here and the list updates itself.
//   GET  (admin)  → { contracts }            list, no agreement text
//   GET  (admin)  ?id=…                      one signed contract in full
//   GET  (admin)  ?sig=…                     the signature image
//   POST (admin)  { action: "create", name, email, start, signed? }
//                 { action: "status", id, status: "sent" | "signed" }   mark by hand
//                 { action: "delete", id }
//   POST (public) { action: "sign", t?, full_name, email, phone, address, start_date, typed_signature, ... }
import { randomBytes } from "node:crypto";
import { store, json, checkAdmin } from "../../lib/core.mjs";
import { notify } from "../../lib/notify.mjs";

const SITE = () => (process.env.URL || "https://bardon-roster.netlify.app").replace(/\/$/, "");
const str = (v, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const b64url = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const linkOf = (c) => `${SITE()}/contract?t=${c.token}&c=${b64url(JSON.stringify({ n: c.name, e: c.email, ...(c.start ? { s: c.start } : {}) }))}`;

async function loadAll(s) {
  const keys = await s.list("ct/");
  return (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean).sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || ""));
}
const summary = (c) => { const { signed, ...rest } = c; return { ...rest, link: linkOf(c), signedName: signed?.full_name || "", hasSig: !!signed }; };

// Tick "Contract signed" on the matching hiring card, by email or name.
async function tickCandidate(s, email, name) {
  const keys = await s.list("cand/"), e = (email || "").toLowerCase(), n = (name || "").toLowerCase().replace(/\s+/g, " ");
  for (const k of keys) {
    const c = await s.get(k); if (!c) continue;
    if ((e && c.email === e) || (n && c.name.toLowerCase().replace(/\s+/g, " ") === n)) {
      c.checks = { ...(c.checks || {}), contract: true }; await s.set(k, c);
    }
  }
}

export default async (req) => {
  const s = await store(), u = new URL(req.url);
  const admin = await checkAdmin(s, req);

  if (req.method === "GET") {
    if (!admin) return json({ error: "Log in first" }, 401);
    const sig = u.searchParams.get("sig");
    if (sig) {
      const buf = /^[\w-]{1,40}$/.test(sig) ? await s.getBin(`ctsig/${sig}`) : null;
      return buf ? new Response(buf, { headers: { "content-type": "image/png", "cache-control": "private, max-age=3600" } }) : new Response("Not found", { status: 404 });
    }
    const id = u.searchParams.get("id");
    if (id) { const c = await s.get(`ct/${id}`); return c ? json({ contract: { ...c, link: linkOf(c) } }) : json({ error: "Not found" }, 404); }
    return json({ contracts: (await loadAll(s)).map(summary) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }

  if (b.action === "sign") {
    const v = {
      full_name: str(b.full_name, 120), email: str(b.email, 160).toLowerCase(), phone: str(b.phone, 30), address: str(b.address, 300),
      start_date: /^\d{4}-\d{2}-\d{2}$/.test(b.start_date || "") ? b.start_date : "", typed_signature: str(b.typed_signature, 120),
      signed_at: str(b.signed_at, 120), version: str(b.version, 20), agreement: str(b.agreement_text, 60000), device: str(b.device, 300),
      ip: req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "",
      acks: { fwis: !!b.ack_fwis, ceis: !!b.ack_ceis, agree: !!b.ack_agree },
    };
    if (!v.full_name || !v.email || !v.phone || !v.address || !v.start_date || !v.typed_signature) return json({ error: "Please fill in all your details." }, 400);
    if (!v.acks.fwis || !v.acks.ceis || !v.acks.agree) return json({ error: "Please tick all three boxes." }, 400);
    const m = /^data:image\/png;base64,(.+)$/.exec(String(b.signature || ""));
    const png = m ? Buffer.from(m[1], "base64") : null;
    if (!png || png.length < 200 || png.length > 400000) return json({ error: "Please sign in the box." }, 400);
    // Their personal link, or a fresh record for a plain link.
    let c = null;
    const t = str(b.t, 64);
    if (t) { const id = await s.get(`cttok/${t}`); if (id) c = await s.get(`ct/${id.id}`); }
    if (!c) { const token = randomBytes(18).toString("hex"); c = { id: "c" + Date.now().toString(36) + randomBytes(3).toString("hex"), token, name: v.full_name, email: v.email, start: v.start_date, sentAt: new Date().toISOString(), via: "link" }; await s.set(`cttok/${token}`, { id: c.id }); }
    c.status = "signed"; c.signedAt = new Date().toISOString(); c.signed = v;
    await s.setBin(`ctsig/${c.id}`, png);
    await s.set(`ct/${c.id}`, c);
    await tickCandidate(s, v.email, v.full_name);
    await notify(s, { type: "contract", title: `${v.full_name} signed their contract`, body: `Starts ${v.start_date}. Signed copy is in Tools → Employment contracts.`, tags: "memo", priority: 4, url: "/?v=contracts" });
    return json({ ok: true });
  }

  if (!admin) return json({ error: "Log in first" }, 401);
  if (b.action === "create") {
    const name = str(b.name, 120), email = str(b.email, 160).toLowerCase();
    if (name.length < 2) return json({ error: "Add their full name." }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "That email doesn't look right." }, 400);
    const token = randomBytes(18).toString("hex");
    const c = { id: "c" + Date.now().toString(36) + randomBytes(3).toString("hex"), token, name, email, start: /^\d{4}-\d{2}-\d{2}$/.test(b.start || "") ? b.start : "", sentAt: new Date().toISOString(), status: b.signed ? "signed" : "sent", ...(b.signed ? { signedAt: new Date().toISOString(), byHand: true } : {}) };
    await s.set(`ct/${c.id}`, c); await s.set(`cttok/${token}`, { id: c.id });
    if (b.signed) await tickCandidate(s, email, name);
    return json({ ok: true, contract: summary(c) });
  }
  const c = await s.get(`ct/${str(b.id, 40)}`);
  if (!c) return json({ error: "Not found" }, 404);
  if (b.action === "status" && ["sent", "signed"].includes(b.status)) {
    c.status = b.status; if (b.status === "signed") { c.signedAt ||= new Date().toISOString(); c.byHand = !c.signed; await tickCandidate(s, c.email, c.name); } else if (!c.signed) delete c.signedAt;
    await s.set(`ct/${c.id}`, c); return json({ ok: true, contract: summary(c) });
  }
  if (b.action === "delete") { await s.del(`ct/${c.id}`); await s.del(`cttok/${c.token}`); await s.del(`ctsig/${c.id}`); return json({ ok: true }); }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/contracts" };
