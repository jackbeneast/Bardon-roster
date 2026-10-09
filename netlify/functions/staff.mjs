// Employee profiles and payslip records (Team & pay).
//   GET                      (admin)  { profiles, slips, team, pay }
//   GET ?t=<pay link token>  (public) one employee's own payslips
//   POST (admin) { action: "profile", id, profile }
//                { action: "slips", slips: [...] }        save a pay run
//                { action: "mark", id, field, value }      superPaid | taxPaid | sentAt
//                { action: "delete", id }                  remove one payslip
//                { action: "newlink", id }                 replace an employee's pay link
// Profiles and payslips live outside the roster, so they're never sent to the team
// roster page and survive someone being taken off the roster (records are kept 7 years).
import { randomBytes } from "node:crypto";
import { store, json, checkAdmin, loadRoster } from "../../lib/core.mjs";
import { SEED_PROFILES, SEED_SLIPS } from "../../lib/payseed.mjs";

const r2 = (v) => Math.round(v * 100) / 100;
const str = (v, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const day = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const okId = (v) => /^[\w-]{1,40}$/.test(v || "");
const tok = () => randomBytes(18).toString("hex");
const DOCS = ["tfn", "superChoice", "bank", "id", "fwis", "ceis", "contract", "induction"];
export const EMPLOYER = { name: "Jack East T/A Bardon Clean", abn: "46 426 437 394", addr: "49 Empress Tce, Bardon QLD", phone: "0406 216 212" };

function cleanProfile(p, prev = {}) {
  p = p && typeof p === "object" ? p : {};
  const o = {
    preferred: str(p.preferred, 40), email: str(p.email, 120), dob: day(p.dob), address: str(p.address, 200),
    startDate: day(p.startDate), endDate: day(p.endDate), status: p.status === "left" ? "left" : "active",
    type: ["casual", "part-time", "full-time"].includes(p.type) ? p.type : "casual",
    level: ["1", "2", "3"].includes(String(p.level)) ? String(p.level) : "1",
    tft: ["1", "2", "3"].includes(String(p.tft)) ? String(p.tft) : "2",
    help: !!p.help, superFund: str(p.superFund, 80), superUsi: str(p.superUsi, 40), superNo: str(p.superNo, 40),
    emergName: str(p.emergName, 80), emergPhone: str(p.emergPhone, 30), emergRel: str(p.emergRel, 40),
    notes: str(p.notes, 3000), docs: {},
  };
  for (const k of DOCS) { const v = p.docs && p.docs[k]; o.docs[k] = day(v) || (v === true ? "yes" : v === "yes" ? "yes" : ""); }
  o.token = prev.token || tok();
  o.updatedAt = new Date().toISOString();
  return o;
}

const KINDS = new Set(["wk", "el", "sat", "sun", "ph"]);
// Recompute every total from the lines so a payslip always adds up.
export function cleanSlip(x) {
  if (!x || typeof x !== "object" || !okId(x.pid)) return null;
  const periodStart = day(x.periodStart), periodEnd = day(x.periodEnd), paidOn = day(x.paidOn);
  if (!periodStart || !periodEnd || !paidOn || periodEnd < periodStart) return null;
  const lines = (Array.isArray(x.lines) ? x.lines : []).slice(0, 30).map((l) => {
    const hrs = r2(Number(l.hrs)), rate = r2(Number(l.rate));
    return { label: str(l.label, 60), hrs, rate, amt: r2(hrs * rate), ot: !!l.ot };
  }).filter((l) => l.label && l.hrs > 0 && l.hrs < 200 && l.rate > 0 && l.rate < 1000);
  if (!lines.length) return null;
  const shifts = (Array.isArray(x.shifts) ? x.shifts : []).slice(0, 60).map((s) => ({ date: day(s.date), hrs: r2(Number(s.hrs)), kind: KINDS.has(s.kind) ? s.kind : "wk", ...(s.job ? { job: str(s.job, 120) } : {}) })).filter((s) => s.date && s.hrs > 0);
  const gross = r2(lines.reduce((a, l) => a + l.amt, 0));
  const ordPay = r2(lines.filter((l) => !l.ot).reduce((a, l) => a + l.amt, 0));
  const tax = Math.max(0, Math.min(gross, r2(Number(x.tax) || 0)));
  const hrs = r2(lines.reduce((a, l) => a + l.hrs, 0));
  return {
    id: okId(x.id) ? x.id : "s" + Date.now().toString(36) + randomBytes(3).toString("hex"),
    num: str(x.num, 40), pid: x.pid, name: str(x.name, 80), level: ["1", "2", "3"].includes(String(x.level)) ? String(x.level) : "1",
    periodStart, periodEnd, paidOn, cycle: x.cycle === 2 ? 2 : 1, lines, shifts, hrs, gross, ordPay,
    tax, taxAuto: x.taxAuto != null ? r2(Number(x.taxAuto) || 0) : undefined, net: r2(gross - tax), sup: r2(ordPay * 0.12),
    superFund: str(x.superFund, 80), superNo: str(x.superNo, 40),
    superPaid: day(x.superPaid), taxPaid: day(x.taxPaid), sentAt: str(x.sentAt, 30), sentTo: str(x.sentTo, 120),
    source: x.source === "import" ? "import" : "hub", token: typeof x.token === "string" && x.token.length >= 16 ? x.token.slice(0, 64) : tok(),
    createdAt: str(x.createdAt, 30) || new Date().toISOString(),
  };
}

async function listAll(s, prefix) {
  const keys = await s.list(prefix);
  return (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean);
}

// First time only: bring in last pay run and the details already on those payslips.
async function seedOnce(s) {
  if (await s.get("payroll-seeded")) return;
  for (const [id, p] of Object.entries(SEED_PROFILES)) if (!(await s.get(`staff/${id}`))) await s.set(`staff/${id}`, cleanProfile(p));
  for (const x of SEED_SLIPS) if (!(await s.get(`slip/${x.id}`))) await s.set(`slip/${x.id}`, cleanSlip(x));
  await s.set("payroll-seeded", { at: new Date().toISOString() });
}

function initials(n) { return String(n || "X").trim().split(/\s+/).map((w) => w[0] || "").join("").toUpperCase() || "X"; }

export default async (req) => {
  const s = await store(), u = new URL(req.url);

  // An employee's own pay link: their payslips and nothing else.
  const t = u.searchParams.get("t");
  if (req.method === "GET" && t) {
    if (!/^[a-f0-9]{24,64}$/.test(t)) return json({ error: "This link isn't right." }, 404);
    await seedOnce(s);
    const keys = await s.list("staff/");
    let pid = null;
    for (const k of keys) { const p = await s.get(k); if (p && p.token === t) { pid = k.slice(6); break; } }
    if (!pid) return json({ error: "This link has been replaced. Ask Jack for your new one." }, 404);
    const roster = await loadRoster(s), m = roster.team.find((x) => x.id === pid);
    const slips = (await listAll(s, "slip/")).filter((x) => x.pid === pid).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
      .map(({ token, taxPaid, superPaid, sentTo, source, taxAuto, ...x }) => ({ ...x, superPaid: !!superPaid }));
    return json({ name: (m && m.name) || (slips[0] && slips[0].name) || "", employer: EMPLOYER, slips });
  }

  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  await seedOnce(s);

  if (req.method === "GET") {
    const roster = await loadRoster(s);
    const profiles = {};
    for (const k of await s.list("staff/")) { const p = await s.get(k); if (p) profiles[k.slice(6)] = p; }
    const slips = (await listAll(s, "slip/")).sort((a, b) => (b.periodEnd + b.name).localeCompare(a.periodEnd + a.name));
    return json({ team: roster.team, pay: roster.pay || null, profiles, slips, employer: EMPLOYER });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }

  if (b.action === "profile") {
    if (!okId(b.id)) return json({ error: "Bad id" }, 400);
    const prev = (await s.get(`staff/${b.id}`)) || {};
    const p = cleanProfile(b.profile, prev);
    await s.set(`staff/${b.id}`, p);
    return json({ ok: true, profile: p });
  }
  if (b.action === "newlink") {
    if (!okId(b.id)) return json({ error: "Bad id" }, 400);
    const p = (await s.get(`staff/${b.id}`)) || cleanProfile({});
    p.token = tok(); await s.set(`staff/${b.id}`, p);
    return json({ ok: true, profile: p });
  }
  if (b.action === "slips") {
    const arr = Array.isArray(b.slips) ? b.slips.slice(0, 50) : [];
    const existing = await listAll(s, "slip/"), saved = [];
    for (const raw of arr) {
      const x = cleanSlip(raw);
      if (!x) return json({ error: "A payslip is missing hours, dates or rates." }, 400);
      // Re-running the same person and period replaces their earlier payslip.
      const old = existing.find((e) => e.id === x.id) || existing.find((e) => e.pid === x.pid && e.periodStart === x.periodStart && e.periodEnd === x.periodEnd);
      if (old) { x.id = old.id; x.num = old.num || x.num; x.token = old.token; x.createdAt = old.createdAt; if (!raw.sentAt) x.sentAt = ""; }
      if (!x.num) x.num = `BC-${x.periodEnd.replace(/-/g, "")}-${initials(x.name)}`;
      // Fill in the profile's super details if the payslip didn't carry them.
      const prof = await s.get(`staff/${x.pid}`);
      if (prof) { if (!x.superFund) x.superFund = prof.superFund || ""; if (!x.superNo) x.superNo = prof.superNo || ""; }
      else await s.set(`staff/${x.pid}`, cleanProfile({}));
      await s.set(`slip/${x.id}`, x); saved.push(x);
    }
    return json({ ok: true, slips: saved });
  }
  if (b.action === "mark") {
    const x = okId(b.id) && (await s.get(`slip/${b.id}`));
    if (!x) return json({ error: "Payslip not found" }, 404);
    if (b.field === "superPaid" || b.field === "taxPaid") x[b.field] = b.value ? day(b.value) || new Date().toISOString().slice(0, 10) : "";
    else if (b.field === "sentAt") { x.sentAt = b.value ? new Date().toISOString() : ""; if (b.to) x.sentTo = str(b.to, 120); }
    else return json({ error: "Bad field" }, 400);
    await s.set(`slip/${x.id}`, x);
    return json({ ok: true, slip: x });
  }
  if (b.action === "delete") {
    if (!okId(b.id) || !(await s.get(`slip/${b.id}`))) return json({ error: "Payslip not found" }, 404);
    await s.del(`slip/${b.id}`);
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/staff" };
