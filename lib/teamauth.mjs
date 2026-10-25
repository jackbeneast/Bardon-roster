// Team passcodes. Every team member gets a 4-digit passcode that Jack sets.
// They log in with their mobile number + passcode and get a session token
// (sent as the x-team-session header). Nothing on the roster or team app is
// readable without either Jack's password or a valid team session.
//
// Strictness:
//  - passcodes stored as salted scrypt hashes, never in the clear
//  - 5 wrong tries on one person = locked 15 minutes; 10 in a row = locked
//    until Jack unlocks them (and Jack gets a ping)
//  - 10 wrong tries from one internet connection in an hour = that connection
//    is blocked for an hour, whichever names/numbers it tries
//  - sessions last 7 days, are stored hashed, and die the moment Jack resets
//    that person's passcode, locks them, or removes them from the team
import { scryptSync, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { loadRoster } from "./core.mjs";
import { notify, firstName } from "./notify.mjs";

const SESSION_DAYS = 7;
const SOFT_TRIES = 5, SOFT_LOCK_MIN = 15, HARD_TRIES = 10;
const IP_TRIES = 10, IP_WINDOW_MIN = 60;
const DUMMY_SALT = "0".repeat(32);

const sha = (x) => createHash("sha256").update(String(x)).digest("hex");
const hashPin = (pin, salt) => scryptSync(String(pin), salt, 32).toString("hex");
export const normPhone = (p) => String(p || "").replace(/\D/g, "").slice(-9);
export const ipOf = (req) => req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

export function weakPin(pin, phone) {
  if (!/^\d{4}$/.test(pin)) return "Passcode must be exactly 4 digits.";
  if (/^(\d)\1{3}$/.test(pin)) return "Too easy to guess (all the same digit).";
  const up = "0123456789", down = "9876543210";
  if (up.includes(pin) || down.includes(pin)) return "Too easy to guess (a run of numbers).";
  if (/^(\d\d)\1$/.test(pin)) return "Too easy to guess (a repeated pair).";
  if (/^(19|20)\d\d$/.test(pin)) return "Too easy to guess (looks like a year).";
  const ph = String(phone || "").replace(/\D/g, "");
  if (ph && ph.slice(-4) === pin) return "Can't be the last 4 digits of their mobile.";
  return "";
}

export function randomPin(phone) {
  for (;;) {
    const p = String(randomBytes(2).readUInt16BE(0) % 10000).padStart(4, "0");
    if (!weakPin(p, phone)) return p;
  }
}

const member = (roster, pid) => roster.team.find((t) => t.id === pid && !t.owner);

// ---- Jack's side ----
export async function setPin(s, pid, pin) {
  const salt = randomBytes(16).toString("hex");
  const prev = (await s.get(`pin/${pid}`)) || {};
  const v = (prev.v || 0) + 1; // bumping the version kills every old session
  await s.set(`pin/${pid}`, { salt, hash: hashPin(pin, salt), v, setAt: new Date().toISOString() });
  await s.del(`pinfail/${pid}`);
  return v;
}
export async function clearPin(s, pid) {
  await s.del(`pin/${pid}`); await s.del(`pinfail/${pid}`);
}
export async function unlock(s, pid) { await s.del(`pinfail/${pid}`); }

export async function pinStatus(s, roster) {
  const out = {};
  for (const t of roster.team.filter((x) => !x.owner)) {
    const [p, f, last] = await Promise.all([s.get(`pin/${t.id}`), s.get(`pinfail/${t.id}`), s.get(`pinlast/${t.id}`)]);
    const now = Date.now();
    out[t.id] = {
      set: !!p, setAt: p?.setAt || "", hasPhone: !!normPhone(t.phone),
      locked: f?.hard ? "hard" : f?.until && Date.parse(f.until) > now ? "soft" : "",
      until: f?.until || "", fails: f?.n || 0, lastLogin: last?.at || "",
    };
  }
  return out;
}

// ---- logging in ----
async function ipBlocked(s, ip) {
  const r = await s.get(`pinip/${sha(ip)}`);
  if (!r) return false;
  return r.until && Date.parse(r.until) > Date.now();
}
async function ipFail(s, ip) {
  const k = `pinip/${sha(ip)}`, now = Date.now();
  let r = (await s.get(k)) || {};
  if (!r.since || now - Date.parse(r.since) > IP_WINDOW_MIN * 60e3) r = { since: new Date(now).toISOString(), n: 0 };
  r.n = (r.n || 0) + 1;
  if (r.n >= IP_TRIES) r.until = new Date(now + IP_WINDOW_MIN * 60e3).toISOString();
  await s.set(k, r);
}

export async function login(s, req, phone, pin) {
  const ip = ipOf(req);
  const nope = { ok: false, status: 401, error: "That mobile number and passcode don't match. Check them and try again." };
  if (await ipBlocked(s, ip)) return { ok: false, status: 429, error: "Too many wrong tries from this connection. Wait an hour, or text Jack." };
  const ph = normPhone(phone);
  pin = String(pin || "");
  const roster = await loadRoster(s);
  const t = ph.length === 9 ? roster.team.find((x) => !x.owner && normPhone(x.phone) === ph) : null;
  const rec = t ? await s.get(`pin/${t.id}`) : null;
  // Always do the hash work so a wrong number takes as long as a wrong passcode.
  const got = Buffer.from(hashPin(pin, rec ? rec.salt : DUMMY_SALT), "hex");
  if (!t || !rec || !/^\d{4}$/.test(pin)) { await ipFail(s, ip); return nope; }

  const fk = `pinfail/${t.id}`, f = (await s.get(fk)) || {};
  if (f.hard) return { ok: false, status: 423, error: "This login is locked after too many wrong passcodes. Text Jack to unlock it." };
  if (f.until && Date.parse(f.until) > Date.now()) return { ok: false, status: 423, error: "Too many wrong passcodes. Try again in 15 minutes, or text Jack." };

  const want = Buffer.from(rec.hash, "hex");
  if (!(got.length === want.length && timingSafeEqual(got, want))) {
    await ipFail(s, ip);
    const n = (f.n || 0) + 1, nf = { n };
    if (n >= HARD_TRIES) {
      nf.hard = true;
      await notify(s, { type: "pin_lock", title: `${firstName(t.name)}'s team login is locked`, body: `${n} wrong passcodes in a row. Unlock or reset it in Team passcodes.`, tags: "lock", priority: 4, url: "/passcodes/" });
    } else if (n % SOFT_TRIES === 0) nf.until = new Date(Date.now() + SOFT_LOCK_MIN * 60e3).toISOString();
    await s.set(fk, nf);
    const left = n >= HARD_TRIES ? 0 : SOFT_TRIES - (n % SOFT_TRIES);
    if (nf.hard) return { ok: false, status: 423, error: "This login is now locked after too many wrong passcodes. Text Jack to unlock it." };
    if (nf.until) return { ok: false, status: 423, error: "Too many wrong passcodes. Try again in 15 minutes, or text Jack." };
    return { ...nope, error: nope.error + (left <= 2 ? ` ${left} ${left === 1 ? "try" : "tries"} left before it locks.` : "") };
  }

  await s.del(fk);
  const token = randomBytes(32).toString("hex");
  const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await s.set(`tsess/${sha(token)}`, { pid: t.id, v: rec.v, exp, at: new Date().toISOString() });
  await s.set(`pinlast/${t.id}`, { at: new Date().toISOString() });
  return { ok: true, token, pid: t.id, name: t.name, exp };
}

export async function logout(s, req) {
  const tok = req.headers.get("x-team-session") || "";
  if (/^[a-f0-9]{64}$/.test(tok)) await s.del(`tsess/${sha(tok)}`);
}

// Returns { pid, person } for a valid team session, otherwise null.
export async function teamSession(s, req, roster) {
  const tok = req.headers.get("x-team-session") || "";
  if (!/^[a-f0-9]{64}$/.test(tok)) return null;
  const k = `tsess/${sha(tok)}`, sess = await s.get(k);
  if (!sess) return null;
  if (!sess.exp || Date.parse(sess.exp) <= Date.now()) { await s.del(k); return null; }
  const [rec, f] = await Promise.all([s.get(`pin/${sess.pid}`), s.get(`pinfail/${sess.pid}`)]);
  if (!rec || rec.v !== sess.v || f?.hard) { await s.del(k); return null; }
  roster = roster || (await loadRoster(s));
  const person = member(roster, sess.pid);
  if (!person) { await s.del(k); return null; }
  return { pid: sess.pid, person };
}

export const needLogin = (json) => json({ error: "Log in with your mobile number and passcode.", teamLogin: true }, 401);

// A new starter's personal welcome link (/w/<token>) may confirm their own shift
// and read their own first-day info, before they have a passcode.
export async function welcomePerson(s, w) {
  if (typeof w !== "string" || !/^[a-f0-9]{24,64}$/.test(w)) return "";
  const r = await s.get(`wtok/${w}`), c = r && (await s.get(`cand/${r.id}`));
  return c && c.stage !== "no" && c.teamId ? c.teamId : "";
}
