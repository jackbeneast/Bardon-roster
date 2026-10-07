// Jack's notification settings and activity feed.
import { store, json, checkAdmin } from "../../lib/core.mjs";
import { TYPES, loadNotify, cleanNotify, newTopic, testPush, loadActivity } from "../../lib/notify.mjs";

export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  const n = await loadNotify(s);

  if (req.method === "GET") {
    const activity = await loadActivity(s, 150);
    const seen = (await s.get("actseen"))?.at || "";
    return json({ topic: n.topic, server: n.server, off: n.off, types: TYPES, activity, seen });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }

  if (b.action === "seen") {
    await s.set("actseen", { at: new Date().toISOString() });
    return json({ ok: true });
  }
  if (b.action === "topic") {
    // Make a fresh private channel (also used to "reset" if the old one leaks).
    const next = { ...n, topic: newTopic() };
    await s.set("notify", next);
    return json({ ok: true, topic: next.topic });
  }
  if (b.action === "save") {
    const next = cleanNotify(b, n);
    if (!next) return json({ error: "That channel name isn't valid" }, 400);
    await s.set("notify", next);
    return json({ ok: true });
  }
  if (b.action === "test") {
    if (!n.topic) return json({ error: "Turn notifications on first" }, 400);
    return (await testPush(s)) ? json({ ok: true }) : json({ error: "Couldn't reach ntfy. Try again in a minute." }, 502);
  }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/notify" };
