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
      async del(k) { try { await unlink(f(k)); } catch {} },
      async list(prefix) { return (await readdir(dir)).map(decodeURIComponent).filter((k) => k.startsWith(prefix)); },
    };
  }
  const { getStore } = await import("@netlify/blobs");
  const s = getStore({ name: STORE, consistency: "strong" });
  return {
    async get(k) { return (await s.get(k, { type: "json" })) ?? null; },
    async set(k, v) { await s.setJSON(k, v); },
    async del(k) { await s.delete(k); },
    async list(prefix) { const { blobs } = await s.list({ prefix }); return blobs.map((b) => b.key); },
  };
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function loadRoster(s) {
  return (await s.get("roster")) || seed;
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
