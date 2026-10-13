// Photos for the public website demo (/demo). Jack picks them in the hub (/demo-photos/)
// from real job photos; only the picked ones are ever listed publicly.
//   GET              (public)  { photos: { "Kitchen": { before: url, after: url }, ... } }
//   GET ?pick=1      (admin)   { sel, rooms, jobs: [{ key, date, suburb, service, client, photos: [{ room, kind, j, id }] }] }
//   POST             (admin)   { sel } -> saves the picks
import { store, json, checkAdmin, loadRoster, loadAllLive, bookingLive } from "../../lib/core.mjs";

const ROOMS = ["Kitchen", "Bathrooms", "Bedrooms", "Living & dining", "Laundry", "Windows & tracks"];
const KINDS = ["before", "after"];
const J = /^[\w-]{1,40}$/, P = /^[a-f0-9]{24}$/;
const url = (x) => `/api/photo?j=${encodeURIComponent(x.j)}&p=${x.id}`;

function clean(sel) {
  const out = {};
  for (const r of ROOMS) for (const k of KINDS) {
    const x = sel && sel[r] && sel[r][k];
    if (x && J.test(String(x.j || "")) && P.test(String(x.id || ""))) (out[r] ||= {})[k] = { j: String(x.j), id: String(x.id) };
  }
  return out;
}

export default async (req) => {
  const s = await store();
  const u = new URL(req.url);

  if (req.method === "GET" && !u.searchParams.get("pick")) {
    const sel = clean((await s.get("demophotos")) || {});
    const photos = {};
    for (const [r, v] of Object.entries(sel)) for (const [k, x] of Object.entries(v)) (photos[r] ||= {})[k] = url(x);
    return new Response(JSON.stringify({ photos }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=120" } });
  }

  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);

  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
    const sel = clean(b.sel);
    await s.set("demophotos", sel);
    return json({ ok: true, sel });
  }

  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const [roster, raw, saved] = await Promise.all([loadRoster(s), loadAllLive(s), s.get("demophotos")]);
  const live = bookingLive(roster, raw);
  const seen = new Set(), jobs = [];
  for (const j of roster.jobs) {
    if (j.sample) continue;
    const key = j.group || j.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const photos = ((live[j.id] && live[j.id].photos) || [])
      .filter((p) => p.room && KINDS.includes(p.kind) && P.test(p.id))
      .map((p) => ({ room: p.room, kind: p.kind, j: p.j || j.id, id: p.id }));
    if (!photos.length) continue;
    const dates = roster.jobs.filter((x) => (x.group || x.id) === key).map((x) => x.date).sort();
    jobs.push({ key, date: dates[0], suburb: j.suburb || "", service: j.service || "", client: j.client || "", photos });
  }
  jobs.sort((a, b) => b.date.localeCompare(a.date));
  return json({ sel: clean(saved || {}), rooms: ROOMS, jobs });
};

export const config = { path: "/api/demo" };
