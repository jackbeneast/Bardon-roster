import { store, json, loadRoster, checkAdmin } from "../../lib/core.mjs";

// A team member taps "Got it" on their first-day info.
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const s = await store();
  const roster = await loadRoster(s);
  const person = roster.team.find((t) => t.id === b.personId);
  if (!person) return json({ error: "Not on the team list. Refresh the page." }, 404);
  if (b.clear) {
    if (!(await checkAdmin(s, req))) return json({ error: "Only Jack can reset this" }, 401);
    await s.del(`ack/${person.id}`);
    return json({ ok: true });
  }
  const rec = { at: new Date().toISOString() };
  await s.set(`ack/${person.id}`, rec);
  return json({ ok: true, ack: rec });
};

export const config = { path: "/api/ack" };
