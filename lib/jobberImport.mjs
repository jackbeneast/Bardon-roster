// One-off import of Jobber's CSV exports (Invoices, Quotes, Transaction List, Recurring Jobs).
// - Open items (unpaid invoices, quotes still within 30 days) become normal hub docs Jack can act on.
// - Everything else (paid invoices, accepted / expired / archived quotes) goes into one read-only
//   archive blob, so the history is in the hub without hundreds of separate records to load.
// - Jobber's numbers are kept. The hub's next numbers move past Jobber's so they never clash again.
// - Active recurring clients get a per-visit price where the hub has none yet.
// Running it again updates what was imported before rather than duplicating it.
import { tok } from "./docs.mjs";
import { serviceOf, streetKey } from "./jobber.mjs";

const r2 = (v) => Math.round(v * 100) / 100;
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
const HONOR = /^(mr|mrs|ms|miss|dr)\.?\s+/i;
const REC = /weekly|fortnightly|monthly|ongoing|regular|recurring|open home/i;

export function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  const s = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
// Rows as objects, starting at the first line that looks like the header.
function table(text, firstCol) {
  const rows = parseCsv(text);
  const h = rows.findIndex((r) => r[0] === firstCol);
  if (h < 0) return [];
  const head = rows[h].map((x) => x.trim());
  return rows.slice(h + 1).filter((r) => r.length > 2 && r[0] !== "").map((r) => Object.fromEntries(head.map((k, i) => [k, (r[i] ?? "").trim()])));
}
export function detect(text) {
  const head = parseCsv(String(text).slice(0, 4000)).find((r) => r.length > 5) || [];
  const has = (k) => head.includes(k);
  if (head[0] === "Invoice #" && has("Balance ($)")) return "invoices";
  if (head[0] === "Quote #" && has("Approved date")) return "quotes";
  if (head[0] === "Client name" && has("Type") && has("Invoice #")) return "transactions";
  if (head[0] === "Job #" && has("Visit frequency")) return "recurring";
  if (head[0] === "Job #" && has("Visit title")) return "visits";
  if (head[0] === "Job #" && has("Scheduled start date")) return "oneoff";
  return "";
}

const blank = (v) => !v || v === "-";
const money = (v) => { const x = Number(String(v || "").replace(/[$,\s]/g, "")); return isFinite(x) ? x : 0; };
export function jdate(v) {
  const m = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(String(v || "").trim());
  return m && MON[m[1]] ? `${m[3]}-${pad(MON[m[1]])}-${pad(+m[2])}` : "";
}
const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const at = (d) => (d ? d + "T00:00:00.000Z" : "");
export const normName = (s) => String(s || "").toLowerCase().replace(HONOR, "").replace(/[^a-z0-9& ]/g, "").replace(/\s+/g, " ").trim();
const nice = (s) => String(s || "").replace(/\s+/g, " ").trim();

// "Pre-sale Clean | 3 Bed (1, $2090.00), Carpet Cleaning (per area) (4, $280.00)": $ is the line total.
export function parseItems(s) {
  const out = []; const re = /(.+?) \((\d+(?:\.\d+)?), \$(-?[\d.]+)\)(?:, |$)/g; let m;
  while ((m = re.exec(String(s || "")))) { const qty = +m[2] || 1, total = +m[3]; out.push({ title: nice(m[1]).slice(0, 160), desc: "", qty, price: total / qty }); }
  const paid = out.filter((i) => Math.abs(i.price) > 0.001);
  return paid.length ? paid : out.slice(0, 1);
}

function place(r) {
  const street = !blank(r["Service street"]) ? r["Service street"] : !blank(r["Billing street"]) ? r["Billing street"] : "";
  const suburb = !blank(r["Service street"]) ? r["Service city"] : r["Billing city"] || "";
  const bill = [r["Billing street"], r["Billing city"], r["Billing ZIP"]].filter((x) => !blank(x)).join(", ");
  return { site: nice(street).slice(0, 200), suburb: blank(suburb) ? "" : nice(suburb).slice(0, 80), bill };
}
function client(r, bill) {
  return { name: nice(r["Client name"]).slice(0, 120), contact: "", email: (r["Client email"] || r["Sent to"] || "").slice(0, 160), phone: (r["Client phone"] || "").slice(0, 30), address: bill.slice(0, 300) };
}
const tot = (items, gst) => { const sub = r2(items.reduce((a, i) => a + i.qty * i.price, 0)); return r2(sub + (gst ? r2(sub * 0.1) : 0)); };

// Make the hub's total match Jobber's to the cent (discounts, rounding).
function settle(items, gst, discount, want, note) {
  if (discount > 0.001) items.push({ title: "Discount", desc: "", qty: 1, price: -discount });
  const diff = r2(want - tot(items, gst));
  if (Math.abs(diff) >= 0.01) {
    const adj = gst ? diff / 1.1 : diff;
    items.push({ title: Math.abs(diff) < 1 ? "Rounding" : "Adjustment (as invoiced in Jobber)", desc: "", qty: 1, price: adj });
    if (Math.abs(diff) >= 1) note(diff);
  }
  return items;
}

export function planImport(files, existing, set, books) {
  const got = {}; const report = { files: [], skipped: [], warnings: [], clashes: [], dupes: [] };
  for (const f of files) {
    const kind = detect(f.text);
    report.files.push({ name: String(f.name || "").slice(0, 120), kind: kind || "unknown" });
    if (kind) got[kind] = f.text;
  }
  const today = new Date(Date.now() + 10 * 3600e3).toISOString().slice(0, 10);
  const mine = existing.filter((d) => d.src !== "jobber");

  // ---- Payments by invoice number ----
  const pays = {}, loose = [];
  if (got.transactions) for (const t of table(got.transactions, "Client name")) {
    if (!/^(Payment|Deposit)$/.test(t.Type)) continue;
    const amt = -money(t["Total $"]); if (!(amt > 0)) continue;
    const p = { amt: r2(amt), date: jdate(t.Date), method: t.Method || "Bank transfer" };
    if (blank(t["Invoice #"])) loose.push(`${t["Client name"]} ${p.date} $${p.amt.toFixed(2)}`); else (pays[t["Invoice #"]] ||= []).push(p);
  }
  if (loose.length) report.warnings.push(`${loose.length} Jobber payment${loose.length === 1 ? " wasn't" : "s weren't"} attached to an invoice, so ${loose.length === 1 ? "it's" : "they're"} not included: ${loose.join("; ")}.`);

  const live = [], archive = [];
  const dupOf = (kind, name, total) => mine.find((d) => d.kind === kind && normName(d.client?.name) === normName(name) && Math.abs((d.totals?.total ?? 0) - total) < 0.01);

  // ---- Invoices ----
  let maxInv = 0, drafts = 0;
  if (got.invoices) for (const r of table(got.invoices, "Invoice #")) {
    const num = parseInt(r["Invoice #"], 10); if (!num) continue;
    maxInv = Math.max(maxInv, num);
    if (r.Status === "Draft") { drafts++; continue; }
    const { site, suburb, bill } = place(r);
    const gst = money(r["Tax amount ($)"]) > 0;
    let total = r2(money(r["Total ($)"])), balance = r2(money(r["Balance ($)"]));
    const items = settle(parseItems(r["Line items"]), gst, money(r["Discount ($)"]), total, (d) => report.warnings.push(`Invoice #${num}: Jobber's total differs from its line items by $${d.toFixed(2)}, added as an adjustment line.`));
    // Marked paid in Jobber with a balance left: the rest was paid on a separate deposit invoice.
    if (r.Status === "Paid" && balance > 0.005) {
      items.push({ title: "Less deposit paid on an earlier invoice", desc: "", qty: 1, price: gst ? -balance / 1.1 : -balance });
      total = r2(total - balance); balance = 0;
    }
    const issued = jdate(r["Issued date"]) || jdate(r["Created date"]) || today;
    // Payments: Jobber's transaction list when it adds up, otherwise one payment for what was paid.
    const paidAmt = r2(total - balance);
    let pl = (pays[num] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (Math.abs(r2(pl.reduce((a, p) => a + p.amt, 0)) - paidAmt) >= 0.01) pl = paidAmt > 0 ? [{ amt: paidAmt, date: jdate(r["Marked paid date"]) || (pl.at(-1)?.date) || issued, method: "Bank transfer" }] : [];
    const d = {
      id: `jbi${num}`, kind: "invoice", num, src: "jobber", created: at(jdate(r["Created date"]) || issued), status: "sent", sentAt: at(issued),
      issued, dueDate: jdate(r["Due date"]) || issued, validUntil: "", serviceDate: "",
      client: client(r, bill), site, suburb, service: serviceOf(r.Subject || r["Line items"], REC.test(r.Subject || "")), beds: "", baths: "",
      items, gst, depositPct: 0, notes: "", showTerms: false, jobId: "", jobberTitle: nice(r.Subject).slice(0, 200),
      payments: pl.map((p, i) => ({ id: `pj${num}-${i}`, amt: p.amt, date: p.date, method: p.method.slice(0, 40), ref: `jobber:${num}:${i}` })),
      ...(blank(r["Viewed in client hub"]) ? {} : { viewedAt: at(jdate(r["Viewed in client hub"])) }),
    };
    const dup = dupOf("invoice", d.client.name, total);
    if (dup) { report.dupes.push(`Invoice #${num} (${d.client.name}, $${total.toFixed(2)}) looks like hub invoice #${dup.num}, so it was left out.`); continue; }
    (balance > 0.005 ? live : archive).push(d);
  }
  if (drafts) report.skipped.push(`${drafts} draft invoice${drafts === 1 ? "" : "s"} that were never sent`);

  // ---- Quotes ----
  let maxQ = 0, qDrafts = 0;
  if (got.quotes) for (const r of table(got.quotes, "Quote #")) {
    const num = parseInt(r["Quote #"], 10); if (!num) continue;
    maxQ = Math.max(maxQ, num);
    if (r.Status === "Draft") { qDrafts++; continue; }
    const { site, suburb, bill } = place(r);
    const total = r2(money(r["Total ($)"])), sub = money(r["Subtotal ($)"]), disc = money(r["Discount ($)"]);
    const gst = total > r2(sub - disc) + 0.005;
    const items = settle(parseItems(r["Line items"]), gst, disc, total, (d) => report.warnings.push(`Quote #${num}: Jobber's total differs from its line items by $${d.toFixed(2)}, added as an adjustment line.`));
    const issued = jdate(r["Sent date"]) || jdate(r["Drafted date"]) || today;
    const won = /^(Approved|Converted)$/.test(r.Status), lost = r.Status === "Archived";
    const dep = money(r["Required deposit ($)"]);
    const d = {
      id: `jbq${num}`, kind: "quote", num, src: "jobber", created: at(jdate(r["Drafted date"]) || issued), status: won ? "accepted" : lost ? "declined" : "sent", sentAt: at(issued),
      issued, validUntil: addDays(issued, 30), dueDate: "", serviceDate: "",
      client: client(r, bill), site, suburb, service: serviceOf(r.Title || r["Line items"], REC.test(r.Title || "")), beds: "", baths: "",
      items, gst, depositPct: dep > 0 && total > 0 ? Math.round((dep / total) * 100) : 0, notes: "", showTerms: false, jobId: "", jobberTitle: nice(r.Title).slice(0, 200),
      payments: [],
      ...(won ? { acceptedAt: at(jdate(r["Approved date"]) || jdate(r["Converted date"]) || issued), acceptedName: "Approved in Jobber" } : {}),
      ...(blank(r["Viewed in client hub"]) ? {} : { viewedAt: at(jdate(r["Viewed in client hub"])) }),
    };
    const dup = dupOf("quote", d.client.name, total);
    if (dup) { report.dupes.push(`Quote #${num} (${d.client.name}, $${total.toFixed(2)}) looks like hub quote #${dup.num}, so it was left out.`); continue; }
    (d.status === "sent" && d.validUntil >= today ? live : archive).push(d);
  }
  if (qDrafts) report.skipped.push(`${qDrafts} draft quote${qDrafts === 1 ? "" : "s"} that were never sent`);

  // Live docs need a client link; keep the one from an earlier import.
  const prev = new Map(existing.filter((d) => d.src === "jobber").map((d) => [d.id, d]));
  for (const d of live) { const p = prev.get(d.id); d.token = p?.token || tok(); if (p) for (const k of ["flag", "flagAt", "views", "lastViewed", "jobId", "serviceDate", "notes"]) if (p[k] !== undefined && p[k] !== "") d[k] = p[k];
    // Payments Jack recorded in the hub after the import stay.
    if (p) d.payments = [...d.payments, ...(p.payments || []).filter((x) => !String(x.ref || "").startsWith("jobber:"))]; }
  for (const d of archive) delete d.token;

  // Hub numbers already used that Jobber also used.
  const jn = { invoice: new Set([...live, ...archive].filter((d) => d.kind === "invoice").map((d) => d.num)), quote: new Set([...live, ...archive].filter((d) => d.kind === "quote").map((d) => d.num)) };
  for (const d of mine) if (jn[d.kind]?.has(d.num)) report.clashes.push(`${d.kind === "quote" ? "Quote" : "Invoice"} #${d.num} for ${d.client?.name || "a client"} was made in the hub, and Jobber also has a #${d.num}.`);

  // ---- Recurring prices (per visit, incl. GST) for active Jobber recurring jobs ----
  const recur = {};
  if (got.recurring) for (const r of table(got.recurring, "Job #")) {
    if (!blank(r["Closed date"])) continue;
    const end = jdate(r["Schedule end date"]); if (end && end < today) continue;
    const key = streetKey(r["Service street"] || r["Billing street"]); if (!key) continue;
    const ex = money(r["Subtotal ($)"]) - money(r["Discount ($)"]); if (!(ex > 0)) continue;
    const price = r2(set.gst !== false ? ex * 1.1 : ex);
    if (books?.recur?.[key] != null) continue;
    recur[key] = { price, client: nice(r["Client name"]).replace(HONOR, ""), title: nice(r["Job title"]) };
  }
  for (const k of ["visits", "oneoff"]) if (got[k]) report.skipped.push(`${k === "visits" ? "Visits" : "One-off jobs"} report: not needed, the roster already follows Jobber's calendar`);

  const nextInvoice = Math.max(set.nextInvoice || 1, maxInv + 1), nextQuote = Math.max(set.nextQuote || 1, maxQ + 1);
  const sum = (list, k) => list.filter((d) => d.kind === k).length;
  const owed = r2(live.filter((d) => d.kind === "invoice").reduce((a, d) => a + tot(d.items, d.gst) - d.payments.reduce((x, p) => x + p.amt, 0), 0));
  const paidIn = r2([...live, ...archive].reduce((a, d) => a + d.payments.reduce((x, p) => x + p.amt, 0), 0));
  return {
    live, archive, recur, nextInvoice, nextQuote,
    summary: {
      openInvoices: live.filter((d) => d.kind === "invoice").map((d) => ({ num: d.num, client: d.client.name, due: r2(tot(d.items, d.gst) - d.payments.reduce((x, p) => x + p.amt, 0)), dueDate: d.dueDate, title: d.jobberTitle })),
      openQuotes: live.filter((d) => d.kind === "quote").map((d) => ({ num: d.num, client: d.client.name, total: tot(d.items, d.gst), sent: d.issued, title: d.jobberTitle })),
      archived: { invoices: sum(archive, "invoice"), quotes: sum(archive, "quote") }, owed, paidIn,
      payments: [...live, ...archive].reduce((a, d) => a + d.payments.length, 0),
      recurring: Object.values(recur),
      numbering: { invoice: [set.nextInvoice, nextInvoice], quote: [set.nextQuote, nextQuote] },
      has: Object.keys(got),
    },
    report,
  };
}
