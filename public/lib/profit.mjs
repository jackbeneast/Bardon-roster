// Profit for a date range, from what the hub knows: job prices (earned on the
// booking's first day), rostered team wages + super, logged expenses and regular
// outgoings (counted on the days they fall due). Shared by the Profit page and
// the Monday summary so both always agree.
import { shiftCosts, paySet, SUPER } from "./wages.mjs";

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

// ---- Job wrap-up: actual hours worked and what the job really earned ----
const hm = (t) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : NaN);
// Rostered paid hours per person for a whole booking (owner included), same
// lunch rule as the wage estimate. Used to prefill the wrap-up and to scale wages.
export function rosteredHours(b, pay) {
  const lunch = paySet(pay).lunch, out = {};
  for (const j of b.days) for (const pid of j.staff || []) {
    const x = (j.shifts && j.shifts[pid]) || {}, span = (hm(x.end || j.end) - hm(x.start || j.start)) / 60;
    if (span > 0) out[pid] = (out[pid] || 0) + span - (lunch && span > 4.5 ? 0.5 : 0);
  }
  return out;
}
// Finished bookings (last day over) from the past fortnight with no hours logged yet.
export function toWrap(D, today, nowHM) {
  const act = D.books.actuals || {}, since = addIso(today, -14, 0);
  return bookingsOf(D.jobs).filter((b) => {
    if (act[b.key] || b.last < since || b.last > today) return false;
    if (b.last < today) return true;
    const end = b.days[b.days.length - 1].end;
    return !!(nowHM && end && end <= nowHM);
  }).sort((a, b) => b.last.localeCompare(a.last));
}

export function pnl(D, from, to) {
  const gstReg = D.gstReg, exGst = (v) => (gstReg ? v / 1.1 : v);
  const books = D.books, qt = D.quoteTotals || {};
  const all = bookingsOf(D.jobs);
  const inRange = all.filter((b) => b.date >= from && b.date <= to);
  const shifts = shiftCosts(D.jobs, D.team, D.pay, from, to);
  // Where Jack has logged actual hours, scale each person's rostered wage cost to
  // their actual hours. People who helped but weren't rostered are costed at the
  // weekday rate on the booking's last day.
  const act = books.actuals || {}, owner = new Set((D.team || []).filter((m) => m.owner).map((m) => m.id));
  const known = new Set((D.team || []).map((m) => m.id)), wk = paySet(D.pay).rates.wk;
  const keyOf = {}, scale = {}, extra = {}, actHrs = {};
  for (const b of all) {
    for (const j of b.days) keyOf[j.id] = b.key;
    const a = act[b.key]; if (!a || !a.staff) continue;
    const ro = rosteredHours(b, D.pay);
    actHrs[b.key] = Object.values(a.staff).reduce((x, v) => x + v, 0);
    for (const [pid, h] of Object.entries(a.staff)) {
      if (owner.has(pid)) continue;
      if (ro[pid] > 0) scale[b.key + "|" + pid] = h / ro[pid];
      else if (h > 0 && known.has(pid) && b.last >= from && b.last <= to) extra[b.key] = (extra[b.key] || 0) + h * wk;
    }
    for (const pid of Object.keys(ro)) if (!owner.has(pid) && a.staff[pid] == null) scale[b.key + "|" + pid] = 0;
  }
  for (const sh of shifts) { const f = scale[keyOf[sh.jobId] + "|" + sh.pid]; if (f != null) { sh.pay *= f; sh.sup *= f; sh.hrs *= f; } }
  const extraPay = Object.values(extra).reduce((a, v) => a + v, 0), extraHrs = extraPay / wk;
  const labourByJob = {};
  for (const s of shifts) labourByJob[s.jobId] = (labourByJob[s.jobId] || 0) + s.pay + s.sup;

  let revInc = 0;
  const jobs = inRange.map((b) => {
    const p = priceOf(b, books, qt);
    const labour = b.days.reduce((a, j) => a + (labourByJob[j.id] || 0), 0) + (extra[b.key] || 0) * (1 + SUPER);
    const exp = (D.expenses || []).filter((e) => e.job === b.key).reduce((a, e) => a + (e.amt - (gstReg ? e.gst : 0)), 0);
    if (p.price != null) revInc += p.price;
    const rev = p.price != null ? exGst(p.price) : null;
    const profit = rev != null ? rev - labour - exp : null, h = actHrs[b.key];
    const done = !!act[b.key], skipped = !!(act[b.key] && act[b.key].skip);
    return { ...b, price: p.price, from: p.from, rev, labour, exp, profit, done, skipped,
      actHrs: h || null, perHr: h && rev != null ? rev / h : null, profitHr: h && profit != null ? profit / h : null };
  });

  const wages = shifts.reduce((a, s) => a + s.pay, 0) + extraPay, sup = shifts.reduce((a, s) => a + s.sup, 0) + extraPay * SUPER;
  const hrs = shifts.reduce((a, s) => a + s.hrs, 0) + extraHrs;
  const wrapped = jobs.filter((j) => j.actHrs && j.rev != null);
  const wHrs = wrapped.reduce((a, j) => a + j.actHrs, 0);
  const perHour = wHrs ? { jobs: wrapped.length, hrs: wHrs, rate: wrapped.reduce((a, j) => a + j.rev, 0) / wHrs, profit: wrapped.reduce((a, j) => a + j.profit, 0) / wHrs } : null;
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
    margin: rev > 0 ? (rev - costs) / rev : null, perHour, unpriced: jobs.filter((j) => j.price == null), expCount: exps.length, fixedHits,
    cashIn: r2((D.payments || []).filter((p) => p.date >= from && p.date <= to).reduce((a, p) => a + p.amt, 0)),
  };
}
