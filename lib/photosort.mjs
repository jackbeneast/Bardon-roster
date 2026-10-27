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
// rooms: the job's own areas (defaults to the standard list); answers outside it come back blank.
export async function sortPhotos(photos, rooms = ROOMS, opts = {}) {
  const tool = rooms === ROOMS ? TOOL : JSON.parse(JSON.stringify(TOOL));
  if (rooms !== ROOMS) tool.input_schema.properties.photos.items.properties.room.enum = [...rooms, "Other"];
  const content = [];
  photos.forEach((p, i) => {
    content.push({ type: "text", text: `Photo ${i + 1}${p.at ? ` (uploaded ${p.at})` : ""}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.b64 } });
  });
  content.push({ type: "text", text: `Sort all ${photos.length} photos.` });

  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeout || 9000);
  let r;
  try {
    r = await fetch(API, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL(), max_tokens: Math.max(600, photos.length * 60), system: SYSTEM, tools: [tool], tool_choice: { type: "tool", name: tool.name }, messages: [{ role: "user", content }] }),
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
      room: rooms.includes(x.room) ? x.room : "",
      kind: x.kind === "before" || x.kind === "after" ? x.kind : "",
      priv: x.private !== false, // missing answer counts as private
    };
  });
}

// ---- matching before and after shots ----
// Given the before and after photos of one room on one job, Claude says which pairs show the
// same spot from a similar angle, and how well each would sell the clean on a website.
const MATCH_TOOL = {
  name: "match_pairs",
  description: "Rate every before/after combination.",
  input_schema: {
    type: "object",
    properties: {
      pairs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            b: { type: "integer", description: "Before photo number (B1, B2… → 1, 2…)." },
            a: { type: "integer", description: "After photo number (A1, A2… → 1, 2…)." },
            same_spot: { type: "boolean", description: "True only if both photos clearly show the same object or surface from a similar position, so a before/after slider would line up. Same room but a different spot is false." },
            rating: { type: "integer", minimum: 1, maximum: 5, description: "How well this pair would show off the clean on a premium cleaning company's website: 5 = obvious, satisfying transformation, well lit, tidy framing. 1 = weak, confusing, dark, or off-putting (gross close-ups, toilets, drains)." },
            private: { type: "boolean", description: "True if either photo shows family photos, faces, mail, a street number or number plates." },
          },
          required: ["b", "a", "same_spot", "rating", "private"],
        },
      },
    },
    required: ["pairs"],
  },
};

// befores/afters: [{ b64 }]. Returns [{ b, a, same, rating, priv }] with 0-based indexes.
export async function matchPairs(room, befores, afters) {
  const content = [];
  befores.forEach((p, i) => { content.push({ type: "text", text: `B${i + 1} (before):` }); content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.b64 } }); });
  afters.forEach((p, i) => { content.push({ type: "text", text: `A${i + 1} (after):` }); content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.b64 } }); });
  content.push({ type: "text", text: `These are ${room} photos from one cleaning job. Rate all ${befores.length * afters.length} before/after combinations. Be strict about same_spot.` });

  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9500);
  let r;
  try {
    r = await fetch(API, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL(), max_tokens: 800, system: SYSTEM, tools: [MATCH_TOOL], tool_choice: { type: "tool", name: MATCH_TOOL.name }, messages: [{ role: "user", content }] }),
    });
  } catch (e) {
    throw Object.assign(new Error(e.name === "AbortError" ? "Took too long to match photos" : "Couldn't reach the photo matcher"), { status: 504 });
  } finally { clearTimeout(t); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("photo match", r.status, JSON.stringify(d).slice(0, 400));
    throw Object.assign(new Error(r.status === 401 ? "The Claude key is wrong. Check ANTHROPIC_API_KEY in Netlify." : r.status === 429 || r.status === 529 ? "The photo matcher is busy. Try again in a minute." : "Couldn't match those photos"), { status: 502 });
  }
  const list = (d.content || []).find((c) => c.type === "tool_use")?.input?.pairs || [];
  const out = [];
  befores.forEach((_, bi) => afters.forEach((_, ai) => {
    const x = list.find((y) => Number(y.b) === bi + 1 && Number(y.a) === ai + 1) || {};
    out.push({ b: bi, a: ai, same: x.same_spot === true, rating: Math.max(1, Math.min(5, Number(x.rating) || 1)), priv: x.private !== false });
  }));
  return out;
}

// ---- rating after photos for the website gallery ----
// Claude looks at finished-job photos and says how well each would show off Bardon Clean's
// work on a premium website, and whether it shows anything private.
const RATE_TOOL = {
  name: "rate_afters",
  description: "Rate every after photo for a premium cleaning company's website gallery.",
  input_schema: {
    type: "object",
    properties: {
      photos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "The photo number given in the message." },
            rating: { type: "integer", minimum: 1, maximum: 5, description: "5 = gleaming, well lit, tidy framing, makes a home look spotless and inviting (e.g. a sparkling kitchen, a clean shower with clear glass, a bright empty living room). 3 = clean but plain or awkward. 1 = dark, blurry, cluttered, a gross close-up, a toilet bowl or drain, or not obviously clean." },
            private: { type: "boolean", description: "True if it shows family or personal photos, faces, mail or documents with names, a street number, number plates, or a distinctive street view." },
            why: { type: "string", description: "At most 6 words on what makes it strong or weak, e.g. 'Bright, gleaming benchtops, wide view'." },
          },
          required: ["n", "rating", "private", "why"],
        },
      },
    },
    required: ["photos"],
  },
};

// photos: [{ b64 }]. Returns [{ rating, priv, why }] in the same order.
export async function rateAfters(photos) {
  const content = [];
  photos.forEach((p, i) => { content.push({ type: "text", text: `Photo ${i + 1}:` }); content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.b64 } }); });
  content.push({ type: "text", text: `These are after-clean photos. Rate all ${photos.length} for the website gallery. Be strict: only a few photos deserve a 5.` });
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9500);
  let r;
  try {
    r = await fetch(API, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL(), max_tokens: 700, system: SYSTEM, tools: [RATE_TOOL], tool_choice: { type: "tool", name: RATE_TOOL.name }, messages: [{ role: "user", content }] }),
    });
  } catch (e) {
    throw Object.assign(new Error(e.name === "AbortError" ? "Took too long to rate photos" : "Couldn't reach the photo rater"), { status: 504 });
  } finally { clearTimeout(t); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("photo rate", r.status, JSON.stringify(d).slice(0, 400));
    throw Object.assign(new Error(r.status === 401 ? "The Claude key is wrong. Check ANTHROPIC_API_KEY in Netlify." : r.status === 429 || r.status === 529 ? "The photo rater is busy. Try again in a minute." : "Couldn't rate those photos"), { status: 502 });
  }
  const list = (d.content || []).find((c) => c.type === "tool_use")?.input?.photos || [];
  return photos.map((_, i) => {
    const x = list.find((y) => Number(y.n) === i + 1) || {};
    return { rating: Math.max(1, Math.min(5, Number(x.rating) || 1)), priv: x.private !== false, why: String(x.why || "").slice(0, 60) };
  });
}
