// Mobile Message: texts to clients from the business number.
// Needs MM_API_USER and MM_API_PASS in Netlify. sendSms never throws.
export const SENDER = () => process.env.MM_SENDER || "61468193772";
export const mmReady = () => !!(process.env.MM_API_USER && process.env.MM_API_PASS);

// Australian mobile in any common format -> 04xxxxxxxx, or "" if it isn't one.
export function auMobile(v) {
  let d = String(v || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+61")) d = "0" + d.slice(3);
  else if (d.startsWith("61") && d.length === 11) d = "0" + d.slice(2);
  return /^04\d{8}$/.test(d) ? d : "";
}

// -> { ok, id, to } or { ok:false, status, error }
export async function sendSms(toRaw, message, ref = "") {
  if (!mmReady()) return { ok: false, status: 503, error: "Mobile Message isn't connected yet. Add MM_API_USER and MM_API_PASS in Netlify." };
  const to = auMobile(toRaw);
  if (!to) return { ok: false, status: 400, error: "That isn't an Australian mobile number" };
  const msg = String(message || "").trim().slice(0, 1500);
  if (!msg) return { ok: false, status: 400, error: "The message is empty" };
  const auth = Buffer.from(`${process.env.MM_API_USER}:${process.env.MM_API_PASS}`).toString("base64");
  let r, out;
  try {
    r = await fetch("https://api.mobilemessage.com.au/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
      body: JSON.stringify({ messages: [{ to, message: msg, sender: SENDER(), custom_ref: String(ref).slice(0, 60) }] }),
    });
    out = await r.json().catch(() => ({}));
  } catch { return { ok: false, status: 502, error: "Couldn't reach Mobile Message. Try again." }; }
  if (r.status === 401) return { ok: false, status: 502, error: "Mobile Message rejected the login. Check MM_API_USER and MM_API_PASS in Netlify." };
  if (r.status === 403) return { ok: false, status: 502, error: "Mobile Message is out of credits." };
  const res = (out.results || [])[0] || {};
  if (!r.ok || res.status !== "success") return { ok: false, status: 502, error: res.error || out.error || (res.status === "blocked" ? "This number has unsubscribed from your texts." : "Mobile Message didn't send it.") };
  return { ok: true, id: res.message_id || "", to };
}
