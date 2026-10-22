// Photos for the website: the best AFTER photos from real jobs, from every job on the roster.
// Jack's hub picks them (/demo-photos/); only the picked ones are ever listed publicly.
//   GET            (public)  { afters: [{ url, room, service }], slots: { <slot>: { url, room, service } } }
//                            afters: the homepage gallery and the /demo job link
//                            slots: single photos for set spots on bardonclean.au (see SLOTS), swapped in by /site-photos.js
//   GET ?pick=1    (admin)   { afters, slots, spots: SLOTS, rooms, jobs, guess, rate, ai }
//                            jobs: [{ key, date, suburb, service, client, photos: [{ room, kind, j, id, at }] }]
//                            (unsorted photos have room "" and kind "")
//   POST           (admin)   { afters: [{ j, id, room, service }], slots: { <slot>: { j, id, room, service, man } } }
//                            -> saves the set (max 12 afters, in order) and the website spots
//   POST ?sort=1   (admin)   { job, items: [{ j, id, at }] } -> Claude guesses room, before/after and privacy
//                            for unsorted photos; cached in demoguess/<job>/<first id>
//   POST ?rate=1   (admin)   { job, items: [{ j, id }] } -> Claude rates after photos 1-5 for the website and
//                            flags private ones; cached in demorate/<job>/<first id> as { id: { r, p, w } }
import { store, json, checkAdmin, loadRoster, loadAllLive, bookingLive, roomsOf } from "../../lib/core.mjs";
import { sortPhotos, rateAfters, sortConfigured } from "../../lib/photosort.mjs";

const ROOMS = ["Kitchen", "Bathrooms", "Bedrooms", "Living & dining", "Laundry", "Windows & tracks", "Outdoor & garage"];
const KINDS = ["before", "after"];
const J = /^[\w-]{1,40}$/, P = /^[a-f0-9]{24}$/;
const MAX = 12;
// Set spots on bardonclean.au that take one photo each. /site-photos.js on the website finds each spot by
// the image file it currently shows (or its alt text), and swaps in the photo picked here.
// svc: which jobs suit it best (any job can still be chosen); room: the room it suits best.
const SLOTS = [
  { id: "home-hero", page: "Homepage", spot: "Top banner", svc: "", room: "Kitchen", files: ["hero-kitchen-brisbane"] },
  { id: "home-presale", page: "Homepage", spot: "Pre-sale card", svc: "presale", room: "Kitchen", files: ["card-presale-kitchen-brisbane"] },
  { id: "home-bond", page: "Homepage", spot: "Bond clean card", svc: "bond", room: "Kitchen", files: ["card-bond-end-of-lease-kitchen"] },
  { id: "home-deep", page: "Homepage", spot: "Deep clean card", svc: "deep", room: "Bathrooms", files: ["card-deep-clean-bathroom"] },
  { id: "guide", page: "Homepage + Vendor's guide", spot: "Free guide picture", svc: "presale", room: "Living & dining", files: ["guide/presale-living-hero"] },
  { id: "presale-hero", page: "Pre-sale page", spot: "Top banner", svc: "presale", room: "Living & dining", files: ["presale-hero-dining"] },
  { id: "bond-hero", page: "Bond clean page", spot: "Top banner", svc: "bond", room: "Kitchen", files: ["bond-page-hero"] },
  { id: "deep-hero", page: "Deep clean page", spot: "Top banner", svc: "deep", room: "Bathrooms", files: ["deepclean-hero-vanity"] },
];
const SLOT_IDS = new Set(SLOTS.map((x) => x.id));
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
function cleanSlots(o) {
  const out = {};
  for (const [k, x] of Object.entries(o && typeof o === "object" ? o : {})) {
    if (!SLOT_IDS.has(k) || !okItem(x)) continue;
    out[k] = { j: String(x.j), id: String(x.id), room: ROOMS.includes(x.room) ? x.room : "", service: str(x.service, 40), ...(x.man ? { man: 1 } : {}) };
  }
  return out;
}
// Sample reports: one real finished job per kind of clean, shown in the demo with the
// address hidden. Jack picks the job and can hide any photo. { presale|bond|deep: { key, hide: [ids] } }
const SHOW_KINDS = ["presale", "bond", "deep"];
function cleanShow(o) {
  const out = {};
  for (const k of SHOW_KINDS) {
    const x = o && o[k];
    if (!x || !J.test(String(x.key || ""))) continue;
    out[k] = { key: String(x.key), hide: [...new Set((Array.isArray(x.hide) ? x.hide : []).filter((id) => P.test(String(id))))].slice(0, 300) };
  }
  return out;
}
// Sample reports live in their own blob (demoshow), so nothing that saves the gallery or the
// website spots (including older versions of the picker) can wipe them. Falls back to the copy
// that was briefly kept inside demophotos.
async function loadPicks(s) {
  const [raw, sh] = await Promise.all([s.get("demophotos"), s.get("demoshow")]);
  return { afters: clean(Array.isArray(raw) ? raw : raw && raw.afters), slots: cleanSlots(raw && raw.slots), show: cleanShow(sh || (raw && raw.show)) };
}
const MAX_REPORT = 80;
// What the public demo gets for each sample report: rooms, sorted photos (minus hidden ones)
// and which checklist items were ticked. Nothing that identifies the client or the address.
function reportOf(roster, live, pick, guess = {}) {
  const days = roster.jobs.filter((j) => !j.sample && (j.group || j.id) === pick.key).sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || "")));
  if (!days.length) return null;
  const home = days[0], L = live[home.id] || {}, hide = new Set(pick.hide);
  const rooms = roomsOf(home);
  // A fair share for every room (up to 4 befores and 6 afters each), so a job with 150 kitchen
  // shots still shows the bedrooms and living areas.
  // The team's own sorting first; for photos they didn't sort, the hub's automatic sorting,
  // but never one it flagged as possibly private.
  const ok = (L.photos || []).filter((p) => P.test(p.id) && !hide.has(p.id)).map((p) => {
    if (rooms.includes(p.room) && KINDS.includes(p.kind)) return p;
    const g = guess[p.id];
    return g && !g.priv && ROOMS.includes(g.room) && KINDS.includes(g.kind) ? { ...p, room: g.room, kind: g.kind } : null;
  }).filter(Boolean).sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  const per = {}, photos = [];
  for (const p of ok) {
    const k = p.room + "|" + p.kind, cap = p.kind === "before" ? 4 : 6;
    if ((per[k] = (per[k] || 0) + 1) > cap) continue;
    photos.push({ room: p.room, kind: p.kind, url: url({ j: p.j || home.id, id: p.id }) });
  }
  photos.splice(MAX_REPORT);
  if (!photos.length) return null;
  const ticked = Object.fromEntries(Object.entries(L.items || {}).filter(([r]) => rooms.includes(r)).map(([r, v]) => [r, Object.keys(v || {}).slice(0, 200)]));
  return { service: home.service || "", rooms, photos, ticked, days: days.length };
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
    const p = await loadPicks(s);
    const afters = p.afters.map((x) => ({ url: url(x), room: x.room, service: x.service }));
    const slots = Object.fromEntries(Object.entries(p.slots).map(([k, x]) => [k, { url: url(x), room: x.room, service: x.service }]));
    const reports = {};
    if (Object.keys(p.show).length) {
      const [roster, raw, guess] = await Promise.all([loadRoster(s), loadAllLive(s), merged(s, "demoguess/")]);
      const live = bookingLive(roster, raw);
      for (const [k, pick] of Object.entries(p.show)) { const r = reportOf(roster, live, pick, guess); if (r) reports[k] = r; }
    }
    return new Response(JSON.stringify({ afters, slots, reports }), {
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
    const cur = await loadPicks(s);
    // One sample report at a time: { action: "show", kind, key } sets it, key "" removes it,
    // { action: "show", kind, hide: [ids] } changes which of its photos are hidden.
    if (b.action === "show") {
      const kind = String(b.kind || "");
      if (!SHOW_KINDS.includes(kind)) return json({ error: "Pick pre-sale, bond or deep" }, 400);
      const show = { ...cur.show };
      if (b.key !== undefined) {
        const key = String(b.key || "");
        if (!key) delete show[kind];
        else if (!J.test(key)) return json({ error: "That job can't be used. Try another." }, 400);
        else show[kind] = { key, hide: [] };
      }
      if (Array.isArray(b.hide)) {
        if (!show[kind]) return json({ error: "Choose a job first" }, 400);
        show[kind] = { ...show[kind], hide: b.hide };
      }
      const out = cleanShow(show);
      await s.set("demoshow", out);
      return json({ ok: true, show: out });
    }
    const afters = b.afters === undefined ? cur.afters : clean(b.afters), slots = b.slots === undefined ? cur.slots : cleanSlots(b.slots);
    await s.set("demophotos", { afters, slots });
    return json({ ok: true, afters, slots, show: cur.show });
  }

  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const [roster, raw, picks, guess, rate] = await Promise.all([loadRoster(s), loadAllLive(s), loadPicks(s), merged(s, "demoguess/"), merged(s, "demorate/")]);
  const live = bookingLive(roster, raw);
  const seen = new Set(), jobs = [];
  for (const j of roster.jobs) {
    if (j.sample) continue; // every real job, whatever the service
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
    const done = !!(live[j.id] && live[j.id].done);
    jobs.push({ key, date: dates[0], suburb: j.suburb || "", service: j.service || "", client: j.client || "", photos, done });
  }
  jobs.sort((a, b) => b.date.localeCompare(a.date));
  return json({ afters: picks.afters, slots: picks.slots, show: picks.show, spots: SLOTS, rooms: ROOMS, jobs, guess, rate, ai: sortConfigured() });
};

export const config = { path: "/api/demo" };
