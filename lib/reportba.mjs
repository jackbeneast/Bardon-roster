// Before & afters on the client report.
// When a job is marked ready, Jack is asked to pick the best line-up pairs (afters taken with
// the line-up camera, linked to the before they were lined up against). Picked pairs lead the
// client's report. If he skips, the report has no before & after section and says nothing about them.
//
// Stored as one record, "reportba": { [booking key]: { st: "y" | "n", ids: [after photo ids], at } }
// The booking key is job.group || job.id, same as everywhere else.

export const MAX_PICKS = 3;
const ID = /^[a-f0-9]{24}$/;

export async function loadBa(s) { return (await s.get("reportba")) || {}; }

// Every line-up pair on a booking's photo list: [{ a: {id, j}, b: {id, j}, room }]
export function pairsOf(photos, fallbackJ) {
  const list = Array.isArray(photos) ? photos : [];
  const byId = Object.fromEntries(list.map((p) => [p.id, p]));
  const out = [];
  for (const p of list) {
    const b = p.kind === "after" && p.pair && byId[p.pair];
    if (!b || b.kind !== "before" || !ID.test(p.id) || !ID.test(b.id)) continue;
    out.push({ a: { id: p.id, j: p.j || fallbackJ }, b: { id: b.id, j: b.j || fallbackJ }, room: p.room || b.room || "" });
  }
  return out;
}

// What the client sees: the picked pairs, in the order Jack picked them. Empty when he skipped,
// hasn't decided, or the photos have since been deleted.
export function baForClient(dec, photos, fallbackJ) {
  if (!dec || dec.st !== "y" || !Array.isArray(dec.ids)) return [];
  const all = pairsOf(photos, fallbackJ);
  return dec.ids.map((id) => all.find((x) => x.a.id === id)).filter(Boolean).slice(0, MAX_PICKS);
}

// Jack's decision. b: { key, ids } to add pairs, { key, skip: true } for none, { key, reset: true } to ask again.
export async function saveBa(s, key, b, photos) {
  const cur = await loadBa(s);
  if (b.reset) delete cur[key];
  else if (b.skip) cur[key] = { st: "n", at: new Date().toISOString() };
  else {
    const have = new Set(pairsOf(photos, "").map((x) => x.a.id));
    const ids = [...new Set(Array.isArray(b.ids) ? b.ids : [])].filter((id) => ID.test(id) && have.has(id)).slice(0, MAX_PICKS);
    if (!ids.length) return { error: "Pick at least one before & after, or skip." };
    cur[key] = { st: "y", ids, at: new Date().toISOString() };
  }
  await s.set("reportba", cur);
  return { ok: true, ba: cur };
}
