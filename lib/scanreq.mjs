// Reads screenshots of a request that came through Jobber (the request page in the
// Jobber app, or its "new request" email) with Claude, and returns the fields for a
// hub request. Nothing is saved here: Jack checks what was read, then adds it.
// Uses the same ANTHROPIC_API_KEY as the receipt reader.
const API = "https://api.anthropic.com/v1/messages";
const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
export const readerOn = () => !!process.env.ANTHROPIC_API_KEY;

const SERVICES = ["presale", "bond", "deep", "movein", "regular", "other"];
const TOOL = {
  name: "record_request",
  description: "Record the cleaning request these screenshots show.",
  input_schema: {
    type: "object",
    properties: {
      is_request: { type: "boolean", description: "False if the screenshots don't show a client's request or enquiry." },
      name: { type: "string", description: "The client's full name. Empty if not shown." },
      phone: { type: "string", description: "The client's phone number as shown. Never Bardon Clean's own numbers (0406 216 212, 0468 193 772). Empty if not shown." },
      email: { type: "string", description: "The client's email. Not a Jobber or Bardon Clean address. Empty if not shown." },
      street: { type: "string", description: "Street address of the property to be cleaned, e.g. '3/22 Boundary St'. Empty if not shown." },
      suburb: { type: "string", description: "Suburb of the property. Empty if not shown." },
      postcode: { type: "string", description: "4-digit postcode. Empty if not shown." },
      service: { type: "string", enum: SERVICES, description: "presale = selling the home / pre-sale / open homes; bond = end of lease, vacate, bond; deep = one-off deep or spring clean; movein = moving in; regular = weekly, fortnightly or ongoing; other = anything else or unclear." },
      beds: { type: ["integer", "null"], description: "Number of bedrooms, null if not shown." },
      baths: { type: ["integer", "null"], description: "Number of bathrooms, null if not shown. Round a half bathroom down." },
      date: { type: "string", description: "The date they want the clean (or their deadline: open home, lease end, inspection), as YYYY-MM-DD. Australian dates are day first. Not the date the request was sent. Empty if none." },
      notes: { type: "string", description: "Everything else the client said that matters for quoting: condition, extras, access, timing, pets, questions. Their words, tidied. Empty if nothing." },
      full_text: { type: "string", description: "All the client-related text in the screenshots, top to bottom, one item per line. Skip phone status bar, app buttons and menus." },
      unsure: { type: "string", description: "Anything hard to read or worth double-checking, in a few words. Empty if all clear." },
    },
    required: ["is_request", "name", "phone", "email", "street", "suburb", "postcode", "service", "beds", "baths", "date", "notes", "full_text", "unsure"],
  },
};
const SYSTEM = `You read screenshots of cleaning requests for Bardon Clean, a residential cleaning business in Brisbane, Australia. The screenshots come from the Jobber app or Jobber's request emails, and several screenshots may be parts of one long request. Copy exactly what is shown; never invent a phone number, email, address or date.`;

export async function readRequest(images, today) {
  const parts = [];
  for (const u of (Array.isArray(images) ? images : []).slice(0, 4)) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(String(u || ""));
    if (!m) throw Object.assign(new Error("That file isn't a screenshot"), { status: 400 });
    if (m[2].length > 3e6) throw Object.assign(new Error("That screenshot is too big"), { status: 413 });
    parts.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  if (!parts.length) throw Object.assign(new Error("Add a screenshot first"), { status: 400 });
  parts.push({ type: "text", text: `Today is ${today}. If a wanted date has no year, use the next time that date comes around.` });

  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
  let r;
  try {
    r = await fetch(API, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL(), max_tokens: 1500, system: SYSTEM, tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name }, messages: [{ role: "user", content: parts }] }),
    });
  } catch (e) {
    throw Object.assign(new Error(e.name === "AbortError" ? "Took too long to read. Try again." : "Couldn't reach the reader"), { status: 504 });
  } finally { clearTimeout(t); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("request read", r.status, JSON.stringify(d).slice(0, 400));
    throw Object.assign(new Error(r.status === 401 ? "The reader key is wrong. Check ANTHROPIC_API_KEY in Netlify." : r.status === 429 || r.status === 529 ? "The reader is busy. Try again in a minute." : "Couldn't read that screenshot"), { status: 502 });
  }
  const x = (d.content || []).find((c) => c.type === "tool_use")?.input;
  if (!x) throw Object.assign(new Error("Couldn't read that screenshot"), { status: 502 });

  const s = (v, n) => String(v ?? "").trim().slice(0, n);
  const ph = String(x.phone || "").replace(/\D/g, "").replace(/^61/, "0");
  const int = (v, hi) => (Number.isInteger(v) && v >= 0 && v <= hi ? v : null);
  return {
    request: x.is_request !== false,
    name: s(x.name, 120), phone: ["0406216212", "0468193772"].includes(ph) ? "" : s(x.phone, 30),
    email: /jobber|bardonclean/i.test(x.email) ? "" : s(x.email, 160).toLowerCase(),
    address: s(x.street, 200), suburb: s(x.suburb, 80), postcode: /^\d{4}$/.test(s(x.postcode, 4)) ? s(x.postcode, 4) : "",
    service: SERVICES.includes(x.service) ? x.service : "other",
    beds: int(x.beds, 12), baths: int(x.baths, 10),
    date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : "",
    notes: s(x.notes, 2000), raw: s(x.full_text, 8000), unsure: s(x.unsure, 200),
  };
}
