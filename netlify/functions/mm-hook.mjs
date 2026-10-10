// Mobile Message calls this when a client replies (inbound) and when a text
// is delivered or fails (status). Must answer 2xx fast; retries are safe
// because every write is keyed on the message.
import { store, json } from "../../lib/core.mjs";
import { hookKey, verifySig, logIn, logStatus, directory, loadContacts } from "../../lib/messages.mjs";
import { notify, firstName } from "../../lib/notify.mjs";
import { timingSafeEqual } from "node:crypto";

const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export default async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  const s = await store();
  const k = new URL(req.url).searchParams.get("k") || "";
  const h = await hookKey(s);
  if (!k || !same(k, h.key)) return json({ error: "Not allowed" }, 403);
  const raw = await req.text();
  if (!verifySig(req, raw)) return json({ error: "Bad signature" }, 401);
  let b; try { b = JSON.parse(raw); } catch { return json({ ok: true }); }

  if (b.type === "inbound" || b.type === "unsubscribe") {
    const t = await logIn(s, b.sender, b.message, b.received_at, b.type);
    if (t && b.type === "inbound") {
      let name = t.name;
      if (!name) {
        // Best effort: name the sender from quote requests, quotes and the roster.
        try {
          const keys = (await s.list("req/")).slice(-300);
          const requests = (await Promise.all(keys.map((x) => s.get(x)))).filter(Boolean);
          const roster = (await s.get("roster")) || {};
          const contacts = await loadContacts(s).catch(() => []);
          name = directory({ requests, agents: roster.agents || [], team: roster.team || [], contacts })[t.phone]?.name || "";
        } catch { /* number only is fine */ }
      }
      await notify(s, {
        type: "text_in", title: `Text from ${name ? firstName(name) : t.phone}`, body: String(b.message || "").slice(0, 300),
        tags: "speech_balloon", priority: 4, url: `/messages/#/t/${t.phone}`,
      });
    }
    return json({ ok: true });
  }
  if (b.status && b.message_id) {
    await logStatus(s, b.to, b.message_id, b.status);
    return json({ ok: true });
  }
  return json({ ok: true });
};

export const config = { path: "/api/mm-hook" };
