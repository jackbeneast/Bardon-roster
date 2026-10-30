// Growth hub (/marketing). Admin only.
//   GET  ?part=overview|leads|sources&days=|reviews|agents|clients|pr|brand|settings
//   GET  ?export=gclid      CSV of won jobs from Google Ads clicks, for Google Ads offline conversion import
//   POST { action, ... }    see the switch below
import { store, json, checkAdmin } from "../../lib/core.mjs";
import {
  overviewPart, leadsPart, sourcesPart, reviewsPart, agentsPart, clientsPart, loadPr, loadBrand, loadMktSettings, cleanMktSettings,
  markReview, addRating, saveProspect, logProspect, delProspect, saveSpend, loadSpend, setReward, savePr, delPr, saveBrand, addConsent, gclidCsv, CHANNELS, STAGES,
} from "../../lib/marketing.mjs";
import { loadTemplates } from "../../lib/templates.mjs";

export default async (req) => {
  const s = await store(), u = new URL(req.url);
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);

  if (req.method === "GET") {
    if (u.searchParams.get("export") === "gclid") {
      return new Response(await gclidCsv(s), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bardon-google-ads-won-jobs-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
    }
    const part = u.searchParams.get("part") || "overview";
    try {
      if (part === "overview") return json(await overviewPart(s));
      if (part === "leads") return json(await leadsPart(s));
      if (part === "sources") { const d = Math.min(730, Math.max(7, +u.searchParams.get("days") || 90)); return json(await sourcesPart(s, d)); }
      if (part === "reviews") return json(await reviewsPart(s));
      if (part === "agents") return json(await agentsPart(s));
      if (part === "clients") return json(await clientsPart(s));
      if (part === "pr") return json({ list: (await loadPr(s)).sort((a, b) => b.date.localeCompare(a.date)) });
      if (part === "brand") return json(await loadBrand(s));
      if (part === "settings") { const [set, tpl] = await Promise.all([loadMktSettings(s), loadTemplates(s)]); return json({ settings: set, reviewLink: tpl.reviewLink, channels: CHANNELS, stages: STAGES }); }
    } catch (e) { console.error("marketing", part, e); return json({ error: "Couldn't load that. " + (e.message || "") }, 500); }
    return json({ error: "Unknown part" }, 400);
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const done = (r) => (r && r.error ? json(r, 400) : json(r || { ok: true }));
  switch (b.action) {
    case "settings": { const v = cleanMktSettings(b.settings || {}, await loadMktSettings(s)); await s.set("mkt/settings", v); return json({ ok: true, settings: v }); }
    case "review": return done(await markReview(s, b));
    case "rating": return done(await addRating(s, b));
    case "rating-del": { const l = ((await s.get("mkt/ratings")) || []).filter((x) => x.date !== b.date); await s.set("mkt/ratings", l); return json({ ok: true }); }
    case "agent-save": return done(await saveProspect(s, b));
    case "agent-log": return done(await logProspect(s, b));
    case "agent-del": return done(await delProspect(s, String(b.id || "")));
    case "spend-add": return done(await saveSpend(s, b));
    case "spend-del": { await s.set("mkt/spend", (await loadSpend(s)).filter((x) => x.id !== b.id)); return json({ ok: true }); }
    case "reward": return done(await setReward(s, b));
    case "pr-save": return done(await savePr(s, b));
    case "pr-del": return done(await delPr(s, String(b.id || "")));
    case "brand-save": return done(await saveBrand(s, b));
    case "consent-add": return (await addConsent(s, b.phone, b.name, "Added by Jack" + (b.how ? `: ${String(b.how).slice(0, 40)}` : ""))) ? json({ ok: true }) : json({ error: "That isn't an Australian mobile number." }, 400);
    case "consent-del": { const c = (await s.get("mkt/consent")) || {}; delete c[String(b.phone || "")]; await s.set("mkt/consent", c); return json({ ok: true }); }
  }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/marketing" };
