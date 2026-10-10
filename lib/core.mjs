// Shared logic for the roster functions. Storage is Netlify Blobs in
// production; set LOCAL_STORE_DIR to use plain files when testing locally.
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import seed from "./seed.mjs";

const STORE = "bardon-roster";

async function store() {
  const dir = process.env.LOCAL_STORE_DIR;
  if (dir) {
    await mkdir(dir, { recursive: true });
    const f = (k) => path.join(dir, encodeURIComponent(k));
    return {
      async get(k) { try { return JSON.parse(await readFile(f(k), "utf8")); } catch { return null; } },
      async set(k, v) { await writeFile(f(k), JSON.stringify(v)); },
      async getBin(k) { try { return await readFile(f(k)); } catch { return null; } },
      async setBin(k, buf) { await writeFile(f(k), Buffer.from(buf)); },
      async del(k) { try { await unlink(f(k)); } catch {} },
      async list(prefix) { return (await readdir(dir)).map(decodeURIComponent).filter((k) => k.startsWith(prefix)); },
    };
  }
  const { getStore } = await import("@netlify/blobs");
  const s = getStore({ name: STORE, consistency: "strong" });
  return {
    async get(k) { return (await s.get(k, { type: "json" })) ?? null; },
    async set(k, v) { await s.setJSON(k, v); },
    async getBin(k) { return (await s.get(k, { type: "arrayBuffer" })) ?? null; },
    async setBin(k, buf) { await s.set(k, buf); },
    async del(k) { await s.delete(k); },
    async list(prefix) { const { blobs } = await s.list({ prefix }); return blobs.map((b) => b.key); },
  };
}

// ---- live job progress (shared by the roster, agent portal and vendor links) ----
export const ROOMS = ["Kitchen", "Bathrooms", "Bedrooms", "Living & dining", "Laundry", "Windows & tracks", "Outdoor & garage"];
export const DEFAULT_ROOMS = ROOMS.slice(0, 6);
export const LOCK = { doors: "Windows and doors locked", lights: "Lights and fans off", ac: "Air-con off", keys: "Keys returned or lockbox set" };
export const roomsOf = (job) => (Array.isArray(job.rooms) && job.rooms.length ? job.rooms : DEFAULT_ROOMS);

export function emptyLive() { return { arrived: {}, left: {}, rooms: {}, items: {}, assign: {}, supplies: [], photos: [], flags: [], lock: {} }; }
export async function loadLive(s, jobId) { return { ...emptyLive(), ...((await s.get(`live/${jobId}`)) || {}) }; }
export async function loadAllLive(s) {
  const keys = await s.list("live/");
  const out = {};
  await Promise.all(keys.map(async (k) => { const v = await s.get(k); if (v) out[k.slice(5)] = { ...emptyLive(), ...v }; }));
  return out;
}

// ---- multi-day bookings share one set of progress ----
// Clock in/off (arrived, left) is per day. Everything else (areas, checklists, photos,
// notes, supplies, lock-up, finish) belongs to the booking and lives on its first day,
// so day 2 picks up exactly where day 1 left off.
export const PROGRESS = ["rooms", "items", "assign", "photos", "flags", "supplies", "lock", "eta", "done"];
const byWhen = (a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || ""));
export function daysOf(roster, job) {
  if (!job.group) return [job];
  const g = roster.jobs.filter((j) => j.group === job.group).sort(byWhen);
  return g.length ? g : [job];
}
const hasProgress = (L) => !!L && PROGRESS.some((k) => {
  const v = L[k];
  return Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : !!v;
});
// Fold every day's progress into one record. Days that kept their own progress (before
// bookings shared it, or a day that used to be its own job) are merged in, not lost.
// Each photo is stamped with j = the job id its image is stored under.
export function foldProgress(days, rec) {
  const home = days[0], H = { ...emptyLive(), ...(rec[home.id] || {}) };
  const P = {
    rooms: { ...H.rooms }, items: Object.fromEntries(Object.entries(H.items || {}).map(([r, v]) => [r, { ...v }])),
    assign: { ...H.assign }, photos: (H.photos || []).map((p) => ({ ...p, j: p.j || home.id })),
    flags: (H.flags || []).slice(), supplies: (H.supplies || []).slice(), lock: { ...H.lock },
  };
  if (H.eta) P.eta = H.eta;
  if (H.done) P.done = H.done;
  const moved = [];
  for (const d of days.slice(1)) {
    const L = rec[d.id];
    if (!hasProgress(L)) continue;
    moved.push(d.id);
    for (const [r, v] of Object.entries(L.rooms || {})) if (!P.rooms[r] || (v.at || "") > (P.rooms[r].at || "")) P.rooms[r] = v;
    for (const [r, v] of Object.entries(L.items || {})) P.items[r] = { ...v, ...(P.items[r] || {}) };
    for (const [r, v] of Object.entries(L.assign || {})) if (!P.assign[r]) P.assign[r] = v;
    const seen = new Set(P.photos.map((p) => p.id));
    for (const p of L.photos || []) if (!seen.has(p.id)) P.photos.push({ ...p, j: p.j || d.id });
    P.flags.push(...(L.flags || []));
    P.supplies.push(...(L.supplies || []));
    for (const [k, v] of Object.entries(L.lock || {})) if (!P.lock[k]) P.lock[k] = v;
    if (L.eta) P.eta = L.eta;
    if (L.done && (!P.done || L.done > P.done)) P.done = L.done;
  }
  return { P, moved };
}
// What each day looks like: its own clock-ins plus the booking's shared progress.
export function bookingLive(roster, live) {
  const out = {}, done = new Set();
  for (const j of roster.jobs) {
    const key = j.group || j.id;
    if (done.has(key)) continue;
    done.add(key);
    const days = daysOf(roster, j), { P } = foldProgress(days, live);
    const upd = days.map((d) => live[d.id]?.updated || "").sort().pop();
    for (const d of days) {
      const L = live[d.id] || {};
      out[d.id] = { ...emptyLive(), arrived: L.arrived || {}, left: L.left || {}, ...P, ...(upd ? { updated: upd } : {}) };
    }
  }
  return out;
}
// For a write: load every day, fold the progress onto the first day, and return the records.
// save() writes the first day (with all progress), the day being changed, and strips
// progress from any other day it was folded out of.
export async function loadBooking(s, roster, job) {
  const days = daysOf(roster, job), home = days[0], rec = {};
  for (const d of days) rec[d.id] = await loadLive(s, d.id);
  const { P, moved } = foldProgress(days, rec);
  const H = rec[home.id];
  Object.assign(H, P);
  for (const k of PROGRESS) if (!(k in P)) delete H[k];
  const D = rec[job.id];
  return {
    days, home, H, D,
    async save() {
      const at = new Date().toISOString();
      H.updated = at; await s.set(`live/${home.id}`, H);
      for (const d of days.slice(1)) {
        if (d.id !== job.id && !moved.includes(d.id)) continue;
        const L = rec[d.id]; for (const k of PROGRESS) delete L[k];
        if (d.id === job.id) L.updated = at;
        await s.set(`live/${d.id}`, { ...emptyLive(), ...L });
      }
      return this.view();
    },
    view() {
      const all = bookingLive({ jobs: days }, rec);
      return { live: all[job.id], days: all };
    },
  };
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function loadRoster(s) {
  const r = await s.get("roster");
  if (!r) return { agents: [], ...seed };
  if (!Array.isArray(r.agents)) r.agents = [];
  // Rosters saved before first-day info existed: add the defaults once.
  if (!r.info) {
    r.info = seed.info;
    r.team = r.team.map((t) => (t.owner ? t : { ...t, newStarter: true }));
  }
  return r;
}

export async function loadConfirms(s) {
  const keys = await s.list("confirm/");
  const out = {};
  await Promise.all(keys.map(async (k) => {
    const [, jobId, personId] = k.split("/");
    const v = await s.get(k);
    if (v) (out[jobId] ||= {})[personId] = v;
  }));
  return out;
}

export async function loadAcks(s) {
  const keys = await s.list("ack/");
  const out = {};
  await Promise.all(keys.map(async (k) => { const v = await s.get(k); if (v) out[k.slice(4)] = v; }));
  return out;
}

export function shiftOf(job, id) {
  const s = job.shifts && job.shifts[id];
  return { start: (s && s.start) || job.start, end: (s && s.end) || job.end };
}
export function sig(job, id) {
  const s = shiftOf(job, id);
  return `${job.date}|${s.start}|${s.end}`;
}

// ---- admin password (set on first use, stored as a salted hash) ----
function hash(pw, salt) { return scryptSync(String(pw), salt, 32).toString("hex"); }

export async function checkAdmin(s, req) {
  const pw = req.headers.get("x-admin-key") || "";
  const rec = await s.get("admin");
  if (!rec || !pw) return false;
  const a = Buffer.from(hash(pw, rec.salt), "hex"), b = Buffer.from(rec.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function adminIsSet(s) { return !!(await s.get("admin")); }
export async function setAdmin(s, pw) {
  const salt = randomBytes(16).toString("hex");
  await s.set("admin", { salt, hash: hash(pw, salt), at: new Date().toISOString() });
}

export { store };
