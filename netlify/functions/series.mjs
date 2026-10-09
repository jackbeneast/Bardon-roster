// Regular clients (Jack only).
//   GET  → { series, proposals (from Jobber), jobber: { on, pending, last } }
//   POST { action: "save", series: {...}, price? }
//        { action: "import", items: [{...proposal}] }   bring Jobber regulars over
//        { action: "delete", id }                       stop it and clear future visits
import { store, json, checkAdmin, loadRoster } from "../../lib/core.mjs";
import { loadSeries, cleanSeries, generate, fromJobber } from "../../lib/series.mjs";
import { loadJobber } from "../../lib/jobber.mjs";

async function setPrice(s, key, price) {
  if (price === undefined || price === null || price === "") return;
  const v = Number(price); if (!isFinite(v) || v < 0 || v > 1e6) return;
  const b = (await s.get("books")) || {};
  await s.set("books", { ...b, recur: { ...(b.recur || {}), [key]: Math.round(v * 100) / 100 } });
}

export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  if (req.method === "GET") {
    const [series, proposals, jb, books] = await Promise.all([loadSeries(s), fromJobber(s), loadJobber(s), s.get("books")]);
    return json({ series, proposals, prices: (books && books.recur) || {}, jobber: { on: !!jb.url, pending: jb.pending.length, last: jb.last } });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const roster = await loadRoster(s), ids = new Set(roster.team.map((t) => t.id));
  let list = await loadSeries(s);

  if (b.action === "save") {
    const prev = b.series?.id ? list.find((x) => x.id === b.series.id) : null;
    const { series, error } = cleanSeries(b.series || {}, prev, ids);
    if (error) return json({ error }, 400);
    list = prev ? list.map((x) => (x.id === series.id ? series : x)) : [...list, series];
    await s.set("series", list);
    await setPrice(s, series.key, b.price);
    const r = await generate(s, { reset: series.id });
    return json({ ok: true, series, ...r });
  }
  if (b.action === "import") {
    let made = 0;
    for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 100)) {
      const { series, error } = cleanSeries({ ...it, next: it.next }, null, ids);
      if (error || list.some((x) => x.key === series.key)) continue;
      list.push(series); made++;
      await setPrice(s, series.key, it.price);
    }
    await s.set("series", list);
    // Future Jobber visits for these streets now belong to the hub schedule, so edits here flow through.
    const keys = Object.fromEntries(list.map((x) => [x.key, x.id])), t = new Date(Date.now() + 10 * 3600e3).toISOString().slice(0, 10);
    const ro = await loadRoster(s); let adopted = 0;
    for (const j of ro.jobs) if (j.rec && keys[j.rec] && !j.ser && j.date >= t) { j.ser = keys[j.rec]; adopted++; }
    if (adopted) await s.set("roster", { ...ro, savedAt: new Date().toISOString() });
    const r = await generate(s);
    return json({ ok: true, made, adopted, ...r });
  }
  if (b.action === "delete") {
    const id = String(b.id || "");
    if (!list.some((x) => x.id === id)) return json({ error: "Not found" }, 404);
    list = list.map((x) => (x.id === id ? { ...x, paused: true } : x));
    await s.set("series", list);
    const r = await generate(s, { reset: id }); // clears future visits nobody has started
    await s.set("series", list.filter((x) => x.id !== id));
    return json({ ok: true, ...r });
  }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/series" };
