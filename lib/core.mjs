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
