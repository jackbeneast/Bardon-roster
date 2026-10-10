// Reads one receipt photo with Claude and returns the fields for an expense.
// Nothing is saved here: the page shows what was read and Jack confirms it.
//
// Needs ANTHROPIC_API_KEY set in Netlify (from console.anthropic.com).
// ANTHROPIC_MODEL can override the model if ever needed.
import { CATS } from "./books.mjs";

const API = "https://api.anthropic.com/v1/messages";
const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
export const scanConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const TOOL = {
  name: "record_receipt",
  description: "Record what this receipt or tax invoice shows.",
  input_schema: {
    type: "object",
    properties: {
      is_receipt: { type: "boolean", description: "False if the image is not a receipt, invoice or proof of payment." },
      supplier: { type: "string", description: "Business that was paid, short and clean, e.g. 'Bunnings', 'Shell Coles Express', 'Telstra'." },
      date: { type: "string", description: "Date of the purchase as YYYY-MM-DD. Australian receipts write dates day first (11/10/26 = 11 October 2026). Empty if not shown." },
      total: { type: "number", description: "Total actually paid in AUD, including GST and any surcharge. Use the final total, not a subtotal." },
      gst: { type: ["number", "null"], description: "GST amount shown on the receipt in AUD. 0 if it clearly shows no GST. null if GST isn't shown at all." },
      category: { type: "string", enum: CATS, description: "Best category for a residential cleaning business." },
      note: { type: "string", description: "A few words on what was bought, e.g. 'Microfibre cloths, sugar soap'. Under 60 characters." },
      foreign_currency: { type: "boolean", description: "True if the amounts are not in Australian dollars." },
      unsure: { type: "string", description: "Anything hard to read or worth Jack double-checking, in a few words. Empty if all clear." },
    },
    required: ["is_receipt", "supplier", "date", "total", "gst", "category", "note", "foreign_currency", "unsure"],
  },
};

const SYSTEM = `You read receipts for Bardon Clean, a residential cleaning business in Brisbane, Australia.
Pull out exactly what the receipt shows. Never guess a total or GST you can't see.
Categories: cleaning chemicals, cloths, sponges, bags and consumables are "Cleaning products"; vacuums, mops, buckets, tools are "Equipment"; petrol or diesel is "Fuel"; rego, servicing, tolls, parking, car wash are "Vehicle"; work shirts are "Uniforms"; apps and subscriptions are "Software"; ads, printing, signage are "Marketing"; payment processing or bank charges are "Bank & card fees". Use "Other" only if nothing fits.`;

export async function scanReceipt(dataUrl, today) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(String(dataUrl || ""));
  if (!m) throw Object.assign(new Error("That file isn't a photo"), { status: 400 });
  if (m[2].length > 6.5e6) throw Object.assign(new Error("That photo is too big"), { status: 413 });

  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 24000);
  let r;
  try {
    r = await fetch(API, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL(), max_tokens: 700, system: SYSTEM,
        tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
          { type: "text", text: `Today is ${today}. If the year isn't printed, use the most recent date on or before today.` },
        ] }],
      }),
    });
  } catch (e) {
    throw Object.assign(new Error(e.name === "AbortError" ? "Took too long to read" : "Couldn't reach the receipt reader"), { status: 504 });
  } finally { clearTimeout(t); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("receipt scan", r.status, JSON.stringify(d).slice(0, 400));
    throw Object.assign(new Error(r.status === 401 ? "The receipt reader key is wrong. Check ANTHROPIC_API_KEY in Netlify." : r.status === 429 || r.status === 529 ? "Receipt reader is busy. Try again in a minute." : "Couldn't read that receipt"), { status: 502 });
  }
  const x = (d.content || []).find((c) => c.type === "tool_use")?.input;
  if (!x) throw Object.assign(new Error("Couldn't read that receipt"), { status: 502 });

  const r2 = (v) => Math.round(v * 100) / 100;
  const total = Number(x.total) > 0 && Number(x.total) < 1e6 ? r2(Number(x.total)) : null;
  let gst = x.gst == null || x.gst === "" ? null : Number(x.gst);
  if (gst != null && (!isFinite(gst) || gst < 0 || (total && gst > total / 11 + 0.05))) gst = null;
  return {
    receipt: x.is_receipt !== false,
    who: String(x.supplier || "").slice(0, 80),
    date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.date <= today ? x.date : "",
    amt: total,
    gstAmt: gst == null ? null : r2(Math.min(gst, total ? total / 11 : gst)),
    cat: CATS.includes(x.category) ? x.category : "Other",
    note: String(x.note || "").slice(0, 120),
    foreign: !!x.foreign_currency,
    unsure: String(x.unsure || "").slice(0, 160),
  };
}
