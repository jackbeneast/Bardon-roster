// Profit for a date range, from what the hub knows: job prices (earned on the
// booking's first day), rostered team wages + super, logged expenses and regular
// outgoings (counted on the days they fall due). Shared by the Profit page and
// the Monday summary so both always agree.
import { shiftCosts, paySet, SUPER, QLD_PH } from "./wages.mjs";

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

  // Paid hours on each booking: logged actual hours, else rostered hours for
  // everyone on it (owner included), else the job's length for one person.
  const hrsOf = (b) => {
    if (actHrs[b.key]) return actHrs[b.key];
    const ro = Object.values(rosteredHours(b, D.pay)).reduce((a, v) => a + v, 0);
    if (ro > 0) return ro;
    return b.days.reduce((a, j) => { const h = (hm(j.end) - hm(j.start)) / 60; return a + (h > 0 ? h : 0); }, 0);
  };
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
      actHrs: h || null, hrs: hrsOf(b), perHr: h && rev != null ? rev / h : null, profitHr: h && profit != null ? profit / h : null };
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
  // Overheads: everything not tied to a job (regular outgoings and general
  // expenses), shared across this period's jobs by hours worked, so a 3-day
  // pre-sale carries more than a 2-hour regular.
  let overheads = 0;
  for (const e of exps) if (!e.job) overheads += e.amt - (gstReg ? e.gst : 0);
  for (const f of fixedHits) overheads += f.amt - (gstReg && f.gst ? f.amt / 11 : 0);
  const jobHrs = jobs.reduce((a, j) => a + j.hrs, 0), ohRate = jobHrs > 0 ? overheads / jobHrs : 0;
  for (const j of jobs) { j.overhead = j.hrs * ohRate; j.net = j.profit != null ? j.profit - j.overhead : null; j.netHr = j.actHrs && j.net != null ? j.net / j.actHrs : null; }
  const rev = exGst(revInc), gstCollected = revInc - rev;
  const otherCosts = Object.values(cats).reduce((a, v) => a + v, 0);
  const costs = wages + sup + otherCosts;
  return {
    from, to, jobs, rev: r2(rev), revInc: r2(revInc), gstCollected: r2(gstCollected), gstPaid: r2(gstPaid), gstNet: r2(gstCollected - gstPaid),
    wages: r2(wages), sup: r2(sup), hrs, cats, otherCosts: r2(otherCosts), costs: r2(costs), profit: r2(rev - costs),
    margin: rev > 0 ? (rev - costs) / rev : null, perHour, overheads: r2(overheads), jobHrs, ohRate, unpriced: jobs.filter((j) => j.price == null), expCount: exps.length, fixedHits,
    cashIn: r2((D.payments || []).filter((p) => p.date >= from && p.date <= to).reduce((a, p) => a + p.amt, 0)),
  };
}

// What a job costs to run, from the last 90 days, for pricing quotes:
// overheads per hour worked, job materials per hour, and staff rates.
export function costBasis(D, today) {
  // Window: the last 90 days, but no earlier than the first job on the roster,
  // so weeks before the hub was in use don't count as weeks with no work.
  const gstReg = D.gstReg, ex = (e) => e.amt - (gstReg ? e.gst : 0);
  const first = bookingsOf(D.jobs).map((b) => b.date).filter((d) => d <= today).sort()[0];
  let from = addIso(today, -89, 0);
  if (first && first > from) from = first;
  const days = Math.max(14, (Date.parse(today) - Date.parse(from)) / 864e5 + 1), months = days / (365.25 / 12);
  const x = pnl(D, from, today), done = x.jobs.filter((j) => j.last <= today);
  const hrs = done.reduce((a, j) => a + j.hrs, 0);
  // Materials: products bought for a job, plus cleaning products bought for stock.
  const stock = (D.expenses || []).filter((e) => !e.job && e.cat === "Cleaning products" && e.date >= from && e.date <= today).reduce((a, e) => a + ex(e), 0);
  const mat = done.reduce((a, j) => a + j.exp, 0) + stock;
  // Regular outgoings at their monthly average, so a yearly bill landing (or not)
  // in the window doesn't swing the rate.
  const fixedM = (D.books.fixed || []).filter((f) => !f.end || f.end >= today)
    .reduce((a, f) => a + perMonth(f) * (gstReg && f.gst ? 10 / 11 : 1), 0);
  // Equipment lasts: one-off equipment bought in the last 12 months is spread over 12 months.
  const yr = addIso(today, -364, 0);
  const equipM = (D.expenses || []).filter((e) => !e.job && e.cat === "Equipment" && e.date >= yr && e.date <= today).reduce((a, e) => a + ex(e), 0) / 12;
  const general = (D.expenses || []).filter((e) => !e.job && e.cat !== "Equipment" && e.cat !== "Cleaning products" && e.date >= from && e.date <= today).reduce((a, e) => a + ex(e), 0);
  const ohMonth = fixedM + equipM + general / months, hrsMonth = hrs / months;
  const target = D.books.pricing && D.books.pricing.hrsMonth > 0 ? D.books.pricing.hrsMonth : null;
  const perHrs = target || hrsMonth;
  return {
    from, to: today, days: Math.round(days), jobs: done.length, hrs: r2(hrs), hrsMonth: r2(hrsMonth), hrsTarget: target,
    fixedMonth: r2(fixedM), equipMonth: r2(equipM), generalMonth: r2(general / months), ohMonth: r2(ohMonth),
    ohPerHr: perHrs > 0 ? r2(ohMonth / perHrs) : null, matPerHr: hrs > 0 ? r2(mat / hrs) : null, stockMonth: r2(stock / months),
    rates: paySet(D.pay).rates, ph: [...QLD_PH, ...paySet(D.pay).ph], superRate: SUPER, gstReg,
  };
}
