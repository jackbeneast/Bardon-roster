// Photos for the website: a short set of the best AFTER photos from real jobs.
// Jack's hub picks them (/demo-photos/); only the picked ones are ever listed publicly.
//   GET            (public)  { afters: [{ url, room, service }] }   used by /demo and the website gallery
//   GET ?pick=1    (admin)   { afters, rooms, jobs, guess, rate, ai }
//                            jobs: [{ key, date, suburb, service, client, photos: [{ room, kind, j, id, at }] }]
//                            (unsorted photos have room "" and kind "")
//   POST           (admin)   { afters: [{ j, id, room, service }] } -> saves the set (max 12, in order)
//   POST ?sort=1   (admin)   { job, items: [{ j, id, at }] } -> Claude guesses room, before/after and privacy
//                            for unsorted photos; cached in demoguess/<job>/<first id>
//   POST ?rate=1   (admin)   { job, items: [{ j, id }] } -> Claude rates after photos 1-5 for the website and
//                            flags private ones; cached in demorate/<job>/<first id> as { id: { r, p, w } }
import { store, json, checkAdmin, loadRoster, loadAllLive, bookingLive } from "../../lib/core.mjs";
import { sortPhotos, rateAfters, sortConfigured } from "../../lib/photosort.mjs";

const ROOMS = ["Kitchen", "Bathrooms", "Bedrooms", "Living & dining", "Laundry", "Windows & tracks", "Outdoor & garage"];
const KINDS = ["before", "after"];
const J = /^[\w-]{1,40}$/, P = /^[a-f0-9]{24}$/;
const MAX = 12;
const url = (x) => `/api/photo?j=${encodeURIComponent(x.j)}&p=${x.id}`;
const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const okItem = (x) => x && J.test(String(x.j || "")) && P.test(String(x.id || ""));
const thumbOf = async (s, x) => (await s.getBin(`photo/${x.j}/${x.id}.t`)) || (await s.getBin(`photo/${x.j}/${x.id}`));

function clean(list) {
  const out = [], seen = new Set();
  for (const x of Array.isArray(list) ? list : []) {
    if (!okItem(x) || seen.has(x.id)) continue;
    seen.add(x.id);
    out.push({ j: String(x.j), id: String(x.id), room: ROOMS.includes(x.room) ? x.room : "", service: str(x.service, 40) });
    if (out.length >= MAX) break;
  }
  return out;
}
async function loadAfters(s) {
  const raw = await s.get("demophotos");
  return clean(Array.isArray(raw) ? raw : raw && raw.afters); // older before/after picks are simply ignored
}
async function merged(s, prefix) {
  const out = {};
  for (const v of await Promise.all((await s.list(prefix)).map((k) => s.get(k)))) Object.assign(out, v || {});
  return out;
}

export default async (req) => {
  const s = await store();
  const u = new URL(req.url);

  if (req.method === "GET" && !u.searchParams.get("pick")) {
    const afters = (await loadAfters(s)).map((x) => ({ url: url(x), room: x.room, service: x.service }));
    return new Response(JSON.stringify({ afters }), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=120", "access-control-allow-origin": "*" },
    });
  }

  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);

  if (req.method === "POST" && (u.searchParams.get("sort") || u.searchParams.get("rate"))) {
    const rate = !!u.searchParams.get("rate");
    if (!sortConfigured()) return json({ error: "Photo checking needs the Claude key (ANTHROPIC_API_KEY) in Netlify", off: true }, 503);
    let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
    const job = String(b.job || "");
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, rate ? 5 : 4).filter(okItem)
      .map((x) => ({ j: String(x.j), id: String(x.id), at: String(x.at || "").slice(0, 40) }));
    if (!J.test(job) || !items.length) return json({ error: "No photos" }, 400);
    const bins = await Promise.all(items.map((x) => thumbOf(s, x)));
    const have = items.map((x, i) => ({ ...x, buf: bins[i] })).filter((x) => x.buf);
    const out = {};
    for (const x of items) if (!have.includes(x)) out[x.id] = rate ? { r: 1, p: 1, w: "Photo missing" } : { room: "", kind: "", priv: true, gone: true };
    if (have.length) {
      const imgs = have.map((x) => ({ b64: Buffer.from(x.buf).toString("base64"), at: x.at }));
      let res;
      try { res = rate ? await rateAfters(imgs) : await sortPhotos(imgs); }
      catch (e) { return json({ error: e.message }, e.status || 502); }
      have.forEach((x, i) => { out[x.id] = rate ? { r: res[i].rating, p: res[i].priv ? 1 : 0, w: res[i].why } : res[i]; });
    }
    // one key per batch, so batches checked in parallel can't overwrite each other
    await s.set(`${rate ? "demorate" : "demoguess"}/${job}/${items[0].id}`, out);
    return json({ ok: true, [rate ? "rate" : "guess"]: out });
  }

  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
    const afters = clean(b.afters);
    await s.set("demophotos", { afters });
    return json({ ok: true, afters });
  }

  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const [roster, raw, afters, guess, rate] = await Promise.all([loadRoster(s), loadAllLive(s), loadAfters(s), merged(s, "demoguess/"), merged(s, "demorate/")]);
  const live = bookingLive(roster, raw);
  const seen = new Set(), jobs = [];
  for (const j of roster.jobs) {
    if (j.sample) continue;
    const key = j.group || j.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const photos = ((live[j.id] && live[j.id].photos) || [])
      .filter((p) => P.test(p.id))
      .map((p) => {
        const sorted = p.room && KINDS.includes(p.kind);
        return { room: sorted ? p.room : "", kind: sorted ? p.kind : "", j: p.j || j.id, id: p.id, at: p.at || "" };
      });
    if (!photos.length) continue;
    const dates = roster.jobs.filter((x) => (x.group || x.id) === key).map((x) => x.date).sort();
    jobs.push({ key, date: dates[0], suburb: j.suburb || "", service: j.service || "", client: j.client || "", photos });
  }
  jobs.sort((a, b) => b.date.localeCompare(a.date));
  return json({ afters, rooms: ROOMS, jobs, guess, rate, ai: sortConfigured() });
};

export const config = { path: "/api/demo" };
