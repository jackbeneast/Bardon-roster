// Texts to clients go out through Mobile Message, from the business number,
// so replies land in Mobile Message rather than on Jack's own mobile.
// Needs MM_API_USER and MM_API_PASS set in Netlify (Project configuration > Environment variables).
// GET  -> { ready, from }   POST { to, message, ref? } -> { ok, id }
import { store, json, checkAdmin } from "../../lib/core.mjs";
import { loadSettings } from "../../lib/docs.mjs";

const SENDER = () => process.env.MM_SENDER || "61468193772";
const ready = () => !!(process.env.MM_API_USER && process.env.MM_API_PASS);

// Australian mobile in any common format -> 04xxxxxxxx, or "" if it isn't one.
export function auMobile(v) {
  let d = String(v || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+61")) d = "0" + d.slice(3);
  else if (d.startsWith("61") && d.length === 11) d = "0" + d.slice(2);
  return /^04\d{8}$/.test(d) ? d : "";
}

export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  const set = await loadSettings(s);
  if (req.method === "GET") return json({ ready: ready(), from: set.biz.sms });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!ready()) return json({ error: "Mobile Message isn't connected yet. Add MM_API_USER and MM_API_PASS in Netlify." }, 503);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const to = auMobile(b.to);
  if (!to) return json({ error: "That isn't an Australian mobile number" }, 400);
  const message = String(b.message || "").trim().slice(0, 1500);
  if (!message) return json({ error: "The message is empty" }, 400);

  const auth = Buffer.from(`${process.env.MM_API_USER}:${process.env.MM_API_PASS}`).toString("base64");
  let r, out;
  try {
    r = await fetch("https://api.mobilemessage.com.au/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
      body: JSON.stringify({ messages: [{ to, message, sender: SENDER(), custom_ref: String(b.ref || "").slice(0, 60) }] }),
    });
    out = await r.json().catch(() => ({}));
  } catch { return json({ error: "Couldn't reach Mobile Message. Try again." }, 502); }
  if (r.status === 401) return json({ error: "Mobile Message rejected the login. Check MM_API_USER and MM_API_PASS in Netlify." }, 502);
  if (r.status === 403) return json({ error: "Mobile Message is out of credits." }, 502);
  const res = (out.results || [])[0] || {};
  if (!r.ok || res.status !== "success") return json({ error: res.error || out.error || (res.status === "blocked" ? "This number has unsubscribed from your texts." : "Mobile Message didn't send it.") }, 502);
  return json({ ok: true, id: res.message_id || "", to });
};

export const config = { path: "/api/sms" };
