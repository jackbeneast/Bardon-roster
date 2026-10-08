// Profit for a date range, from what the hub knows: job prices (earned on the
// booking's first day), rostered team wages + super, logged expenses and regular
// outgoings (counted on the days they fall due). Shared by the Profit page and
// the Monday summary so both always agree.
import { shiftCosts } from "./wages.mjs";

const r2 = (v) => Math.round(v * 100) / 100;
const bookingKey = (j) => j.group || j.id;

export function bookingsOf(jobs) {
  const m = new Map();
  for (const j of jobs) if (!j.sample) { const k = bookingKey(j); if (!m.has(k)) m.set(k, []); m.get(k).push(j); }
  for (const l of m.values()) l.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return [...m.entries()].map(([key, days]) => ({ key, days, date: days[0].date, last: days[days.length - 1].date, j: days[0] }));
}

export function priceOf(b, books, qt) {
  if (books.prices[b.key] != null) return { price: books.prices[b.key], from: "set" };
  const rec = b.days.find((j) => j.rec)?.rec;
  if (rec && books.recur[rec] != null) return { price: books.recur[rec], from: "recurring" };
  for (const j of b.days) if (qt[j.id] != null) return { price: qt[j.id], from: "quote" };
  return { price: null, from: "" };
}

const STEP = { weekly: [7, 0], fortnightly: [14, 0], monthly: [0, 1], quarterly: [0, 3], yearly: [0, 12] };
function addIso(d, days, months) {
  const x = new Date(d + "T00:00:00Z");
  if (months) { const day = x.getUTCDate(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() + months); const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); x.setUTCDate(Math.min(day, last)); }
  else x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
}
// Dates a regular outgoing falls due between from and to.
export function dueDates(f, from, to) {
  const [dd, mm] = STEP[f.freq] || STEP.monthly, out = [];
  let d = f.start, n = 0, k = 0;
  while (d < from && k++ < 3000) { n++; d = addIso(f.start, dd * n, mm * n); }
  while (d <= to && (!f.end || d <= f.end) && k++ < 3000) { out.push(d); n++; d = addIso(f.start, dd * n, mm * n); }
  return out;
}
export function perMonth(f) { const m = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[f.freq] || 1; return f.amt * m; }

export function pnl(D, from, to) {
  const gstReg = D.gstReg, exGst = (v) => (gstReg ? v / 1.1 : v);
  const books = D.books, qt = D.quoteTotals || {};
  const all = bookingsOf(D.jobs);
  const inRange = all.filter((b) => b.date >= from && b.date <= to);
  const shifts = shiftCosts(D.jobs, D.team, D.pay, from, to);
  const labourByJob = {};
  for (const s of shifts) labourByJob[s.jobId] = (labourByJob[s.jobId] || 0) + s.pay + s.sup;

  let revInc = 0;
  const jobs = inRange.map((b) => {
    const p = priceOf(b, books, qt);
    const labour = b.days.reduce((a, j) => a + (labourByJob[j.id] || 0), 0);
    const exp = (D.expenses || []).filter((e) => e.job === b.key).reduce((a, e) => a + (e.amt - (gstReg ? e.gst : 0)), 0);
    if (p.price != null) revInc += p.price;
    const rev = p.price != null ? exGst(p.price) : null;
    return { ...b, price: p.price, from: p.from, rev, labour, exp, profit: rev != null ? rev - labour - exp : null };
  });

  const wages = shifts.reduce((a, s) => a + s.pay, 0), sup = shifts.reduce((a, s) => a + s.sup, 0);
  const hrs = shifts.reduce((a, s) => a + s.hrs, 0);
  const cats = {};
  let expInc = 0, gstPaid = 0;
  const exps = (D.expenses || []).filter((e) => e.date >= from && e.date <= to);
  for (const e of exps) { const ex = e.amt - (gstReg ? e.gst : 0); cats[e.cat] = (cats[e.cat] || 0) + ex; expInc += e.amt; gstPaid += gstReg ? e.gst : 0; }
  const fixedHits = [];
  for (const f of books.fixed || []) for (const d of dueDates(f, from, to)) {
    const g = gstReg && f.gst ? f.amt / 11 : 0;
    cats[f.cat] = (cats[f.cat] || 0) + f.amt - g; expInc += f.amt; gstPaid += g; fixedHits.push({ ...f, date: d });
  }
  const rev = exGst(revInc), gstCollected = revInc - rev;
  const otherCosts = Object.values(cats).reduce((a, v) => a + v, 0);
  const costs = wages + sup + otherCosts;
  return {
    from, to, jobs, rev: r2(rev), revInc: r2(revInc), gstCollected: r2(gstCollected), gstPaid: r2(gstPaid), gstNet: r2(gstCollected - gstPaid),
    wages: r2(wages), sup: r2(sup), hrs, cats, otherCosts: r2(otherCosts), costs: r2(costs), profit: r2(rev - costs),
    margin: rev > 0 ? (rev - costs) / rev : null, unpriced: jobs.filter((j) => j.price == null), expCount: exps.length, fixedHits,
    cashIn: r2((D.payments || []).filter((p) => p.date >= from && p.date <= to).reduce((a, p) => a + p.amt, 0)),
  };
}
