// New starter form, built into the hub. Every submission fills the person's profile.
//   GET  ?t=<start token>        (public) prefill for a personal link
//   POST { t?, form, idPhoto? }  (public) submit the form
//   GET  ?photo=<team id>        (admin)  their ID photo
//   POST { action: "reveal", id, password }  (admin) TFN, bank and ID numbers
//   POST { action: "forget", id }            (admin) delete TFN, bank, ID numbers and photo
//   POST { action: "link", id }              (admin) make (or return) their personal form link
// TFN, bank, passport and ID photo are kept apart from the profile and never sent
// to a page unless Jack re-enters his password to see them.
import { randomBytes } from "node:crypto";
import { store, json, checkAdmin, loadRoster } from "../../lib/core.mjs";
import { notify } from "../../lib/notify.mjs";

const str = (v, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const day = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const digits = (v) => String(v || "").replace(/\D/g, "");
const okId = (v) => /^[\w-]{1,40}$/.test(v || "");
const tok = () => randomBytes(18).toString("hex");
const today = () => new Date(Date.now() + 10 * 36e5).toISOString().slice(0, 10); // Brisbane
const STATES = ["QLD", "NSW", "VIC", "ACT", "SA", "WA", "TAS", "NT"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ATO TFN check digits (8 or 9 digit TFNs).
export function tfnOk(v) {
  const d = digits(v);
  const w = d.length === 9 ? [1, 4, 3, 7, 5, 8, 6, 9, 10] : d.length === 8 ? [10, 7, 8, 4, 6, 3, 5, 1] : null;
  if (!w) return false;
  return [...d].reduce((a, c, i) => a + +c * w[i], 0) % 11 === 0;
}
const mob = (v) => { let d = digits(v); if (d.startsWith("61") && d.length === 11) d = "0" + d.slice(2); return d; };

function check(f) {
  const need = { first: "first name", last: "last name", dob: "date of birth", mobile: "mobile", email: "email", street: "home address", suburb: "suburb", emergName: "emergency contact name", emergRel: "emergency contact relationship", emergPhone: "emergency contact phone", sign: "your name to sign" };
  for (const [k, l] of Object.entries(need)) if (!str(f[k])) return `Add your ${l}.`;
  if (!day(f.dob)) return "Add your date of birth.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(f.email))) return "That email doesn't look right.";
  if (mob(f.mobile).length !== 10) return "Check your mobile number.";
  if (!/^\d{4}$/.test(str(f.postcode))) return "Postcode should be 4 digits.";
  if (!STATES.includes(f.state)) return "Pick your state.";
  if (!["yes", "applied", "under18"].includes(f.tfnStatus)) return "Tell us about your TFN.";
  if (f.tfnStatus === "yes" && !tfnOk(f.tfn)) return "That TFN doesn't check out. Check the numbers.";
  if (!["resident", "foreign", "whm"].includes(f.residency)) return "Pick your tax residency.";
  if (!["yes", "no"].includes(f.tft) || !["yes", "no"].includes(f.help)) return "Answer the tax-free threshold and study loan questions.";
  if (f.superChoice === "own" && (!str(f.superFund) || !str(f.superNo))) return "Add your super fund name and member number, or choose to have us find it.";
  if (!["own", "stapled"].includes(f.superChoice)) return "Tell us where to pay your super.";
  if (!str(f.bankName) || digits(f.bsb).length !== 6 || !/^\d{5,10}$/.test(digits(f.acct))) return "Check your bank account name, BSB (6 digits) and account number.";
  if (!["citizen", "pr", "nz", "visa"].includes(f.work)) return "Pick your right-to-work status.";
  if (f.work === "visa" && !day(f.visaExpiry)) return "Add your visa expiry date.";
  if (!(Array.isArray(f.days) && f.days.some((d) => DAYS.includes(d)))) return "Pick at least one day you can work.";
  if (!(f.decFw && f.decConf && f.decTrue)) return "Tick the three boxes before sending.";
  return "";
}

async function findByStart(s, t) {
  for (const k of await s.list("staff/")) { const p = await s.get(k); if (p && p.startToken === t) return [k.slice(6), p]; }
  return [null, null];
}

export default async (req) => {
  const s = await store(), u = new URL(req.url);

  if (req.method === "GET" && u.searchParams.get("photo")) {
    if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
    const id = u.searchParams.get("photo");
    const buf = okId(id) && (await s.getBin(`staffid/${id}`));
    if (!buf) return new Response("Not found", { status: 404 });
    return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
  }

  if (req.method === "GET") {
    const t = u.searchParams.get("t") || "";
    if (!t) return json({ ok: true });
    if (!/^[a-f0-9]{24,64}$/.test(t)) return json({ error: "This link isn't right. Ask Jack to send it again." }, 404);
    const [pid, p] = await findByStart(s, t);
    if (!pid) return json({ error: "This link has expired. Ask Jack for a new one." }, 404);
    const r = await loadRoster(s), m = r.team.find((x) => x.id === pid) || {};
    const [first, ...rest] = String(m.name || "").split(" ");
    return json({ first: p.firstName || first || "", last: p.lastName || rest.join(" "), mobile: m.phone || "", email: p.email || "", done: !!p.onboardedAt });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "That didn't come through. Try again." }, 400); }

  // ---- admin actions ----
  if (b.action) {
    if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
    if (!okId(b.id)) return json({ error: "Bad id" }, 400);
    if (b.action === "link") {
      const p = (await s.get(`staff/${b.id}`)) || { docs: {} };
      if (!p.startToken) { p.startToken = tok(); await s.set(`staff/${b.id}`, p); }
      return json({ ok: true, startToken: p.startToken });
    }
    if (b.action === "reveal") {
      const pw = String(b.password || "");
      const fake = new Request("http://x", { headers: { "x-admin-key": pw } });
      if (!(await checkAdmin(s, fake))) return json({ error: "That password isn't right." }, 401);
      return json({ ok: true, secure: (await s.get(`staffsecure/${b.id}`)) || null });
    }
    if (b.action === "forget") {
      await s.del(`staffsecure/${b.id}`); await s.del(`staffid/${b.id}`);
      const p = await s.get(`staff/${b.id}`);
      if (p) { p.secure = { forgotten: today() }; await s.set(`staff/${b.id}`, p); }
      return json({ ok: true, profile: p });
    }
    return json({ error: "Unknown action" }, 400);
  }

  // ---- the form ----
  const f = b.form && typeof b.form === "object" ? b.form : null;
  if (!f) return json({ error: "That didn't come through. Try again." }, 400);
  if (str(f.website)) return json({ ok: true }); // honeypot
  const bad = check(f);
  if (bad) return json({ error: bad }, 400);
  let photo = null;
  if (typeof b.idPhoto === "string" && b.idPhoto.startsWith("data:image/jpeg;base64,")) {
    photo = Buffer.from(b.idPhoto.slice(23), "base64");
    if (photo.length < 1000 || photo.length > 900000 || photo[0] !== 0xff || photo[1] !== 0xd8) photo = null;
  }

  const roster = await loadRoster(s);
  const first = str(f.first, 40), last = str(f.last, 60), full = `${first} ${last}`;
  let pid = null, prev = null;
  const t = str(b.t, 64);
  if (t) { [pid, prev] = await findByStart(s, t); if (!pid) return json({ error: "This link has expired. Ask Jack for a new one." }, 404); }
  if (!pid) { // general link: match them by mobile, otherwise add them to the team
    const m = roster.team.find((x) => !x.owner && x.phone && mob(x.phone) === mob(f.mobile));
    if (m) pid = m.id;
  }
  const now = new Date().toISOString();
  if (!pid) {
    pid = "t" + Date.now().toString(36) + randomBytes(3).toString("hex");
    roster.team.push({ id: pid, name: full, phone: mob(f.mobile), newStarter: true, addedAt: now });
  } else {
    const m = roster.team.find((x) => x.id === pid);
    if (m) { if (!m.phone) m.phone = mob(f.mobile); }
    else roster.team.push({ id: pid, name: full, phone: mob(f.mobile), newStarter: true, addedAt: now });
  }
  await s.set("roster", { ...roster, savedAt: roster.savedAt || now });

  prev = prev || (await s.get(`staff/${pid}`)) || { docs: {} };
  const d = today(), docs = { ...(prev.docs || {}) };
  if (f.tfnStatus === "yes" || f.tfnStatus === "applied" || f.tfnStatus === "under18") docs.tfn = docs.tfn || d;
  docs.superChoice = docs.superChoice || d;
  docs.bank = docs.bank || d;
  if (photo) docs.id = docs.id || d;
  if (f.decFw) { docs.fwis = docs.fwis || d; docs.ceis = docs.ceis || d; }
  const tft = f.residency === "foreign" ? "3" : f.residency === "whm" ? "4" : f.tft === "yes" ? "2" : "1";
  const p = {
    ...prev,
    firstName: first, lastName: last, middle: str(f.middle, 60), preferred: str(f.preferred, 40) || prev.preferred || "", prevName: str(f.prevName, 60),
    email: str(f.email, 120), dob: day(f.dob), address: `${str(f.street, 120)}, ${str(f.suburb, 60)} ${f.state} ${str(f.postcode, 4)}`,
    emergName: str(f.emergName, 80), emergRel: str(f.emergRel, 40), emergPhone: str(f.emergPhone, 30),
    tft, help: f.help === "yes", residency: f.residency, tfnStatus: f.tfnStatus,
    superChoice: f.superChoice, superFund: f.superChoice === "own" ? str(f.superFund, 80) : "", superUsi: str(f.superUsi, 40), superNo: f.superChoice === "own" ? str(f.superNo, 40) : "", superAbn: str(f.superAbn, 20),
    work: f.work, visaExpiry: f.work === "visa" ? day(f.visaExpiry) : "",
    car: f.car === "yes", licenceExpiry: day(f.licenceExpiry), licenceState: str(f.licenceState, 10), carInsurance: str(f.carInsurance, 20), policeCheck: f.policeCheck === "yes",
    days: f.days.filter((x) => DAYS.includes(x)), availNotes: str(f.availNotes, 600), shirt: str(f.shirt, 4), earliestStart: day(f.earliestStart),
    allergies: str(f.allergies, 600), safety: str(f.safety, 600),
    signed: { name: str(f.sign, 80), date: day(f.signDate) || d, at: now, keys: !!f.decConf },
    type: prev.type || "casual", level: prev.level || "1", status: "active",
    docs, onboardedAt: now, updatedAt: now,
    token: prev.token || tok(), startToken: prev.startToken || tok(),
    secure: { tfn: f.tfnStatus === "yes" ? "•••" + digits(f.tfn).slice(-3) : f.tfnStatus === "applied" ? "Applied for" : "Under 18, none yet", bank: `BSB •••${digits(f.bsb).slice(-3)} · acct •••${digits(f.acct).slice(-3)}`, id: !!photo, passport: !!str(f.passport) },
  };
  if (!p.startDate && p.earliestStart) p.startDate = p.earliestStart;
  await s.set(`staff/${pid}`, p);
  await s.set(`staffsecure/${pid}`, {
    tfn: f.tfnStatus === "yes" ? digits(f.tfn) : "", tfnStatus: f.tfnStatus,
    bankName: str(f.bankName, 80), bsb: digits(f.bsb), acct: digits(f.acct),
    passport: str(f.passport, 20), passportCountry: str(f.passportCountry, 40), visaConditions: str(f.visaConditions, 300),
    at: now,
  });
  if (photo) await s.setBin(`staffid/${pid}`, photo);
  await notify(s, { type: "onboard", title: `${full} sent their new starter form`, body: "Their profile is filled in. Check it and add them to Xero payroll.", tags: "clipboard", priority: 4, url: `/team/#/p/${pid}` });
  return json({ ok: true, first });
};

export const config = { path: "/api/onboard" };
