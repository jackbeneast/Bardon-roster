// Client engagement tracking.
//   POST (from client pages, via sendBeacon): { p, t, sid, ev, ms, sc, acts, dev }
//   GET  (admin): list of clients with engagement + "what lands" stats
//   GET  ?c=<clientKey> (admin): one client's full timeline
import { store, json, checkAdmin, loadRoster } from "../../lib/core.mjs";
import { loadDocs } from "../../lib/docs.mjs";
import { record, itemsOf, sentByClient } from "../../lib/engage.mjs";

const TYPES = ["quote", "invoice", "report"];

export default async (req) => {
  const s = await store();

  if (req.method === "POST") {
    // sendBeacon posts text/plain; parse it ourselves.
    let b; try { b = JSON.parse(await req.text()); } catch { return new Response(null, { status: 204 }); }
    // Jack testing his own links doesn't count.
    if (req.headers.get("x-admin-key") && (await checkAdmin(s, req))) return new Response(null, { status: 204 });
    try { await record(s, b || {}); } catch { /* tracking must never break a client page */ }
    return new Response(null, { status: 204 });
  }

  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);

  const u = new URL(req.url);
  const [idx, start, docs, roster] = await Promise.all([s.get("engidx"), s.get("engstart"), loadDocs(s), loadRoster(s)]);
  const sent = sentByClient(docs, roster);
  const since = start?.at || "";

  const c = u.searchParams.get("c");
  if (c) {
    const rec = (await s.get(`eng/${c}`)) || null;
    const sessions = rec?.sessions || [];
    const opened = itemsOf(sessions);
    const sentHere = sent[c]?.items || [];
    // Every item: what they were sent, merged with what they opened.
    const items = {};
    for (const it of sentHere) items[it.id] = { ...it, opens: 0, ms: 0, sc: 0, acts: 0, pre: !since || (it.sent || "") < since };
    for (const [id, o] of Object.entries(opened)) items[id] = { ...(items[id] || {}), ...o, doc: items[id]?.doc, sent: items[id]?.sent, state: items[id]?.state };
    const name = rec?.name || sent[c]?.name || idx?.[c]?.name || "Client";
    return json({
      key: c, name, kind: rec?.kind || (c.startsWith("a:") ? "agent" : "client"), phone: sent[c]?.phone || "", since,
      items: Object.values(items).sort((a, b) => (b.last || b.sent || "").localeCompare(a.last || a.sent || "")),
      sessions,
    });
  }

  // ---- list ----
  const keys = new Set([...Object.keys(idx || {}), ...Object.keys(sent)]);
  const clients = [];
  for (const k of keys) {
    const e = idx?.[k];
    const st = sent[k];
    const recent = (st?.items || []).filter((x) => !since || (x.sent || "") >= since);
    clients.push({
      key: k, name: e?.name || st?.name || "Client", kind: e?.kind || (k.startsWith("a:") ? "agent" : "client"),
      last: e?.last || "", visits: e?.n || 0, ms: e?.ms || 0,
      sent: recent.length, lastSent: (st?.items || []).map((x) => x.sent || "").sort().pop() || "",
    });
  }

  // "What lands": for things sent since tracking began, how many get opened and read.
  const stats = Object.fromEntries(TYPES.map((t) => [t, { sent: 0, opened: 0, ms: 0, opens: 0, acted: 0 }]));
  stats.receipt = { sent: 0, opened: 0, ms: 0, opens: 0, acted: 0 };
  stats.portal = { sent: 0, opened: 0, ms: 0, opens: 0, acted: 0 };
  const recs = await Promise.all([...keys].filter((k) => idx?.[k]).map((k) => s.get(`eng/${k}`)));
  const openedById = {};
  for (const r of recs) if (r) for (const [id, it] of Object.entries(itemsOf(r.sessions || []))) openedById[id] = it;
  for (const st of Object.values(sent)) for (const it of st.items) {
    if (since && (it.sent || "") < since) continue;
    const S = stats[it.type]; if (!S) continue;
    S.sent++;
    const o = openedById[it.id];
    if (o) { S.opened++; S.ms += o.ms; S.opens += o.opens; if (o.acts) S.acted++; }
  }
  for (const o of Object.values(openedById)) if (o.type === "receipt" || o.type === "portal") {
    const S = stats[o.type]; S.opened++; S.ms += o.ms; S.opens += o.opens; if (o.acts) S.acted++;
  }

  clients.sort((a, b) => (b.last || b.lastSent || "").localeCompare(a.last || a.lastSent || ""));
  return json({ since, clients, stats });
};

export const config = { path: "/api/engage" };
