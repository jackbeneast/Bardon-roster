// Team passcode login and Jack's passcode management.
//   GET                               -> { ok, pid, name } for the current team session (or 401)
//   POST { phone, pin }               -> log in, returns { token, pid, name, exp }
//   POST { action: "logout" }         -> end this session
// Jack only (x-admin-key):
//   GET  ?status=1                    -> passcode status for every team member
//   POST { action: "set", pid, pin? } -> set a passcode (random if none given); returns { pin }
//   POST { action: "unlock", pid }    -> clear wrong-try lockout
//   POST { action: "clear", pid }     -> remove their passcode (they can't log in)
import { store, json, checkAdmin, loadRoster } from "../../lib/core.mjs";
import { login, logout, teamSession, setPin, clearPin, unlock, pinStatus, weakPin, randomPin, pinMatches } from "../../lib/teamauth.mjs";
import { sendSms } from "../../lib/mm.mjs";

export default async (req) => {
  const s = await store(), u = new URL(req.url);

  if (req.method === "GET") {
    if (u.searchParams.get("status")) {
      if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
      const roster = await loadRoster(s);
      return json({ team: roster.team.filter((t) => !t.owner).map((t) => ({ id: t.id, name: t.name, phone: t.phone || "" })), status: await pinStatus(s, roster) });
    }
    const who = await teamSession(s, req);
    if (!who) return json({ error: "Not logged in", teamLogin: true }, 401);
    return json({ ok: true, pid: who.pid, name: who.person.name });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }

  if (b.action === "logout") { await logout(s, req); return json({ ok: true }); }

  if (b.action === "set" || b.action === "unlock" || b.action === "clear" || b.action === "send") {
    if (!(await checkAdmin(s, req))) return json({ error: "Only Jack can change passcodes" }, 401);
    const roster = await loadRoster(s);
    const t = roster.team.find((x) => x.id === b.pid && !x.owner);
    if (!t) return json({ error: "That person isn't on the team" }, 404);
    if (b.action === "unlock") { await unlock(s, t.id); return json({ ok: true }); }
    if (b.action === "clear") { await clearPin(s, t.id); return json({ ok: true }); }
    if (b.action === "send") {
      // Texted from the business number via Mobile Message, never Jack's phone.
      if (!(await pinMatches(s, t.id, b.pin))) return json({ error: "That passcode is out of date. Create a new one." }, 400);
      if (!t.phone) return json({ error: "No mobile number on file for them." }, 400);
      const first = String(t.name || "").split(" ")[0];
      const msg = `Hi ${first}, your Bardon Clean team passcode is ${b.pin}. Log in at https://bardon-roster.netlify.app/me with your mobile number and this passcode. Keep it to yourself.`;
      const r = await sendSms(t.phone, msg, "passcode", { name: t.name });
      if (!r.ok) return json({ error: r.error }, r.status || 502);
      return json({ ok: true, sent: true });
    }
    const pin = b.pin ? String(b.pin) : randomPin(t.phone);
    const bad = weakPin(pin, t.phone);
    if (bad) return json({ error: bad }, 400);
    await setPin(s, t.id, pin);
    return json({ ok: true, pin });
  }

  const r = await login(s, req, b.phone, b.pin);
  if (!r.ok) return json({ error: r.error }, r.status);
  return json(r);
};

export const config = { path: "/api/team-login" };
