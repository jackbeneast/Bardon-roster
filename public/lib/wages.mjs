// Wage cost of rostered shifts, same rules as the hub's Wage estimate:
// casual rates per day type, 30-min unpaid lunch over 4.5 hrs, overtime past
// 7.6 hrs a day / 38 a week / a 6th day at Cleaning Services Award casual rates
// (or the set rate if higher), super 12% of ordinary pay. Owner shifts aren't costed.
// Used by the Profit page (browser) and the Monday summary (server).

export const DEF_RATES = { wk: 37.5, el: 37.91, sat: 47.39, sun: 60.93, ph: 74.47 };
const AWD = (() => { const base = 33.85 / 1.25, r = (v) => Math.round(v * 100) / 100; return { ot1: r(base * 1.75), ot2: r(base * 2.25), otSun: r(base * 2.25), otPh: r(base * 2.75) }; })();
export const QLD_PH = ["2026-01-01", "2026-01-26", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-25", "2026-05-04", "2026-10-05", "2026-12-25", "2026-12-26", "2026-12-28", "2027-01-01", "2027-01-26", "2027-03-26", "2027-03-27", "2027-03-28", "2027-03-29", "2027-04-26", "2027-05-03", "2027-10-04", "2027-12-25", "2027-12-26", "2027-12-27", "2027-12-28"];
export const SUPER = 0.12;

const mins = (t) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : NaN);
const dnum = (d) => Math.round(Date.parse(d + "T00:00:00Z") / 864e5);
const dstr = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const dow = (d) => new Date(d + "T00:00:00Z").getUTCDay();

export function paySet(p) {
  p = p || {};
  return { anchor: p.anchor || "2026-10-05", lunch: p.lunch !== false, rates: Object.assign({}, DEF_RATES, p.rates || {}), ph: p.ph || [] };
}

// Returns every costed shift between from and to (inclusive):
// {jobId, pid, date, hrs, ord, ot, pay, sup}
export function shiftCosts(jobs, team, pay, from, to) {
  const p = paySet(pay), R = p.rates, ph = new Set([...QLD_PH, ...p.ph]);
  // Work in whole weeks lined up with the pay cycle so weekly overtime is right.
  const a = dnum(p.anchor), f = dnum(from), t = dnum(to);
  const ws = a + Math.floor((f - a) / 7) * 7, we = a + Math.floor((t - a) / 7) * 7 + 6;
  const s0 = dstr(ws), e0 = dstr(we), out = [];
  for (const m of team || []) {
    if (m.owner) continue;
    const sh = [];
    for (const j of jobs) {
      if (j.sample || j.date < s0 || j.date > e0 || !(j.staff || []).includes(m.id)) continue;
      const x = (j.shifts && j.shifts[m.id]) || {}, st = x.start || j.start, en = x.end || j.end;
      const span = (mins(en) - mins(st)) / 60; if (!(span > 0)) continue;
      const lunch = p.lunch && span > 4.5 ? 0.5 : 0, d = dow(j.date);
      const kind = ph.has(j.date) ? "ph" : d === 0 ? "sun" : d === 6 ? "sat" : (mins(st) < 360 || mins(en) > 1080) ? "el" : "wk";
      sh.push({ jobId: j.id, pid: m.id, date: j.date, start: st, hrs: span - lunch, kind });
    }
    sh.sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start));
    for (let w = ws; w <= we; w += 7) {
      const wk = sh.filter((x) => dnum(x.date) >= w && dnum(x.date) <= w + 6);
      const days = [...new Set(wk.map((x) => x.date))];
      let weekOrd = 0;
      days.forEach((d, di) => {
        let dayOrd = 0, dayOT = 0;
        for (const x of wk.filter((y) => y.date === d)) {
          const rate = R[x.kind]; let ord = 0, ot = 0;
          if (di >= 5) ot = x.hrs;
          else { ord = Math.min(x.hrs, Math.max(0, 7.6 - dayOrd), Math.max(0, 38 - weekOrd)); ot = x.hrs - ord; }
          dayOrd += ord; weekOrd += ord;
          let op = 0;
          if (ot > 0) {
            if (x.kind === "ph") op = ot * Math.max(AWD.otPh, rate);
            else if (x.kind === "sun") op = ot * Math.max(AWD.otSun, rate);
            else { const f1 = Math.min(ot, Math.max(0, 2 - dayOT)); op = f1 * Math.max(AWD.ot1, rate) + (ot - f1) * Math.max(AWD.ot2, rate); }
          }
          dayOT += ot;
          if (x.date >= from && x.date <= to) out.push({ jobId: x.jobId, pid: x.pid, date: x.date, hrs: x.hrs, ord, ot, pay: ord * rate + op, sup: ord * rate * SUPER });
        }
      });
    }
  }
  return out;
}
