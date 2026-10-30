// Backups of everything the hub holds (jobs, clients, quotes, invoices, pay, messages,
// settings…). Photos and other files are left out: they are large, and losing a photo
// is not losing the business record.
//   snapshot(s)      -> { at, keys: { key: value } }   (also used by the desk's Download)
//   saveSnapshot(s)  writes one into a separate Netlify Blobs store, keeping the last 30
//   listBackups()    what's saved
const BINARY = ["photo/", "reqphoto/", "entryf/", "incidentf/", "ctsig/", "rcpt/", "staffid/", "teamphoto/", "tkimg/"];
// Short-lived records that aren't worth keeping.
const SKIP = ["afail/", "reqrate/", "agentcode/", "teamsess/", "pinfail/", "alertsent/"];
const BACKUP_STORE = "bardon-backup";
const KEEP = 30;

export async function snapshot(s, { includeMeta = false } = {}) {
  const all = await s.list("");
  const keys = all.filter((k) => !BINARY.some((p) => k.startsWith(p)) && !SKIP.some((p) => k.startsWith(p)) && !/\.t$/.test(k));
  const out = {};
  // Read in small batches so a big store doesn't open hundreds of requests at once.
  for (let i = 0; i < keys.length; i += 40) {
    const part = keys.slice(i, i + 40);
    const vals = await Promise.all(part.map((k) => s.get(k).catch(() => null)));
    part.forEach((k, n) => { if (vals[n] != null) out[k] = vals[n]; });
  }
  const skipped = all.length - keys.length;
  return { at: new Date().toISOString(), site: process.env.URL || "", count: Object.keys(out).length, ...(includeMeta ? { filesLeftOut: skipped } : {}), keys: out };
}

async function backupStore() {
  const dir = process.env.LOCAL_STORE_DIR;
  if (dir) {
    const { mkdir, writeFile, readdir, unlink, stat } = await import("node:fs/promises");
    const d = dir + "-backup"; await mkdir(d, { recursive: true });
    return {
      async set(k, v) { await writeFile(`${d}/${encodeURIComponent(k)}`, v); },
      async list() { return Promise.all((await readdir(d)).map(async (f) => ({ key: decodeURIComponent(f), size: (await stat(`${d}/${f}`)).size }))); },
      async del(k) { await unlink(`${d}/${encodeURIComponent(k)}`).catch(() => {}); },
    };
  }
  const { getStore } = await import("@netlify/blobs");
  const b = getStore({ name: BACKUP_STORE, consistency: "strong" });
  return {
    async set(k, v) { await b.set(k, v); },
    async list() { const { blobs } = await b.list({ prefix: "snap/" }); return blobs.map((x) => ({ key: x.key })); },
    async del(k) { await b.delete(k); },
  };
}

export async function saveSnapshot(s) {
  const snap = await snapshot(s);
  const body = JSON.stringify(snap), key = `snap/${snap.at.slice(0, 10)}.json`;
  const b = await backupStore();
  await b.set(key, body);
  const list = (await b.list()).map((x) => x.key).filter((k) => k.startsWith("snap/")).sort();
  for (const k of list.slice(0, Math.max(0, list.length - KEEP))) await b.del(k);
  await s.set("plus/lastbackup", { at: snap.at, count: snap.count, bytes: body.length });
  return { at: snap.at, count: snap.count, bytes: body.length };
}

export async function listBackups() {
  const b = await backupStore();
  return (await b.list()).filter((x) => x.key.startsWith("snap/")).map((x) => x.key.slice(5, 15)).sort().reverse();
}
