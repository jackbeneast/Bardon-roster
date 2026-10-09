// Texts to clients go out through Mobile Message, from the business number,
// so replies land in Mobile Message rather than on Jack's own mobile.
// Needs MM_API_USER and MM_API_PASS set in Netlify (Project configuration > Environment variables).
// GET  -> { ready, from }   POST { to, message, ref? } -> { ok, id }
import { store, json, checkAdmin } from "../../lib/core.mjs";
import { loadSettings } from "../../lib/docs.mjs";
import { mmReady, sendSms, auMobile } from "../../lib/mm.mjs";

export { auMobile };

export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  const set = await loadSettings(s);
  if (req.method === "GET") return json({ ready: mmReady(), from: set.biz.sms });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const r = await sendSms(b.to, b.message, b.ref || "", { name: typeof b.name === "string" ? b.name : "" });
  return r.ok ? json(r) : json({ error: r.error }, r.status);
};

export const config = { path: "/api/sms" };
