// Quotes and invoices: shared data logic for the docs and pay functions.
import { randomBytes } from "node:crypto";
import { loadRoster } from "./core.mjs";

export const tok = () => randomBytes(18).toString("hex");
export const id = (p) => p + Date.now().toString(36) + randomBytes(3).toString("hex");
const r2 = (v) => Math.round(v * 100) / 100;
export const today = () => new Date(Date.now() + 10 * 3600e3).toISOString().slice(0, 10); // Brisbane date
export const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// Scope copied from Quote #171, so it's ready to reuse on day one.
const PRESALE_SCOPE = `Bathrooms & Laundry
- Shower screens and tiles scrubbed
- Walls spot-cleaned
- Bath scrubbed
- Toilet cleaned inside and out
- Vanities and mirrors polished
- Taps and fixtures descaled
- Exhaust fan covers dusted
- Laundry tub and surfaces wiped

Kitchen
- Benches and splashback scrubbed
- Drawer and cupboard exteriors cleaned and walls spot-cleaned
- Sinks cleaned inside and out
- Stainless steel polished
- Oven cleaned externally and internally
- Taps and fixtures descaled
- Exhaust fan covers dusted

Living Areas & Bedrooms
- Walls spot-cleaned
- Skirting boards wiped
- Ceiling fans and light fittings cleaned
- Wardrobe exteriors wiped
- Light switches and power points cleaned
- Door frames and handles wiped

Floors
- All floors vacuumed and mopped (hard floors and carpet edges)`;

const POLICIES = `Bookings & Payments
- A 50% deposit is required to secure all bookings. Appointments are not confirmed until the deposit has been received.
- The remaining balance is due upon completion of the service on the day, unless otherwise agreed in writing.
- Payments can be made via bank transfer, card, or other approved methods.

Cancellations & Rescheduling
- We require a minimum of 24 hours' notice for any cancellations or rescheduling.
- Cancellations made within 24 hours of the booking may result in forfeiture of the deposit.
- We understand things come up and will always aim to be reasonable where possible.

Access to Property
- Clients must ensure safe and timely access to the property at the scheduled time.
- If access is not provided, a call-out fee or partial service charge may apply.

Scope of Work
- Our quotes are based on the condition of the property as described or shown at the time of booking.
- If the condition is significantly different (e.g. heavier buildup, additional areas), we will discuss any required adjustments before proceeding.
- Additional services requested on the day may incur extra charges.

Satisfaction Guarantee
- If your agent raises any cleaning concerns within 5 days, we'll return to rectify the specific areas at no additional cost.
- This guarantee applies to the original scope of work only and does not cover new issues or areas not included in the initial booking.

Results Disclaimer (Especially for Deep/Bond Cleans)
- While we aim to achieve the best possible outcome, some stains, wear, or damage (e.g. permanent grout staining, aged surfaces, carpet wear) may not be fully reversible.
- We do not guarantee a "brand new" result where materials are worn or damaged beyond restoration.

Health & Safety
- We reserve the right to refuse or stop work if the environment is deemed unsafe (e.g. hazardous waste, aggressive animals, unsafe structures).
- Clients must disclose any risks or hazards prior to the service.

Equipment & Utilities
- Clients are required to provide access to electricity and running water.`;

export const DEFAULTS = {
  biz: { name: "Bardon Clean", legal: "Jack East T/A Bardon Clean", abn: "46 426 437 394", address: "49 Empress Terrace, Bardon QLD 4065", phone: "0406 216 212", email: "hello@bardonclean.au", web: "www.bardonclean.au" },
  bank: { name: "Bardon Clean", bsb: "067-873", acct: "18976363" },
  gst: true, nextQuote: 172, nextInvoice: 259, depositPct: 50, quoteValidDays: 30, invoiceDueDays: 0,
  terms: POLICIES,
  prices: {},
  library: [
    { id: "lpresale", title: "Pre-sale clean", desc: PRESALE_SCOPE, price: 0, service: "Pre-sale clean" },
    { id: "ldeposit", title: "50% deposit to secure booking", desc: depositDesc(50, "clean"), price: 0 },
    { id: "lnowin", title: "Note: windows", desc: "No window or glass cleaning is included in this scope / quote.", price: 0 },
  ],
};

export async function loadSettings(s) {
  const v = (await s.get("docset")) || {};
  return { ...DEFAULTS, ...v, biz: { ...DEFAULTS.biz, ...(v.biz || {}) }, bank: Object.fromEntries(Object.entries(DEFAULTS.bank).map(([k, d]) => [k, (v.bank && v.bank[k]) || d])) };
}

const str = (v, n = 200) => (typeof v === "string" ? v.slice(0, n) : "");
const num = (v, lo = -1e7, hi = 1e7) => { const x = Number(v); return isFinite(x) ? Math.min(hi, Math.max(lo, r2(x))) : 0; };
const date = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export function cleanSettings(b) {
  const o = {};
  o.biz = {}; for (const k of Object.keys(DEFAULTS.biz)) o.biz[k] = str(b.biz?.[k], 160);
  o.bank = { name: str(b.bank?.name, 80), bsb: str(b.bank?.bsb, 10), acct: str(b.bank?.acct, 20) };
  o.gst = b.gst !== false;
  o.nextQuote = Math.max(1, Math.floor(num(b.nextQuote, 1, 1e7)) || 1);
  o.nextInvoice = Math.max(1, Math.floor(num(b.nextInvoice, 1, 1e7)) || 1);
  o.depositPct = num(b.depositPct, 0, 100);
  o.quoteValidDays = Math.floor(num(b.quoteValidDays, 0, 365));
  o.invoiceDueDays = Math.floor(num(b.invoiceDueDays, 0, 365));
  o.terms = str(b.terms, 12000);
  o.prices = {};
  if (b.prices && typeof b.prices === "object") for (const [k, p] of Object.entries(b.prices).slice(0, 20)) o.prices[str(k, 40)] = { base: num(p?.base, 0), bed: num(p?.bed, 0), bath: num(p?.bath, 0), hrs: str(p?.hrs, 120) };
  o.library = (Array.isArray(b.library) ? b.library : []).slice(0, 300).map((l) => ({ id: str(l.id, 40) || id("l"), title: str(l.title, 120), desc: str(l.desc, 8000), price: num(l.price, 0), service: str(l.service, 40) })).filter((l) => l.title);
  return o;
}

export function cleanDoc(b, prev) {
  const kind = b.kind === "invoice" ? "invoice" : "quote";
  const c = b.client || {};
  const o = {
    ...(prev || {}),
    kind,
    client: { name: str(c.name, 120), contact: str(c.contact, 120), email: str(c.email, 160), phone: str(c.phone, 30), address: str(c.address, 300) },
    site: str(b.site, 200), suburb: str(b.suburb, 80), service: str(b.service, 40),
    beds: str(b.beds, 3), baths: str(b.baths, 3),
    issued: date(b.issued) || prev?.issued || today(),
    validUntil: date(b.validUntil), dueDate: date(b.dueDate), serviceDate: date(b.serviceDate),
    items: (Array.isArray(b.items) ? b.items : []).slice(0, 60).map((i) => ({ title: str(i.title, 160), desc: str(i.desc, 8000), qty: num(i.qty, 0, 10000) || 1, price: num(i.price) })).filter((i) => i.title || i.desc),
    gst: b.gst !== false, depositPct: num(b.depositPct, 0, 100),
    notes: str(b.notes, 3000), showTerms: b.showTerms !== false,
  };
  return o;
}

// Deposit invoices for pre-sale, deep and bond cleans: due today, booking tentative until paid.
export const DEPOSIT_SERVICES = ["Pre-sale clean", "Deep clean", "Bond clean"];
export function isDepositInv(d) {
  return d.kind === "invoice" && DEPOSIT_SERVICES.includes(d.service) &&
    (d.isDeposit || (d.items || []).some((i) => /deposit/i.test(i.title || "") && !/^less deposit/i.test(i.title || "")));
}
export function depositDesc(pct, service) {
  return `Initial ${pct}% deposit required to secure your booking for the scheduled ${String(service || "clean").toLowerCase()}. The remaining balance is payable on completion of the clean. Your booking remains tentative until this deposit has been received.`;
}

export function totals(d) {
  const sub = r2((d.items || []).reduce((a, i) => a + (i.qty || 1) * (i.price || 0), 0));
  const gst = d.gst ? r2(sub * 0.1) : 0;
  const total = r2(sub + gst);
  const paid = r2((d.payments || []).reduce((a, p) => a + p.amt, 0));
  const deposit = d.kind === "quote" && d.depositPct ? r2(total * d.depositPct / 100) : 0;
  return { sub, gst, total, paid, due: r2(Math.max(0, total - paid)), deposit };
}

export function statusOf(d) {
  const t = totals(d);
  if (d.kind === "invoice") {
    if (t.total > 0 && t.paid >= t.total - 0.005) return "paid";
    if (d.status === "draft") return "draft";
    if (t.paid > 0) return d.dueDate && d.dueDate < today() ? "overdue" : "part-paid";
    if (d.dueDate && d.dueDate < today()) return "overdue";
    return d.viewedAt ? "viewed" : "sent";
  }
  if (d.status === "accepted" || d.status === "declined" || d.status === "draft") return d.status;
  if (d.validUntil && d.validUntil < today()) return "expired";
  return d.viewedAt ? "viewed" : "sent";
}

export async function loadDocs(s) {
  const keys = await s.list("doc/");
  const docs = (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean);
  return docs.map((d) => ({ ...d, totals: totals(d), state: statusOf(d), isDeposit: isDepositInv(d) })).sort((a, b) => (b.created || "").localeCompare(a.created || ""));
}

export async function findByToken(s, t) {
  if (typeof t !== "string" || t.length < 16) return null;
  const docId = await s.get(`doctok/${t}`);
  return docId ? s.get(`doc/${docId}`) : null;
}

export async function saveDoc(s, d) {
  await s.set(`doc/${d.id}`, d);
  if (d.token) await s.set(`doctok/${d.token}`, d.id);
}

export async function newDoc(s, set, fields) {
  const kind = fields.kind === "invoice" ? "invoice" : "quote";
  const d = { id: id("d"), token: tok(), created: new Date().toISOString(), status: "draft", payments: [], ...fields, kind };
  d.num = kind === "quote" ? set.nextQuote++ : set.nextInvoice++;
  await s.set("docset", set);
  return d;
}

export async function recordPayment(s, d, p) {
  d.payments ||= [];
  if (p.ref && d.payments.some((x) => x.ref === p.ref)) return false;
  d.payments.push({ id: id("p"), amt: r2(p.amt), date: p.date || today(), method: str(p.method, 40), ref: str(p.ref, 120) });
  d.flag = "paid"; d.flagAt = new Date().toISOString();
  if (d.status === "draft") d.status = "sent";
  await saveDoc(s, d);
  return true;
}

// Quote accepted with a service date: put the job straight onto the roster.
export async function addJobFromQuote(s, q) {
  if (!q.serviceDate || q.jobId) return null;
  const roster = await loadRoster(s);
  const job = {
    id: id("j"), date: q.serviceDate, start: "08:00", end: "16:00",
    client: q.client.name || "Client", suburb: q.suburb || "", address: q.site || q.client.address || "",
    service: ["Bond clean", "Pre-sale clean", "Deep clean", "Regular clean", "Commercial"].includes(q.service) ? q.service : "Other",
    staff: [], share: tok(),
    notes: `From quote #${q.num}${q.beds ? `, ${q.beds} bed` : ""}${q.baths ? ` ${q.baths} bath` : ""}.${q.client.phone ? ` Client: ${q.client.phone}.` : ""}${q.notes ? " " + q.notes : ""}`.slice(0, 2000),
  };
  roster.jobs.push(job);
  await s.set("roster", { ...roster, savedAt: new Date().toISOString() });
  return job.id;
}

// What a client may see. No internal flags, no other docs' secrets.
export function publicView(d, set) {
  const t = totals(d);
  return {
    kind: d.kind, num: d.num, issued: d.issued, validUntil: d.validUntil, dueDate: d.dueDate, serviceDate: d.serviceDate,
    client: d.client, site: d.site, suburb: d.suburb, service: d.service, items: d.items, gst: d.gst, depositPct: d.depositPct,
    notes: d.notes, terms: d.showTerms ? set.terms : "", totals: t, state: statusOf(d),
    acceptedAt: d.acceptedAt || "", acceptedName: d.acceptedName || "", isDeposit: isDepositInv(d), quoteNum: d.quoteNum || null,
    payments: (d.payments || []).map(({ amt, date, method }) => ({ amt, date, method })),
    biz: set.biz, bank: set.bank, gstReg: set.gst,
  };
}
