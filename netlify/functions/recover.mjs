import { store, json, loadRoster, loadBooking, daysOf, foldProgress, emptyLive, checkAdmin, roomsOf, PROGRESS } from "../../lib/core.mjs";
import { where } from "../../lib/notify.mjs";

// Find and restore job progress that isn't showing on a booking (Jack only).
//   GET  ?job=<id>  → what's stored for every day, plus anything that looks lost:
//                     progress on areas the job no longer lists, photo images not on the job,
//                     progress saved under job ids no longer on the roster, and team notes
//                     from the activity feed that aren't on the job.
//   POST { job, orphans:[ids], photos:true, flags:true, areas:true } → puts them back.
// Nothing is deleted: orphan records stay where they are as a backup.

const ID = /^[a-f0-9]{24}$/;
const count = (L) => ({
  rooms: Object.keys(L.rooms || {}).length,
  done: Object.values(L.rooms || {}).filter((r) => r && r.s === "d").length,
  checks: Object.values(L.items || {}).reduce((n, v) => n + Object.keys(v || {}).length, 0),
  photos: (L.photos || []).length,
  notes: (L.flags || []).length,
  clockins: Object.keys(L.arrived || {}).length,
  finished: L.done || "",
  updated: L.updated || "",
});
const hasAny = (L) => !!L && (PROGRESS.some((k) => { const v = L[k]; return Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : !!v; }) || Object.keys(L.arrived || {}).length);

async function scan(s, roster, job) {
  const days = daysOf(roster, job), home = days[0];
  const raw = {};
  for (const d of days) raw[d.id] = { ...emptyLive(), ...((await s.get(`live/${d.id}`)) || {}) };
  const { P } = foldProgress(days, raw);
  const rooms = roomsOf(job);

  // Progress kept under area names the job no longer lists (hidden on every screen).
  const lc = new Set(rooms.map((r) => r.toLowerCase()));
  const hidden = [...new Set([...Object.keys(P.rooms || {}), ...Object.keys(P.items || {}), ...(P.photos || []).map((p) => p.room).filter(Boolean)])]
    .filter((r) => !lc.has(r.toLowerCase()));

  // Saved progress under job ids that aren't on the roster any more.
  const onRoster = new Set(roster.jobs.map((j) => j.id));
  const orphans = [];
  const cand = (await s.list("live/")).map((k) => k.slice(5)).filter((id) => !onRoster.has(id));
  await Promise.all(cand.map(async (id) => {
    const [L, done] = await Promise.all([s.get(`live/${id}`), s.get(`recovered/${id}`)]);
    if (done || !hasAny(L)) return; // already put back into a job, or empty
    orphans.push({ id, ...count(L), rooms: Object.keys(L.rooms || {}), notesText: (L.flags || []).map((f) => f.t).slice(0, 8) });
  }));
  orphans.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));

  // Other jobs on the roster for the same client or street, not part of this booking.
  const inB = new Set(days.map((d) => d.id));
  const street = (x) => { const m = /(\d+[a-z]?)\s+([a-z]+)/i.exec(String(x || "")); return m ? (m[1] + " " + m[2]).toLowerCase() : ""; };
  const sk = street(job.address), cl = String(job.client || "").trim().toLowerCase();
  const related = [];
  for (const j of roster.jobs) {
    if (inB.has(j.id) || j.sample) continue;
    if (!((sk && street(j.address) === sk) || (cl && String(j.client || "").trim().toLowerCase() === cl))) continue;
    const [L, done] = await Promise.all([s.get(`live/${j.id}`), s.get(`recovered/${j.id}`)]);
    if (done || !hasAny(L)) continue;
    related.push({ id: j.id, date: j.date, service: j.service || "", address: j.address || j.suburb || "", ...count(L), rooms: Object.keys(L.rooms || {}), notesText: (L.flags || []).map((f) => f.t).slice(0, 8) });
  }

  // When the booking's progress happened, by Brisbane date.
  const bne = (t) => { const n = Date.parse(t || ""); return isNaN(n) ? "?" : new Date(n + 10 * 3600e3).toISOString().slice(0, 10); };
  const when = {};
  const bump = (t, k) => { const d = bne(t); (when[d] ||= { date: d, areas: 0, checks: 0, photos: 0, notes: 0 })[k]++; };
  for (const v of Object.values(P.rooms || {})) if (v && v.s === "d") bump(v.at, "areas");
  for (const r of Object.values(P.items || {})) for (const v of Object.values(r || {})) bump(v && v.at, "checks");
  for (const ph of P.photos || []) bump(ph.at, "photos");
  for (const f of P.flags || []) bump(f.at, "notes");

  // Photo images stored for this booking that the job doesn't list.
  const have = new Set((P.photos || []).map((p) => p.id));
  const loose = [];
  for (const d of days) {
    const ids = new Set();
    for (const k of await s.list(`photo/${d.id}/`)) { const p = k.split("/")[2].replace(/\.t$/, ""); if (ID.test(p)) ids.add(p); }
    for (const p of ids) if (!have.has(p)) loose.push({ id: p, j: d.id });
  }

  // Team notes logged to the activity feed around these dates that aren't on the job.
  const lo = new Date(Date.parse(home.date + "T00:00:00+10:00") - 864e5).toISOString();
  const hi = new Date(Date.parse(days[days.length - 1].date + "T00:00:00+10:00") + 2 * 864e5).toISOString();
  const tag = `Note at ${where(job)}: `, onJob = new Set((P.flags || []).map((f) => f.t));
  const notes = [];
  for (const k of await s.list("act/")) {
    const at = k.slice(4, 28);
    if (at < lo || at > hi) continue;
    const a = await s.get(k);
    if (!a || a.type !== "flag" || !String(a.title).startsWith(tag)) continue;
    const t = a.title.slice(tag.length);
    if (onJob.has(t)) continue;
    const d = String(a.body || "").split("\nFrom ")[0].replace(/\nThe agent can see this\.$/, "");
    notes.push({ t, d, at: a.at });
  }

  return {
    job: job.id, address: where(job), rooms,
    days: days.map((d) => ({ id: d.id, date: d.date, ...count(raw[d.id]) })),
    booking: { ...count(P), clockins: days.reduce((n, d) => n + Object.keys(raw[d.id].arrived || {}).length, 0) }, hidden, orphans: orphans.slice(0, 20), related, loose, notes,
    byDate: Object.values(when).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req))) return json({ error: "Log in as Jack first" }, 401);
  const roster = await loadRoster(s);
  const u = new URL(req.url);

  if (req.method === "GET") {
    const job = roster.jobs.find((j) => j.id === u.searchParams.get("job"));
    if (!job) return json({ error: "That job isn't on the roster." }, 404);
    return json(await scan(s, roster, job));
  }

  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
    const job = roster.jobs.find((j) => j.id === b.job);
    if (!job) return json({ error: "That job isn't on the roster." }, 404);
    const found = await scan(s, roster, job);
    const bk = await loadBooking(s, roster, job), H = bk.H;
    const now = new Date().toISOString(), done = [];

    // Merge progress from orphan records Jack picked (never the other way round).
    const pick = (Array.isArray(b.orphans) ? b.orphans : []).filter((id) => found.orphans.some((o) => o.id === id) || found.related.some((o) => o.id === id));
    if (pick.length) {
      const rec = { [bk.home.id]: H };
      for (const id of pick) rec[id] = { ...emptyLive(), ...((await s.get(`live/${id}`)) || {}) };
      const { P } = foldProgress([bk.home, ...pick.map((id) => ({ id }))], rec);
      Object.assign(H, P);
      // Orphan photos' images are stored under the orphan id: copy them onto the booking's first day.
      for (const p of H.photos) if (pick.includes(p.j)) {
        const full = await s.getBin(`photo/${p.j}/${p.id}`), th = await s.getBin(`photo/${p.j}/${p.id}.t`);
        if (full) { await s.setBin(`photo/${bk.home.id}/${p.id}`, full); if (th) await s.setBin(`photo/${bk.home.id}/${p.id}.t`, th); p.j = bk.home.id; }
      }
      for (const id of pick) await s.set(`recovered/${id}`, { job: bk.home.id, at: now });
      done.push(`progress from ${pick.length} older record${pick.length === 1 ? "" : "s"}`);
    }

    // Photos whose images are stored but aren't on the job: back in as "to sort".
    if (b.photos && found.loose.length) {
      const have = new Set(H.photos.map((p) => p.id));
      let n = 0;
      for (const p of found.loose) if (!have.has(p.id)) { H.photos.push({ id: p.id, room: "", kind: "", by: "admin", at: now, j: p.j }); n++; }
      if (n) done.push(`${n} photo${n === 1 ? "" : "s"} (in "To sort")`);
    }

    // Team notes from the activity feed.
    if (b.flags && found.notes.length) {
      const have = new Set(H.flags.map((f) => f.t));
      let n = 0;
      for (const f of found.notes) if (!have.has(f.t) && H.flags.length < 30) { H.flags.push({ id: Math.random().toString(36).slice(2, 10), t: f.t, d: f.d, by: "", at: f.at }); n++; }
      if (n) done.push(`${n} note${n === 1 ? "" : "s"}`);
    }

    // Areas with progress the job stopped listing: add them back to every day.
    if (b.areas) {
      // H now includes anything merged above, so check its area names directly.
      const names = Object.keys(H.rooms).concat(Object.keys(H.items), H.photos.map((p) => p.room).filter(Boolean));
      const add = [...new Set(names)].filter((r) => !roomsOf(job).some((x) => x.toLowerCase() === r.toLowerCase()));
      if (add.length) {
        const key = job.group || job.id, list = roomsOf(job).concat(add).slice(0, 30);
        const fresh = await loadRoster(s);
        fresh.jobs.forEach((j) => { if ((j.group || j.id) === key) j.rooms = list.slice(); });
        await s.set("roster", { ...fresh, savedAt: new Date().toISOString() });
        done.push(`${add.length} area${add.length === 1 ? "" : "s"} put back (${add.join(", ")})`);
      }
    }

    if (!done.length) return json({ ok: true, done: [], ...(await scan(s, await loadRoster(s), job)) });
    await bk.save();
    const r2 = await loadRoster(s);
    return json({ ok: true, done, ...(await scan(s, r2, r2.jobs.find((j) => j.id === job.id) || job)) });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/recover" };
