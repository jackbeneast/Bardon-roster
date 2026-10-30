// Jack's desk: the business side built from data the hub already has.
//   needs()      one ranked list of what needs Jack, with a draft message where one helps
//   jobsPanel()  each live or upcoming booking's client-link extras (prep, key date, add-ons…)
//   calibrate()  forecast vs actual hours per area and per kind of clean
//   sources()    leads, wins and revenue by where they came from
//   agentsCard() per-agent jobs, revenue and last contact
//   capacity()   the next four weeks: booked, tentative, free
//   cash()       money coming in, wages and bills going out, GST and tax to set aside
//   rebook()     past clients worth a nudge (with a draft, never sent automatically)
//   content()    after photos turned into draft posts
import { loadRoster, loadAllLive, bookingLive } from "./core.mjs";
import { loadDocs, loadSettings, freeDates, addDays } from "./docs.mjs";
import { loadRequests, lines } from "./requests.mjs";
import { loadIndex, loadThread } from "./messages.mjs";
import { loadBooks, loadExpenses, quoteTotals } from "./books.mjs";
import { loadTemplates } from "./templates.mjs";
import { clientKey } from "./engage.mjs";
import { bookingsOf, priceOf, toWrap, pnl, dueDates } from "../public/lib/profit.mjs";
import { shiftCosts, QLD_PH } from "../public/lib/wages.mjs";
import { loadPlusSettings, areaKey, AREA_LABEL, kindOf, bneToday, addrKey, prepFor } from "./plus.mjs";
import { buildPipeline } from "../netlify/functions/pipeline.mjs";
import { clockedHours } from "./clock.mjs";
import { fmtDay } from "./notify.mjs";

const SITE = () => (process.env.URL || "https://bardon-roster.netlify.app").replace(/\/$/, "");
const r2 = (v) => Math.round(v * 100) / 100;
const first = (n) => String(n || "").replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] || "there";
const mob = (raw) => { const x = String(raw || "").replace(/[^\d+]/g, "").replace(/^\+61/, "0").replace(/^61(?=4\d{8}$)/, "0"); return /^04\d{8}$/.test(x) ? x : ""; };
const notesMob = (notes) => { const m = /Client:\s*([+\d][\d\s]{7,15}\d)/.exec(notes || ""); return m ? mob(m[1]) : ""; };
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const place = (j) => String(j.address || j.suburb || "the property").replace(/^Sample:\s*/, "");
const textHref = (phone, name, draft) => `/messages/#/t/${phone}?name=${encodeURIComponent(name || "")}${draft ? "&draft=" + encodeURIComponent(draft) : ""}`;
const fyStartOf = (d) => (+d.slice(5, 7) >= 7 ? d.slice(0, 4) : String(+d.slice(0, 4) - 1)) + "-07-01";
const qStartOf = (d) => { const y = d.slice(0, 4), m = +d.slice(5, 7), qm = Math.floor((m - 1) / 3) * 3 + 1; return `${y}-${String(qm).padStart(2, "0")}-01`; };

// The client's mobile for a booking: its quote, else the "Client: 04…" note on the job.
function phoneFor(days, docs) {
  const ids = new Set(days.map((d) => d.id));
  const q = docs.find((d) => d.kind === "quote" && ids.has(d.jobId) && d.client?.phone);
  return mob(q?.client?.phone) || days.map((d) => notesMob(d.notes)).find(Boolean) || "";
}
async function lastOut(s, phone) {
  if (!phone) return "";
  const t = await loadThread(s, phone);
  const o = (t.msgs || []).filter((m) => m.dir === "out").pop();
  return o ? o.at : "";
}

async function ctx(s) {
  const [roster, docs, rawLive, set, books, plus] = await Promise.all([loadRoster(s), loadDocs(s), loadAllLive(s), loadSettings(s), loadBooks(s), loadPlusSettings(s)]);
  const live = bookingLive(roster, rawLive);
  const B = bookingsOf(roster.jobs);
  return { roster, docs, rawLive, live, set, books, plus, B, t: bneToday() };
}

// ================= What needs me =================
export async function needs(s) {
  const C = await ctx(s), { roster, docs, live, B, t } = C;
  const [pipe, idx, dis, tpl, reqs, exps] = await Promise.all([buildPipeline(s), loadIndex(s), s.get("plus/dismiss"), loadTemplates(s), loadRequests(s), loadExpenses(s)]);
  const dismissed = dis || {};
  const out = [];
  const add = (x) => { if (!dismissed[x.key]) out.push(x); };

  // Messages waiting on a reply
  for (const [phone, x] of Object.entries(idx)) {
    if (x.archived || !x.unread) continue;
    add({ key: "msg:" + phone + ":" + x.lastAt, p: 1, type: "Message", title: `${x.name || phone} is waiting on a reply`, sub: x.last || "", actions: [{ label: "Open", href: `/messages/#/t/${phone}` }] });
  }

  // Do-not-service matches and new leads with no reply yet
  const reqById = Object.fromEntries(reqs.map((r) => [r.id, r]));
  for (const l of pipe.stages.new) {
    const r = reqById[l.req] || {};
    if (r.dns) { add({ key: "dns:" + l.req, p: 0, type: "Do not service", title: `${l.name} matches your do-not-service list`, sub: `Matched "${r.dns}". Nothing has been sent.`, actions: [{ label: "Open request", href: `/money/#/req/${l.req}` }] }); continue; }
    const lo = await lastOut(s, l.phone);
    if (lo && lo > (r.at || "")) continue;
    add({ key: "lead:" + l.req, p: 1, type: "New lead", title: `${l.name} · ${l.service}${l.where ? ", " + l.where : ""}`, sub: `${l.age ? l.age + " day" + (l.age === 1 ? "" : "s") + " ago" : "Today"}${r.refBy ? ` · referred by ${r.refBy.name || "a past client"}` : ""}${l.source ? " · found you via " + ({ google: "Google", referral: "friend or family", agent: "their agent", instagram: "Instagram", repeat: "used you before" }[l.source] || l.source) : ""}`, actions: [{ label: "Open request", href: `/money/#/req/${l.req}` }, ...(l.phone ? [{ label: "Call", href: `tel:${l.phone}` }] : [])] });
  }

  // Quotes: hot (opened again and again lately) and ones to follow up
  const engCache = {};
  const engFor = async (name) => (engCache[name] ||= (await s.get(`eng/${clientKey(name)}`)) || { sessions: [] });
  const since = new Date(Date.now() - 72 * 3600e3).toISOString();
  for (const q of pipe.stages.quoted) {
    if (q.draft) continue;
    const e = await engFor(q.name), opens = e.sessions.filter((x) => x.item && x.item.id === q.doc && x.at >= since);
    const today = opens.filter((x) => x.at >= new Date(Date.now() - 24 * 3600e3).toISOString()).length;
    const doc = docs.find((d) => d.id === q.doc);
    if (opens.length >= 2) {
      const draft = `Hi ${first(q.name)}, it's Jack from Bardon Clean. Happy to talk through the quote or tweak anything so it suits. Give me a call or reply here whenever suits.`;
      add({ key: "hot:" + q.doc + ":" + t, p: 1, type: "Hot quote", title: `${q.name} is looking at quote #${q.num} again`, sub: `Opened ${opens.length} times in 3 days${today ? `, ${today} today` : ""} · $${Math.round(q.total).toLocaleString("en-AU")}`, actions: [...(q.phone ? [{ label: "Call", href: `tel:${q.phone}` }, { label: "Text (draft ready)", href: textHref(q.phone, q.name, draft) }] : []), { label: "Quote", href: `/money/#/doc/${q.doc}` }] });
      continue;
    }
    if ((q.sent ?? 0) >= 3 && doc) {
      const lo = await lastOut(s, q.phone);
      if (lo && daysBetween(lo.slice(0, 10), t) < 3) continue;
      const draft = `Hi ${first(q.name)}, Jack from Bardon Clean here. Just checking the quote for ${q.where || "your place"} came through okay. Happy to answer any questions or adjust it. Here it is again: ${SITE()}/q/${doc.token}`;
      add({ key: "fu:" + q.doc + ":" + Math.floor((q.sent || 0) / 4), p: 2, type: "Follow up", title: `Quote #${q.num} for ${q.name}, sent ${q.sent} days ago`, sub: `${q.views ? `Opened ${q.views} time${q.views === 1 ? "" : "s"}` : "Not opened yet"} · $${Math.round(q.total).toLocaleString("en-AU")}`, actions: q.phone ? [{ label: "Text (draft ready)", href: textHref(q.phone, q.name, draft) }, { label: "Quote", href: `/money/#/doc/${q.doc}` }] : [{ label: "Quote", href: `/money/#/doc/${q.doc}` }] });
    }
  }

  // Deposits unpaid: the booking is tentative
  for (const d of docs) {
    if (d.archived || d.kind !== "invoice" || !d.isDeposit || d.state === "paid" || d.state === "draft") continue;
    const ph = mob(d.client?.phone), when = d.serviceDate ? ` · clean ${fmtDay(d.serviceDate)}` : "";
    const draft = `Hi ${first(d.client?.name)}, Jack from Bardon Clean. Just a reminder the deposit locks in your booking. Here's the invoice: ${SITE()}/i/${d.token}`;
    add({ key: "dep:" + d.id + ":" + t, p: d.serviceDate && daysBetween(t, d.serviceDate) <= 7 ? 0 : 2, type: "Deposit unpaid", title: `${d.client?.name || "Client"}: $${Math.round(d.totals.due).toLocaleString("en-AU")} deposit, booking still tentative`, sub: `Invoice #${d.num}${when}`, actions: [...(ph ? [{ label: "Text (draft ready)", href: textHref(ph, d.client?.name, draft) }] : []), { label: "Invoice", href: `/money/#/doc/${d.id}` }] });
  }

  // Per booking: feedback, review requests, unopened reports, add-ons, key dates, prep
  const fbKeys = await s.list("fb/");
  const fbs = Object.fromEntries(await Promise.all(fbKeys.map(async (k) => [k.slice(3), await s.get(k)])));
  for (const b of B) {
    const j = b.j, L = live[b.days[b.days.length - 1].id] || {}, done = b.last < t || (b.last === t && L.done);
    const phone = phoneFor(b.days, docs), fb = fbs[b.key];
    if (fb && fb.mood === "issue" && daysBetween(fb.at.slice(0, 10), t) <= 30) add({ key: "fbi:" + b.key + ":" + fb.at, p: 0, type: "Not happy", title: `${j.client || "Client"} says something's not right`, sub: fb.text || "", actions: [...(phone ? [{ label: "Call", href: `tel:${phone}` }, { label: "Text", href: textHref(phone, j.client) }] : []), ...(j.share ? [{ label: "Their link", href: `/v/${j.share}` }] : [])] });
    if (fb && fb.mood === "happy" && tpl.reviewLink && daysBetween(fb.at.slice(0, 10), t) <= 21 && phone) {
      const draft = `Thanks so much ${first(j.client)}, I'll pass that on to the team. If you have a minute, a Google review really helps a small local business like ours: ${tpl.reviewLink}`;
      add({ key: "rev:" + b.key, p: 3, type: "Ask for a review", title: `${j.client || "Client"} was really happy`, sub: fb.text ? `"${fb.text.slice(0, 120)}"` : "They tapped Really happy.", actions: [{ label: "Text (draft ready)", href: textHref(phone, j.client, draft) }] });
    }
    if (done && j.share && daysBetween(b.last, t) <= 7) {
      const e = await engFor(j.client || "Client");
      if (!e.sessions.some((x) => x.item && x.item.id === "job:" + b.key) && phone) {
        const draft = `Hi ${first(j.client)}, your clean at ${place(j)} is done. Photos and the full report are here: ${SITE()}/v/${j.share}`;
        add({ key: "rep:" + b.key, p: 2, type: "Report not opened", title: `${j.client || "Client"} hasn't opened their report`, sub: `${j.service || "Clean"} · ${place(j)}`, actions: [{ label: "Text (draft ready)", href: textHref(phone, j.client, draft) }] });
      }
    }
    const addons = (await s.get(`addon/${b.key}`)) || [];
    for (const a of addons) {
      if (a.state === "approved" && !a.invoiced) add({ key: "addinv:" + a.id, p: 1, type: "Extra approved", title: `${a.title} ($${a.price}) approved by ${j.client || "the client"}`, sub: "No unpaid invoice to add it to yet. Add it when you invoice.", actions: [{ label: "Quotes & invoices", href: "/money/" }] });
    }
    if (b.last >= t) {
      const kd = await s.get(`keydate/${b.key}`);
      if (kd && kd.date <= b.last) add({ key: "kd:" + b.key + ":" + kd.date, p: 0, type: "Timing", title: `${j.client || "Client"}'s ${kd.what.toLowerCase()} is ${kd.date < b.last ? "before the clean finishes" : "on the last day"}`, sub: `${kd.what}: ${fmtDay(kd.date)} · clean ${fmtDay(b.date)}${b.last !== b.date ? " to " + fmtDay(b.last) : ""}`, actions: phone ? [{ label: "Call", href: `tel:${phone}` }, { label: "Text", href: textHref(phone, j.client) }] : [] });
      const k = kindOf(j.service);
      const started = b.days.some((d) => Object.values((live[d.id] || {}).arrived || {}).some(Boolean));
      if (!started && ["presale", "bond", "deep"].includes(k) && daysBetween(t, b.date) >= 0 && daysBetween(t, b.date) <= 2 && j.share) {
        const pr = (await s.get(`prep/${b.key}`)) || { ticks: {} }, n = Object.keys(pr.ticks || {}).length, of = prepFor(k).length;
        if (n < Math.ceil(of / 2) && phone) {
          const draft = `Hi ${first(j.client)}, Jack from Bardon Clean. Looking forward to ${b.date === t ? "today" : "the clean"}. There's a quick prep list on your link so the team can get straight into it: ${SITE()}/v/${j.share}`;
          add({ key: "prep:" + b.key, p: 3, type: "Prep list", title: `${j.client || "Client"} has ticked ${n} of ${of} prep items`, sub: `Clean ${b.date === t ? "today" : fmtDay(b.date)}`, actions: [{ label: "Text (draft ready)", href: textHref(phone, j.client, draft) }] });
        }
      }
    }
  }

  // Hours and expenses for the books
  const wrap = toWrap({ jobs: roster.jobs, books: C.books }, t, "");
  for (const w of wrap.slice(0, 6)) add({ key: "wrap:" + w.key, p: 3, type: "Log hours", title: `Log actual hours: ${w.j.client || "job"}`, sub: `${w.j.service || ""} · finished ${fmtDay(w.last)}`, actions: [{ label: "Log hours & costs", href: `/books/#/wrap/${w.key}` }] });
  const lastExp = exps[0]?.date || "";
  if (!lastExp || daysBetween(lastExp, t) >= 7) add({ key: "exp:" + t.slice(0, 8) + Math.floor(+t.slice(8) / 7), p: 3, type: "Expenses", title: lastExp ? `No expenses logged since ${fmtDay(lastExp)}` : "No expenses logged yet", sub: "Fuel, products, anything you've paid for.", actions: [{ label: "Add an expense", href: "/books/#/add" }] });

  // Rebook reminders, summarised
  const rb = await rebook(s, C);
  if (rb.length) add({ key: "rbk:" + t, p: 4, type: "Rebook", title: `${rb.length} past client${rb.length === 1 ? "" : "s"} worth a nudge`, sub: rb.slice(0, 3).map((x) => x.name).join(", "), actions: [{ label: "See them", href: "#rebook" }] });

  out.sort((a, b) => a.p - b.p);
  return { today: t, items: out };
}

// ================= Bookings panel =================
export async function jobsPanel(s) {
  const C = await ctx(s), { live, B, t, docs, plus } = C;
  const list = B.filter((b) => b.last >= addDays(t, -10) && b.date <= addDays(t, 21)).sort((a, b) => a.date.localeCompare(b.date));
  const out = [];
  for (const b of list) {
    const j = b.j, k = kindOf(j.service), ak = addrKey(j);
    const [prep, kd, so, addons, mom, al, entry, vt, ref, home, fb, hide, acc] = await Promise.all([
      s.get(`prep/${b.key}`), s.get(`keydate/${b.key}`), s.get(`signoff/${b.key}`), s.get(`addon/${b.key}`), s.get(`moment/${b.key}`), s.get(`alerts/${b.key}`),
      s.get(`entry/${b.key}`), s.get(`vsharejob/${b.key}`), s.get(`refby/${b.key}`), ak ? s.get(`home/${ak}`) : null, s.get(`fb/${b.key}`), s.get(`etahide/${b.key}`), s.get(`access/${b.key}`),
    ]);
    const L = live[b.days[b.days.length - 1].id] || {};
    out.push({
      key: b.key, job: j.id, client: j.client || "", address: place(j), suburb: j.suburb || "", service: j.service || "", kind: k,
      date: b.date, last: b.last, share: j.share || "", phone: phoneFor(b.days, docs),
      phase: L.done || b.last < t ? "done" : Object.keys(L.arrived || {}).length ? "live" : "booked",
      prep: { n: Object.keys((prep && prep.ticks) || {}).length, of: prepFor(k).length, ticked: prepFor(k).filter(([id]) => prep && prep.ticks && prep.ticks[id]).map((x) => x[1]) },
      keydate: kd || null, signoff: so || null, addons: addons || [], moments: mom || [], alerts: !!al, entry: entry || [],
      viewLink: vt ? `/s/${vt}` : "", ref: ref || "", prefs: (home && home.prefs) || "", feedback: fb ? { mood: fb.mood, text: fb.text } : null,
      etaHidden: !!hide, access: !!acc, done: !!L.done,
    });
  }
  return { today: t, jobs: out, settings: { showEta: plus.showEta, alertsOn: plus.alertsOn } };
}

// ================= Pricing calibration =================
export async function calibrate(s) {
  const C = await ctx(s), { roster, rawLive, B, books, plus, t, docs } = C;
  const qt = quoteTotals(docs);
  const area = {}, kinds = {};
  for (const b of B) {
    if (b.last >= t) continue;
    // Areas: when the team marked them started and done (recorded from now on).
    const home = rawLive[b.days[0].id] || {};
    for (const [r, x] of Object.entries(home.rooms || {})) {
      if (!x || x.s !== "d" || !x.st) continue;
      const hrs = (Date.parse(x.at) - Date.parse(x.st)) / 3600e3;
      if (!(hrs > 0.05 && hrs < 12)) continue;
      const people = Math.max(1, ((home.assign || {})[r] || []).length);
      (area[areaKey(r)] ||= []).push(hrs * people);
    }
    // Whole jobs: forecast person-hours from the area estimates vs actual hours worked.
    const rooms = b.j.rooms && b.j.rooms.length ? b.j.rooms : [];
    if (!rooms.length) continue;
    const fc = rooms.reduce((n, r) => n + (Number(plus.areaHours[areaKey(r)]) || 1.5), 0);
    let act = 0;
    const a = books.actuals[b.key];
    if (a && a.staff) act = Object.values(a.staff).reduce((n, v) => n + v, 0);
    else for (const d of b.days) { const L = rawLive[d.id] || {}; for (const [pid, at] of Object.entries(L.arrived || {})) { const h = clockedHours(at, (L.left || {})[pid], true); if (h) act += h; } }
    if (!(act > 0.5)) continue;
    const pr = priceOf(b, books, qt).price;
    const k = kindOf(b.j.service);
    (kinds[k] ||= []).push({ fc, act, price: pr, gst: true, client: b.j.client || "", date: b.last });
  }
  const med = (a) => { const x = a.slice().sort((p, q) => p - q); const m = Math.floor(x.length / 2); return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
  const areas = Object.keys(AREA_LABEL).map((k) => {
    const v = area[k] || [];
    return { key: k, label: AREA_LABEL[k], est: plus.areaHours[k], n: v.length, actual: v.length ? r2(med(v)) : null, suggest: v.length >= 2 ? Math.round(med(v) * 4) / 4 : null };
  });
  const set = await loadSettings(s);
  const gstReg = set.gst !== false;
  const byKind = Object.entries(kinds).map(([k, v]) => {
    const priced = v.filter((x) => x.price != null);
    const rate = priced.length ? r2(priced.reduce((n, x) => n + (gstReg ? x.price / 1.1 : x.price), 0) / priced.reduce((n, x) => n + x.act, 0)) : null;
    return { kind: k, n: v.length, fc: r2(v.reduce((n, x) => n + x.fc, 0) / v.length), act: r2(v.reduce((n, x) => n + x.act, 0) / v.length), rate, recent: v.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((x) => ({ client: x.client, date: x.date, fc: r2(x.fc), act: r2(x.act), rate: x.price != null ? r2((gstReg ? x.price / 1.1 : x.price) / x.act) : null })) };
  });
  return { areas, kinds: byKind, target: books.pricing.targetRate };
}

// ================= Lead sources =================
export async function sources(s, days = 90) {
  const C = await ctx(s), { roster, docs, books, B, t } = C;
  const from = addDays(t, -days);
  const reqs = (await loadRequests(s)).filter((r) => r.at.slice(0, 10) >= from);
  const qById = Object.fromEntries(docs.filter((d) => d.kind === "quote").map((d) => [d.id, d]));
  const qt = quoteTotals(docs);
  const row = (m, k) => (m[k] ||= { source: k, leads: 0, quoted: 0, won: 0, revenue: 0 });
  const m = {};
  for (const r of reqs) {
    const heard = (lines(r).find((x) => x[0] === "Found us") || [])[1];
    const k = r.refBy ? "Referral from a client link" : heard || (r.src && r.src !== "client-link" ? `Link: ${r.src}` : r.src === "client-link" ? "Client link (book again)" : "Not given");
    const x = row(m, k); x.leads++;
    const q = r.quoteId && qById[r.quoteId];
    if (q) { x.quoted++; if (q.state === "accepted") { x.won++; x.revenue += q.totals.total; } }
  }
  // Agent bookings: every booking tagged to an agent in the period
  const agents = Object.fromEntries((roster.agents || []).map((a) => [a.id, a]));
  for (const b of B) {
    if (!b.j.agentId || b.date < from || b.date > t) continue;
    const a = agents[b.j.agentId], x = row(m, `Agent: ${a ? a.name + (a.agency ? ", " + a.agency : "") : "agent"}`);
    x.leads++; x.won++; x.revenue += priceOf(b, books, qt).price || 0;
  }
  const exps = (await loadExpenses(s)).filter((e) => e.cat === "Marketing" && e.date >= from);
  const fixedMk = books.fixed.filter((f) => f.cat === "Marketing").reduce((n, f) => n + dueDates(f, from, t).length * f.amt, 0);
  return { days, from, rows: Object.values(m).map((x) => ({ ...x, revenue: Math.round(x.revenue) })).sort((a, b) => b.revenue - a.revenue || b.leads - a.leads), marketing: Math.round(exps.reduce((n, e) => n + e.amt, 0) + fixedMk), marketingItems: exps.slice(0, 10).map((e) => ({ date: e.date, amt: e.amt, note: e.note || e.who || "" })) };
}

// ================= Agents =================
export async function agentsCard(s) {
  const C = await ctx(s), { roster, docs, books, B, t } = C;
  const idx = await loadIndex(s), qt = quoteTotals(docs);
  return (roster.agents || []).map((a) => {
    const bs = B.filter((b) => b.j.agentId === a.id && !b.j.sample);
    const past = bs.filter((b) => b.date <= t), next = bs.filter((b) => b.date > t).sort((x, y) => x.date.localeCompare(y.date))[0];
    const ph = mob(a.phone), last = ph && idx[ph] ? idx[ph].lastAt : "";
    const ago = last ? daysBetween(last.slice(0, 10), t) : null;
    return {
      id: a.id, name: a.name, agency: a.agency || "", jobs: past.length, upcoming: bs.length - past.length,
      revenue: Math.round(bs.reduce((n, b) => n + (priceOf(b, books, qt).price || 0), 0)), lastJob: past.length ? past.sort((x, y) => y.date.localeCompare(x.date))[0].date : "",
      next: next ? next.date : "", lastContact: last, nudge: bs.length > 0 && (ago == null || ago >= 21), phone: ph, token: a.token || "",
    };
  }).sort((x, y) => y.revenue - x.revenue);
}

// ================= Capacity, next four weeks =================
export async function capacity(s) {
  const C = await ctx(s), { roster, docs, B, set, t } = C;
  const free = new Set(await freeDates(s, set).catch(() => []));
  const per = Number((set.booking || {}).perDay) || 2, ph = new Set(QLD_PH);
  const deps = docs.filter((d) => d.kind === "invoice" && d.isDeposit && !d.archived);
  const tentative = (b) => {
    const ids = new Set(b.days.map((d) => d.id));
    const q = docs.find((d) => d.kind === "quote" && ids.has(d.jobId));
    const dep = q && deps.find((d) => d.quoteId === q.id);
    return !!(dep && dep.state !== "paid");
  };
  const reqs = (await loadRequests(s)).filter((r) => r.status === "new" && r.date && r.date >= t);
  const out = [];
  for (let n = 0; n < 28; n++) {
    const d = addDays(t, n), dow = new Date(d + "T00:00:00Z").getUTCDay();
    const on = B.filter((b) => b.days.some((x) => x.date === d));
    out.push({
      date: d, dow, closed: dow === 0 || ph.has(d), free: free.has(d) || (n === 0 && on.length < per && dow !== 0),
      jobs: on.map((b) => ({ client: b.j.client || "", service: b.j.service || "", suburb: b.j.suburb || "", tentative: tentative(b), multi: b.days.length > 1 })),
      wanted: reqs.filter((r) => r.date === d).map((r) => ({ name: r.name, id: r.id })),
    });
  }
  return { perDay: per, days: out };
}

// ================= Cash ahead =================
export async function cash(s) {
  const C = await ctx(s), { roster, docs, books, set, plus, t } = C;
  const live = docs.filter((d) => !d.archived);
  const inv = live.filter((d) => d.kind === "invoice" && d.state !== "paid" && d.state !== "draft");
  const owing = inv.filter((d) => !d.isDeposit), deps = inv.filter((d) => d.isDeposit);
  // Booked but not fully invoiced yet: accepted quotes for cleans still to come.
  const toInvoice = [];
  for (const q of live.filter((d) => d.kind === "quote" && d.state === "accepted" && d.jobId)) {
    const j = roster.jobs.find((x) => x.id === q.jobId);
    if (!j || j.date < t) continue;
    const billed = live.filter((d) => d.kind === "invoice" && (d.quoteId === q.id || d.jobId === q.jobId)).reduce((n, d) => n + d.totals.total, 0);
    const left = r2(q.totals.total - billed);
    if (left > 1) toInvoice.push({ name: q.client?.name || "", date: j.date, amt: left });
  }
  const to14 = addDays(t, 13);
  const wages = shiftCosts(roster.jobs, roster.team, roster.pay, t, to14).reduce((n, x) => n + x.pay + x.sup, 0);
  const bills = [];
  for (const f of books.fixed) for (const d of dueDates(f, t, to14)) bills.push({ name: f.name, date: d, amt: f.amt });
  const gstReg = set.gst !== false, qs = qStartOf(t), fy = fyStartOf(t);
  const exps = await loadExpenses(s);
  let gstIn = 0;
  for (const d of docs) if (d.gst) for (const p of d.payments || []) if (p.date >= qs && p.date <= t) gstIn += p.amt / 11;
  const gstOut = exps.filter((e) => e.date >= qs && e.date <= t).reduce((n, e) => n + (e.gst || 0), 0)
    + books.fixed.filter((f) => f.gst).reduce((n, f) => n + dueDates(f, qs, t).length * f.amt / 11, 0);
  const D = { jobs: roster.jobs, team: roster.team, pay: roster.pay, books, expenses: exps, quoteTotals: quoteTotals(docs), gstReg, payments: [] };
  const p = pnl(D, fy, t);
  const taxPct = plus.taxPct != null ? plus.taxPct : books.pricing.tax;
  const sum = (a, f) => r2(a.reduce((n, x) => n + f(x), 0));
  return {
    today: t,
    in: {
      owing: sum(owing, (d) => d.totals.due), overdue: sum(owing.filter((d) => d.state === "overdue"), (d) => d.totals.due),
      owingList: owing.slice(0, 12).map((d) => ({ name: d.client?.name || "", num: d.num, due: d.totals.due, dueDate: d.dueDate || "", state: d.state, id: d.id })),
      deposits: sum(deps, (d) => d.totals.due), depositsN: deps.length, toInvoice: sum(toInvoice, (x) => x.amt), toInvoiceList: toInvoice.slice(0, 12),
    },
    out: { wages: r2(wages), bills: sum(bills, (b) => b.amt), billList: bills.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 15), to: to14 },
    gst: gstReg ? { from: qs, collected: r2(gstIn), credits: r2(gstOut), net: r2(gstIn - gstOut) } : null,
    tax: { from: fy, profit: r2(p.profit), pct: taxPct, setAside: r2(Math.max(0, p.profit) * taxPct / 100) },
  };
}

// ================= Rebook reminders =================
export async function rebook(s, C0) {
  const C = C0 || (await ctx(s)), { B, t, docs, plus } = C;
  const done = (await s.get("plus/rebookdone")) || {};
  const out = [];
  const later = (b) => B.some((x) => x !== b && x.date > b.last && ((addrKey(x.j) && addrKey(x.j) === addrKey(b.j)) || (x.j.client && x.j.client === b.j.client)));
  for (const b of B) {
    const j = b.j, k = kindOf(j.service), ago = daysBetween(b.last, t);
    if (b.last >= t || j.rec || later(b)) continue;
    let why = "", draft = "";
    if (k === "deep" && ago >= plus.deepMonths * 30 - 14 && ago <= plus.deepMonths * 30 + 60) {
      why = `Deep clean ${Math.round(ago / 30)} months ago`;
      draft = `Hi ${first(j.client)}, Jack from Bardon Clean. It's been about ${Math.round(ago / 30)} months since your deep clean at ${place(j)}. If you'd like another one booked in, I've got some dates coming up. Just reply here.`;
    } else if ((k === "presale" || k === "bond") && ago >= 3 && ago <= 45) {
      why = k === "presale" ? `Pre-sale clean ${ago} days ago, may be moving` : `Bond clean ${ago} days ago, moving house`;
      draft = `Hi ${first(j.client)}, Jack from Bardon Clean. Hope the move is going smoothly. If your new place needs a clean before you unpack, we'd love to help. Just reply here and I'll send through some options.`;
    } else continue;
    const key = b.key + ":" + k;
    if (done[key]) continue;
    const phone = phoneFor(b.days, docs);
    out.push({ key, name: j.client || "Client", why, phone, draft, href: phone ? textHref(phone, j.client, draft) : "", date: b.last });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// ================= Content queue =================
export async function content(s) {
  const C = await ctx(s), { B, rawLive, t } = C;
  const posted = (await s.get("plus/posted")) || {};
  const out = [];
  const tag = (x) => "#" + String(x || "").toLowerCase().replace(/[^a-z]/g, "");
  for (const b of B.slice().sort((x, y) => y.last.localeCompare(x.last))) {
    if (b.last > t || daysBetween(b.last, t) > 60) continue;
    if (b.last === t && !(rawLive[b.days[0].id] || {}).done) continue; // still being cleaned
    const k = kindOf(b.j.service);
    if (!["presale", "deep", "bond"].includes(k)) continue;
    const L = rawLive[b.days[0].id] || {}, seen = new Set();
    const photos = [];
    for (const d of b.days) for (const p of (rawLive[d.id] || {}).photos || []) photos.push({ ...p, j: p.j || d.id });
    for (const p of (L.photos || [])) if (!photos.some((q) => q.id === p.id)) photos.push({ ...p, j: p.j || b.days[0].id });
    for (const p of photos) {
      if (p.kind !== "after" || !p.room || seen.has(p.room)) continue;
      seen.add(p.room);
      const area = p.room, svc = b.j.service || "Clean", sub = b.j.suburb || "Brisbane";
      out.push({
        id: p.id, j: p.j, src: `/api/photo?j=${encodeURIComponent(p.j)}&p=${p.id}`, area, service: svc, suburb: sub, date: b.last, posted: posted[p.id] || "",
        ig: `${area}, ${sub}. ${svc} by the Bardon Clean team.\n\n#bardonclean #brisbane ${tag(sub)} ${k === "presale" ? "#presaleclean #sellingyourhome" : k === "bond" ? "#bondclean #endofleaseclean" : "#deepclean"} #brisbanecleaning`,
        gbp: `${svc} in ${sub}: the ${area.toLowerCase()} after our team finished. Request a quote at bardonclean.au/quote`,
      });
      if (out.length >= 40) break;
    }
    if (out.length >= 40) break;
  }
  return out;
}
