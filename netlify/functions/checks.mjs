// Runs every 15 minutes and pings Jack about things that need chasing.
// Each alert is sent once (remembered under sent/...).
import { store, loadRoster, loadConfirms, loadAcks, loadAllLive, sig, shiftOf } from "../../lib/core.mjs";
import { loadDocs, isDepositInv, addDays } from "../../lib/docs.mjs";
import { syncJobber, loadJobber } from "../../lib/jobber.mjs";
import { weeklyMoney } from "../../lib/weekly.mjs";
import { loadBooks } from "../../lib/books.mjs";
import { generate } from "../../lib/series.mjs";
import { toWrap } from "../../public/lib/profit.mjs";
import { ensurePlan, CH_NAME } from "../../lib/social.mjs";
import { notify, once, fmtDay, fmtTime, firstName, where, money } from "../../lib/notify.mjs";
import { loadMktSettings, reviewsPart, growthWeek, weeksAhead } from "../../lib/marketing.mjs";
import { loadRequests, SERVICES } from "../../lib/requests.mjs";
import { loadThread } from "../../lib/messages.mjs";
import { auMobile } from "../../lib/mm.mjs";

const BNE = 10 * 3600e3;
const nowBne = () => new Date(Date.now() + BNE);
const mins = (hm) => (/^\d{2}:\d{2}$/.test(hm || "") ? +hm.slice(0, 2) * 60 + +hm.slice(3, 5) : null);

export async function runChecks(s) {
  const n = nowBne(), today = n.toISOString().slice(0, 10), tomorrow = addDays(today, 1);
  const nowMin = n.getUTCHours() * 60 + n.getUTCMinutes();
  const roster = await loadRoster(s);
  const team = Object.fromEntries(roster.team.map((t) => [t.id, t]));
  const jobs = roster.jobs.filter((j) => !j.sample);
  const sent = [];
  const fire = async (key, e) => { if (await once(s, key)) { await notify(s, e); sent.push(key); } };

  // ---- Team ----
  const live = await loadAllLive(s);
  const confirms = await loadConfirms(s);
  for (const j of jobs.filter((x) => x.date === today)) {
    const L = live[j.id] || { arrived: {} };
    // Not checked in 15 minutes after their shift start (only within 3 hours, so old shifts stay quiet).
    for (const pid of j.staff || []) {
      const p = team[pid]; if (!p || p.owner) continue;
      const st = mins(shiftOf(j, pid).start);
      if (st == null || L.arrived?.[pid] || confirms[j.id]?.[pid]?.s === "no" || nowMin < st + 15 || nowMin > st + 180) continue;
      await fire(`late/${j.id}/${pid}/${today}`, { type: "late", title: `${firstName(p.name)} hasn't checked in at ${where(j)}`, body: `Shift started ${fmtTime(shiftOf(j, pid).start)}. They may have forgotten to tap "I've arrived".${p.phone ? "\nCall " + p.phone : ""}`, tags: "hourglass", priority: 4, url: "/" });
    }
    // Arrived but still not clocked off 90 minutes after their shift end (so their hours can't be logged).
    for (const pid of j.staff || []) {
      const p = team[pid]; if (!p || p.owner || !L.arrived?.[pid] || L.left?.[pid]) continue;
      const en = mins(shiftOf(j, pid).end);
      if (en == null || nowMin < en + 90 || nowMin > en + 360) continue;
      await fire(`noclock/${j.id}/${pid}/${today}`, { type: "noclock", title: `${firstName(p.name)} hasn't clocked off at ${where(j)}`, body: `Shift was due to end ${fmtTime(shiftOf(j, pid).end)}. Their hours won't log themselves until they tap "Clock off", or you can enter them in the wrap-up.${p.phone ? "\nCall " + p.phone : ""}`, tags: "stopwatch", url: "/" });
    }
    // Team on site but not marked ready an hour after the finish time.
    const end = mins(j.end);
    if (end != null && Object.keys(L.arrived || {}).length && !L.done && nowMin >= end + 60 && nowMin <= end + 300)
      await fire(`unfinished/${j.id}/${today}`, { type: "unfinished", title: `${where(j)} not marked ready`, body: `Due to finish ${fmtTime(j.end)}.${j.agentId ? " The agent is still seeing it as in progress." : ""}`, tags: "hourglass", url: "/" });
  }

  // 5pm: tomorrow's shifts not confirmed, jobs with nobody on them, new starters who haven't read their info.
  if (nowMin >= 17 * 60) {
    const acks = await loadAcks(s);
    const lines = [], newbies = new Set();
    for (const j of jobs.filter((x) => x.date === tomorrow).sort((a, b) => (a.start || "").localeCompare(b.start || ""))) {
      if (!(j.staff || []).length) { lines.push(`Nobody on ${where(j)} (${fmtTime(j.start)})`); continue; }
      for (const pid of j.staff) {
        const p = team[pid]; if (!p || p.owner) continue;
        const c = confirms[j.id]?.[pid];
        if (!c || c.k !== sig(j, pid)) lines.push(`${firstName(p.name)}: ${where(j)} ${fmtTime(shiftOf(j, pid).start)} not confirmed`);
        else if (c.s === "no") lines.push(`${firstName(p.name)} can't make ${where(j)}`);
        if (p.newStarter && !acks[pid]) newbies.add(firstName(p.name));
      }
    }
    for (const nm of newbies) lines.push(`${nm} hasn't read their first-day info`);
    if (lines.length) await fire(`tomorrow/${today}`, { type: "tomorrow", title: `Tomorrow (${fmtDay(tomorrow)}): ${lines.length} thing${lines.length === 1 ? "" : "s"} to sort`, body: lines.join("\n"), tags: "calendar", priority: 4, url: "/" });
  }

  // 6pm: jobs that finished today — log actual hours and costs so the job's real hourly rate and profit are known.
  if (nowMin >= 18 * 60) {
    const fin = toWrap({ jobs, books: await loadBooks(s) }, today, "23:59").filter((b) => b.last === today);
    if (fin.length) await fire(`wrap/${today}`, { type: "wrap", title: `Wrap up today's job${fin.length === 1 ? "" : "s"}: hours and costs`, body: fin.map((b) => where(b.j)).join("\n") + "\nTakes 30 seconds. Shows what each job really made per hour.", tags: "stopwatch", url: fin.length === 1 ? `/books/#/wrap/${encodeURIComponent(fin[0].key)}` : "/books/#/wrap" });
  }

  // ---- Clients ----
  const docs = await loadDocs(s);
  const day = (iso) => (iso ? new Date(Date.parse(iso) + BNE).toISOString().slice(0, 10) : "");
  if (nowMin >= 9 * 60) {
    for (const d of docs) {
      const who = d.client?.name || "client";
      if (d.kind === "quote" && (d.state === "viewed" || d.state === "sent")) {
        // Opened at least 3 days ago and still not accepted: worth a follow-up call.
        if (d.viewedAt && day(d.viewedAt) <= addDays(today, -3))
          await fire(`qfollow/${d.id}`, { type: "quote_follow", title: `Follow up quote #${d.num} for ${who}`, body: `Opened ${fmtDay(day(d.viewedAt))}${d.views > 1 ? `, ${d.views} times` : ""}, not accepted yet · ${money(d.totals.total)}${d.client?.phone ? "\nCall " + d.client.phone : ""}`, tags: "telephone_receiver", url: `/money/#/doc/${d.id}` });
        if (d.validUntil && d.validUntil >= today && d.validUntil <= addDays(today, 2))
          await fire(`qexp/${d.id}`, { type: "quote_expiry", title: `Quote #${d.num} for ${who} expires ${fmtDay(d.validUntil)}`, body: `${d.viewedAt ? "Opened" : "Not opened yet"} · ${money(d.totals.total)}`, tags: "hourglass", url: `/money/#/doc/${d.id}` });
      }
      if (d.kind === "invoice" && d.state === "overdue" && !isDepositInv(d))
        await fire(`overdue/${d.id}`, { type: "overdue", title: `Invoice #${d.num} for ${who} is overdue`, body: `${money(d.totals.due)} was due ${fmtDay(d.dueDate)}${d.viewedAt ? "" : " · they haven't opened it"}`, tags: "warning", priority: 4, url: `/money/#/doc/${d.id}` });
    }
  }
  // 4pm: deposit invoices still unpaid (the booking is only tentative until they're paid).
  if (nowMin >= 16 * 60) {
    const unpaid = docs.filter((d) => d.kind === "invoice" && isDepositInv(d) && d.state !== "draft" && d.state !== "paid" && d.totals.due > 0.005 && (!d.serviceDate || d.serviceDate >= today));
    if (unpaid.length) {
      const total = unpaid.reduce((a, d) => a + d.totals.due, 0);
      await fire(`deposit/${today}`, {
        type: "deposit", title: `${unpaid.length} deposit${unpaid.length === 1 ? "" : "s"} unpaid (${money(total)})`,
        body: unpaid.map((d) => `${d.client?.name || "Client"}: ${money(d.totals.due)}${d.serviceDate ? `, clean ${fmtDay(d.serviceDate)}` : ""}${d.viewedAt ? "" : ", not opened"}`).join("\n"),
        tags: "moneybag", priority: 4, url: "/money/",
      });
    }
  }
  // ---- Regular clients: keep 8 weeks of visits on the roster ----
  if (await once(s, `seriesgen/${today}`)) { try { await generate(s); } catch (e) { console.error("series failed", e); } }

  // ---- Money ----
  // Jobber sync every 6 hours: recurring visits go straight onto the roster.
  const jb = await loadJobber(s);
  if (jb.url && (await once(s, `jobsync/${today}/${Math.floor(nowMin / 360)}`))) {
    try {
      const r = await syncJobber(s);
      const fresh = (r.pending || []).filter((p) => p.date >= today && !(jb.pending || []).some((q) => q.uid === p.uid));
      if (fresh.length) await notify(s, { type: "jobber", title: `${fresh.length} new Jobber job${fresh.length === 1 ? "" : "s"} not on the roster`, body: fresh.slice(0, 6).map((p) => `${p.client}, ${fmtDay(p.date)}`).join("\n"), tags: "inbox_tray", url: "/books/#/jobber" });
    } catch (e) { console.error("jobber sync failed", e); }
  }
  // ---- Marketing: 8am on post days, today's Google / Instagram post is ready ----
  if (nowMin >= 8 * 60 && nowMin < 20 * 60 && (await once(s, `postday/${today}`))) {
    try {
      const { posts } = await ensurePlan(s, today);
      const due = posts.filter((p) => p.date === today && !p.status);
      const missed = posts.filter((p) => p.date < today && !p.status).length;
      if (due.length) {
        const names = [...new Set(due.map((p) => CH_NAME[p.ch]))].join(" and ");
        await notify(s, { type: "post_due", title: `Post day: your ${names} post${due.length === 1 ? " is" : "s are"} ready`, body: `Photo and caption are done. Open it, tap Copy & share, then mark it posted. About two minutes.${missed ? `\n${missed} earlier post${missed === 1 ? "" : "s"} still waiting too.` : ""}`, tags: "camera", url: "/social/" });
      }
    } catch (e) { console.error("post day failed", e); }
  }
  // ---- Growth hub ----
  try {
    const mk = await loadMktSettings(s);
    // A new lead waiting past the reply target (7am to 7pm only; overnight leads count from 7am).
    if (nowMin >= 7 * 60 && nowMin < 19 * 60) {
      const since = Date.now() - 36 * 3600e3;
      for (const r of (await loadRequests(s)).filter((x) => x.status === "new" && !x.quoteId && !x.dns && Date.parse(x.at) > since)) {
        const startMs = Math.max(Date.parse(r.at), Date.parse(today + "T07:00:00+10:00"));
        const waited = Math.round((Date.now() - startMs) / 60000);
        if (waited < mk.respondMins) continue;
        const ph = auMobile(r.phone);
        if (ph) { const t = await loadThread(s, ph); if ((t.msgs || []).some((m) => m.dir === "out" && m.at > r.at && !/^ack:/.test(m.ref || ""))) continue; }
        await fire(`leadwait/${r.id}`, { type: "lead_wait", title: `${firstName(r.name)} has been waiting ${waited} min`, body: `${(SERVICES[r.service] || SERVICES.other).label}${r.suburb ? ", " + r.suburb : ""}. No reply yet.${r.phone ? "\nCall " + r.phone : ""}`, tags: "alarm_clock", priority: 4, url: `/money/#/req/${r.id}` });
      }
    }
    // 10am: review requests ready.
    if (nowMin >= 10 * 60 && nowMin < 18 * 60 && (await once(s, `revdue/${today}`))) {
      const rv = await reviewsPart(s), n = rv.ask.length + rv.remind.length;
      if (n) await notify(s, { type: "review_due", title: `${n} review request${n === 1 ? "" : "s"} ready`, body: [...rv.ask, ...rv.remind].slice(0, 5).map((x) => x.name).join(", ") + "\nDrafts are written. Tap each one to send from Messages.", tags: "star", url: "/marketing/#reviews" });
    }
    // Monday: growth check, and quiet weeks ahead.
    if (n.getUTCDay() === 1 && nowMin >= 7 * 60 + 30 && (await once(s, `growthweek/${today}`))) {
      await notify(s, await growthWeek(s));
      const quiet = (await weeksAhead(s, mk.quietPct)).filter((w) => w.quiet);
      if (quiet.length) await notify(s, { type: "quiet_week", title: `${quiet.length} quiet week${quiet.length === 1 ? "" : "s"} ahead`, body: quiet.map((w) => `Week of ${fmtDay(w.from)}: ${w.pct}% booked`).join("\n") + "\nThe Growth hub lists agents, past clients and referrals to reach out to.", tags: "calendar", priority: 4, url: "/marketing/" });
    }
  } catch (e) { console.error("growth checks failed", e); }

  // Monday 7am: last week's numbers and what's missing.
  if (n.getUTCDay() === 1 && nowMin >= 7 * 60) {
    if (await once(s, `moneyweek/${today}`)) { try { const e = await weeklyMoney(s, today); if (e) await notify(s, e); } catch (e) { console.error("weekly money failed", e); } }
  }
  return sent;
}

export default async () => {
  try { await runChecks(await store()); } catch (e) { console.error("checks failed", e); }
};

export const config = { schedule: "*/15 * * * *" };
