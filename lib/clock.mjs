// Clock in / clock off: when everyone on a finished booking has clocked off,
// their actual hours go straight into the job wrap-up, so Jack doesn't have to
// type them. Jack can still open the wrap-up and change them.
import { loadLive, shiftOf } from "./core.mjs";
import { loadBooks } from "./books.mjs";
import { paySet } from "../public/lib/wages.mjs";
import { notify, firstName, where } from "./notify.mjs";

const hm = (t) => (/^\d{2}:\d{2}$/.test(t || "") ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : NaN);
const r2 = (v) => Math.round(v * 100) / 100;
const lunchOff = (span, lunch) => (lunch && span > 4.5 ? 0.5 : 0);

// Paid hours for one person on one day from their clock-in and clock-off.
export function clockedHours(arrived, left, lunch) {
  const span = (Date.parse(left) - Date.parse(arrived)) / 3600e3;
  if (!(span > 0) || span > 16) return null;
  return r2(span - lunchOff(span, lunch));
}

// The days of the booking a job belongs to (multi-day jobs share a group).
export function bookingDays(roster, job) {
  const key = job.group || job.id;
  return roster.jobs.filter((j) => !j.sample && (j.group || j.id) === key).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

// Returns { staff, missing } for a booking. Team must have clocked in and off on
// every day they were rostered (unless they declined the shift). The owner counts
// at their clocked hours if they clocked, otherwise their rostered hours.
export async function clockSummary(s, roster, days, confirms = {}) {
  const lunch = paySet(roster.pay).lunch, staff = {}, missing = [];
  const team = Object.fromEntries(roster.team.map((t) => [t.id, t]));
  for (const j of days) {
    const L = await loadLive(s, j.id);
    for (const pid of j.staff || []) {
      const p = team[pid]; if (!p) continue;
      if (confirms[j.id]?.[pid]?.s === "no") continue;
      const a = L.arrived?.[pid], l = L.left?.[pid];
      let h = a && l ? clockedHours(a, l, lunch) : null;
      if (h == null && p.owner) {
        const sh = shiftOf(j, pid), span = (hm(sh.end) - hm(sh.start)) / 60;
        if (span > 0) h = r2(span - lunchOff(span, lunch));
      }
      if (h == null) { missing.push({ pid, jobId: j.id, date: j.date, arrived: !!a }); continue; }
      staff[pid] = r2((staff[pid] || 0) + h);
    }
  }
  return { staff, missing };
}

// Called after a clock-off or finish. Writes the wrap-up once everyone is off on
// the booking's last day. Never overwrites hours Jack has already logged.
export async function autoWrap(s, roster, job, today, confirms = {}) {
  const days = bookingDays(roster, job);
  if (!days.length) return null;
  const last = days[days.length - 1];
  if (last.date > today) return null;
  const key = job.group || job.id;
  const books = await loadBooks(s);
  if (books.actuals[key]) return null;
  const { staff, missing } = await clockSummary(s, roster, days, confirms);
  if (missing.length || !Object.values(staff).some((v) => v > 0)) return null;
  books.actuals[key] = { staff, note: "From team clock-in and clock-off", src: "clock", at: new Date().toISOString() };
  await s.set("books", { ...((await s.get("books")) || {}), actuals: books.actuals });
  const names = Object.fromEntries(roster.team.map((t) => [t.id, t]));
  const total = Object.values(staff).reduce((a, v) => a + v, 0);
  await notify(s, {
    type: "hours", title: `Hours logged for ${where(job)}: ${r2(total)} h`,
    body: Object.entries(staff).map(([pid, h]) => `${firstName(names[pid]?.name || "Someone")} ${h} h`).join(" · ") + "\nFrom clock-in and clock-off. Tap to check or change.",
    tags: "stopwatch", priority: 2, url: `/books/#/wrap/${encodeURIComponent(key)}`,
  });
  return books.actuals[key];
}
