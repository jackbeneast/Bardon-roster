// The desk (/desk): Jack's side of the client-link extras, plus the business tools.
//   GET  ?part=needs|jobs|calib|sources|agents|capacity|cash|rebook|content|incidents|dns|settings|backups   (admin)
//   GET  ?export=1                      (admin) everything the hub holds, as one JSON download
//   GET  ?entry=<id>&v=<share>          a client's own entry report file (or &bk=<booking> for Jack)
//   GET  ?ifile=<incident>&n=<i>        (admin) an incident photo
//   GET  ?manifest=<share>              a home-screen manifest that opens straight to the client's link
//   POST { action, ... }                (admin) see the switch below
import { store, json, loadRoster, checkAdmin } from "../../lib/core.mjs";
import { notify, where } from "../../lib/notify.mjs";
import { sendSms, auMobile } from "../../lib/mm.mjs";
import { loadPlusSettings, cleanPlusSettings, clientAction, addToInvoice, rid, DATA_URL, addrKey, AREA_LABEL } from "../../lib/plus.mjs";
import { needs, jobsPanel, calibrate, sources, agentsCard, capacity, cash, rebook, content } from "../../lib/desk.mjs";
import { snapshot, listBackups } from "../../lib/backup.mjs";

const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const bin = (buf, type) => new Response(buf, { headers: { "content-type": type, "cache-control": "private, max-age=3600" } });

export default async (req) => {
  const s = await store(), u = new URL(req.url);

  if (req.method === "GET") {
    const mf = u.searchParams.get("manifest");
    if (mf) {
      const roster = await loadRoster(s), job = mf.length >= 16 && roster.jobs.find((j) => j.share === mf);
      if (!job) return json({ error: "Not found" }, 404);
      return new Response(JSON.stringify({
        name: "Your clean · Bardon Clean", short_name: "Bardon Clean", start_url: `/v/${mf}`, scope: `/v/${mf}`, display: "standalone",
        background_color: "#F5F0EB", theme_color: "#F5F0EB",
        icons: [{ src: "/icons/brand-apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      }), { headers: { "content-type": "application/manifest+json", "cache-control": "no-store" } });
    }
    const ent = u.searchParams.get("entry");
    if (ent) {
      const id = ent.replace(/[^\w]/g, "");
      let bk = "";
      const v = u.searchParams.get("v") || "";
      if (v.length >= 16) { const roster = await loadRoster(s), j = roster.jobs.find((x) => x.share === v); if (j) bk = j.group || j.id; }
      else if (await checkAdmin(s, req)) bk = String(u.searchParams.get("bk") || "").replace(/[^\w-]/g, "");
      if (!bk) return json({ error: "Not found" }, 404);
      const meta = ((await s.get(`entry/${bk}`)) || []).find((x) => x.id === id), buf = meta && (await s.getBin(`entryf/${bk}/${id}`));
      return buf ? bin(buf, meta.type) : json({ error: "Not found" }, 404);
    }
    if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
    if (u.searchParams.get("export")) {
      const data = await snapshot(s, { includeMeta: true });
      return new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="bardon-hub-export-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "no-store" } });
    }
    const inf = u.searchParams.get("ifile");
    if (inf) {
      const buf = await s.getBin(`incidentf/${inf.replace(/[^\w]/g, "")}/${Math.max(0, parseInt(u.searchParams.get("n") || "0", 10) || 0)}`);
      return buf ? bin(buf, "image/jpeg") : json({ error: "Not found" }, 404);
    }
    const part = u.searchParams.get("part") || "needs";
    try {
      switch (part) {
        case "needs": return json(await needs(s));
        case "jobs": return json(await jobsPanel(s));
        case "calib": return json(await calibrate(s));
        case "sources": return json(await sources(s, Math.min(730, Math.max(7, parseInt(u.searchParams.get("days") || "90", 10) || 90))));
        case "agents": return json({ agents: await agentsCard(s) });
        case "capacity": return json(await capacity(s));
        case "cash": return json(await cash(s));
        case "rebook": return json({ list: await rebook(s) });
        case "content": return json({ list: await content(s) });
        case "incidents": return json({ list: await incidents(s) });
        case "dns": return json({ list: (await s.get("plus/dns")) || [] });
        case "settings": return json({ settings: await loadPlusSettings(s), labels: AREA_LABEL });
        case "backups": return json({ list: await listBackups() });
      }
    } catch (e) { console.error("desk", part, e); return json({ error: "Couldn't load that. " + (e.message || "") }, 500); }
    return json({ error: "Unknown part" }, 400);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const now = new Date().toISOString();
  const roster = await loadRoster(s);
  const jobOf = () => { const k = String(b.bk || ""); return roster.jobs.filter((j) => (j.group || j.id) === k).sort((x, y) => x.date.localeCompare(y.date))[0]; };

  switch (b.action) {
    case "dismiss": { const d = (await s.get("plus/dismiss")) || {}; d[str(b.key, 160)] = now; await s.set("plus/dismiss", d); return json({ ok: true }); }
    case "settings": { const prev = await loadPlusSettings(s); const nx = cleanPlusSettings(b.settings || {}, prev); await s.set("plus/settings", nx); return json({ ok: true, settings: nx }); }
    case "moment": {
      const job = jobOf(); if (!job) return json({ error: "Booking not found" }, 404);
      const t = str(b.text, 200); if (!t) return json({ error: "Type the update first" }, 400);
      const list = (await s.get(`moment/${job.group || job.id}`)) || [];
      list.push({ id: rid(), t, at: now, by: "jack" });
      await s.set(`moment/${job.group || job.id}`, list.slice(-60));
      return json({ ok: true, moments: list });
    }
    case "unmoment": {
      const k = String(b.bk || ""); const list = ((await s.get(`moment/${k}`)) || []).filter((m) => m.id !== b.id);
      await s.set(`moment/${k}`, list); return json({ ok: true, moments: list });
    }
    case "addon-new": {
      const job = jobOf(); if (!job) return json({ error: "Booking not found" }, 404);
      const title = str(b.title, 120), price = Math.round(Number(b.price) * 100) / 100;
      if (!title || !(price > 0 && price < 100000)) return json({ error: "Add what it is and the price (inc GST)." }, 400);
      const k = job.group || job.id, list = (await s.get(`addon/${k}`)) || [];
      list.push({ id: rid("a"), title, note: str(b.note, 400), price, state: "pending", at: now });
      await s.set(`addon/${k}`, list);
      return json({ ok: true, addons: list });
    }
    case "addon-del": { const k = String(b.bk || ""); const list = ((await s.get(`addon/${k}`)) || []).filter((a) => a.id !== b.id); await s.set(`addon/${k}`, list); return json({ ok: true, addons: list }); }
    case "addon-invoiced": {
      const k = String(b.bk || ""), list = (await s.get(`addon/${k}`)) || [], a = list.find((x) => x.id === b.id);
      if (!a) return json({ error: "Not found" }, 404);
      const job = jobOf();
      if (b.auto && job) { const ok = await addToInvoice(s, roster, job, a); if (!ok) return json({ error: "No unpaid invoice on this booking yet. Create the invoice first, then try again." }, 400); }
      else { a.invoiced = "manual"; await s.set(`addon/${k}`, list); }
      return json({ ok: true, addons: (await s.get(`addon/${k}`)) || list });
    }
    case "eta-hide": { const k = String(b.bk || ""); if (b.value) await s.set(`etahide/${k}`, { at: now }); else await s.del(`etahide/${k}`); return json({ ok: true }); }
    case "prefs": {
      const job = jobOf(); if (!job) return json({ error: "Booking not found" }, 404);
      const ak = addrKey(job); if (!ak) return json({ error: "This booking has no address." }, 400);
      await s.set(`home/${ak}`, { prefs: str(b.prefs, 1200), at: now, by: "jack" });
      return json({ ok: true });
    }
    case "link": { // view-only or referral link for a booking, made from the desk
      const job = jobOf(); if (!job) return json({ error: "Booking not found" }, 404);
      const r = await clientAction(s, roster, { ...job, share: job.share }, { action: b.kind === "ref" ? "x-ref" : "x-share" }, { notify, where, sendSms, auMobile });
      return json(r);
    }
    case "dns-save": {
      const list = (Array.isArray(b.list) ? b.list : []).slice(0, 300).map((d) => ({ id: str(d.id, 20) || rid(), name: str(d.name, 120), phone: str(d.phone, 30), email: str(d.email, 160), address: str(d.address, 160), note: str(d.note, 300) })).filter((d) => d.name || d.phone || d.email || d.address);
      await s.set("plus/dns", list); return json({ ok: true, list });
    }
    case "rebook-done": { const d = (await s.get("plus/rebookdone")) || {}; d[str(b.key, 120)] = now; await s.set("plus/rebookdone", d); return json({ ok: true }); }
    case "posted": { const d = (await s.get("plus/posted")) || {}; if (b.value) d[str(b.id, 40)] = now; else delete d[str(b.id, 40)]; await s.set("plus/posted", d); return json({ ok: true }); }
    case "incident-save": {
      const prev = b.id ? await s.get(`incident/${str(b.id, 40)}`) : null;
      const x = {
        id: prev?.id || rid("i"), date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : now.slice(0, 10), time: /^\d{2}:\d{2}$/.test(b.time || "") ? b.time : "",
        job: str(b.job, 160), what: str(b.what, 3000), who: str(b.who, 200), action: str(b.fix, 2000), status: b.status === "closed" ? "closed" : "open",
        insurer: !!b.insurer, photos: prev?.photos || 0, at: prev?.at || now, updated: now,
      };
      if (!x.what) return json({ error: "Say what happened." }, 400);
      for (const p of (Array.isArray(b.photos) ? b.photos : []).slice(0, 8)) {
        const m = DATA_URL.exec(String(p || "")); if (!m || !/^image\//.test(m[1])) continue;
        const buf = Buffer.from(m[2], "base64"); if (buf.length > 3.5 * 1024 * 1024 || x.photos >= 12) continue;
        await s.setBin(`incidentf/${x.id}/${x.photos}`, buf); x.photos++;
      }
      await s.set(`incident/${x.id}`, x);
      return json({ ok: true, incident: x });
    }
    case "incident-del": {
      const id = str(b.id, 40), x = await s.get(`incident/${id}`);
      if (x) { for (let i = 0; i < (x.photos || 0); i++) await s.del(`incidentf/${id}/${i}`); await s.del(`incident/${id}`); }
      return json({ ok: true });
    }
    case "backup-now": {
      const { saveSnapshot } = await import("../../lib/backup.mjs");
      const r = await saveSnapshot(s);
      return json({ ok: true, ...r });
    }
  }
  return json({ error: "Unknown action" }, 400);
};

async function incidents(s) {
  const keys = await s.list("incident/");
  return (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

export const config = { path: "/api/plus" };
