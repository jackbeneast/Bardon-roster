// Sorts unsorted job photos for the website demo picker: which room, before or after,
// and whether it shows something private. Uses the same Claude key as the receipt reader.
// Results are only ever guesses for the demo picker; the job's own photos aren't changed.
import { ROOMS } from "./core.mjs";

const API = "https://api.anthropic.com/v1/messages";
const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
export const sortConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const TOOL = {
  name: "sort_photos",
  description: "Record, for every photo, which room it shows, whether it is a before or after shot, and whether it shows anything private.",
  input_schema: {
    type: "object",
    properties: {
      photos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "The photo number given in the message." },
            room: { type: "string", enum: [...ROOMS, "Other"], description: "Room or area shown. Showers, toilets, vanities and ensuites are Bathrooms. Ovens, cooktops, rangehoods, sinks and pantries are Kitchen. Use Other if unclear or not a room (e.g. a product, a receipt, a close-up you can't place)." },
            kind: { type: "string", enum: ["before", "after", "unclear"], description: "before = visibly dirty, dusty, grimy, cluttered or mid-clean. after = visibly clean and finished. unclear if you can't tell." },
            private: { type: "boolean", description: "True if it shows anything that could identify the home or people: family or personal photos, faces, mail or documents with names, a street number, number plates, or a distinctive street view." },
          },
          required: ["n", "room", "kind", "private"],
        },
      },
    },
    required: ["photos"],
  },
};

const SYSTEM = `You sort job photos for Bardon Clean, a residential cleaning business in Brisbane, Australia.
The team photographs rooms before and after cleaning. Judge each photo on what it shows.
Upload times are a hint only: before shots are usually uploaded earlier in the job, after shots later.
Be strict on privacy: when in doubt, mark private.`;

// photos: [{ b64, at }] in upload order. Returns [{ room, kind, priv }] in the same order.
export async function sortPhotos(photos) {
  const content = [];
  photos.forEach((p, i) => {
    content.push({ type: "text", text: `Photo ${i + 1}${p.at ? ` (uploaded ${p.at})` : ""}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.b64 } });
  });
  content.push({ type: "text", text: `Sort all ${photos.length} photos.` });

  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  let r;
  try {
    r = await fetch(API, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL(), max_tokens: 600, system: SYSTEM, tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name }, messages: [{ role: "user", content }] }),
    });
  } catch (e) {
    throw Object.assign(new Error(e.name === "AbortError" ? "Took too long to sort photos" : "Couldn't reach the photo sorter"), { status: 504 });
  } finally { clearTimeout(t); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("photo sort", r.status, JSON.stringify(d).slice(0, 400));
    throw Object.assign(new Error(r.status === 401 ? "The Claude key is wrong. Check ANTHROPIC_API_KEY in Netlify." : r.status === 429 || r.status === 529 ? "The photo sorter is busy. Try again in a minute." : "Couldn't sort those photos"), { status: 502 });
  }
  const list = (d.content || []).find((c) => c.type === "tool_use")?.input?.photos || [];
  return photos.map((_, i) => {
    const x = list.find((y) => Number(y.n) === i + 1) || {};
    return {
      room: ROOMS.includes(x.room) ? x.room : "",
      kind: x.kind === "before" || x.kind === "after" ? x.kind : "",
      priv: x.private !== false, // missing answer counts as private
    };
  });
}
