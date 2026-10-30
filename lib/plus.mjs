// Client link extras: everything a client sees and does on their link beyond the
// live clean itself. Before the clean (steps, prep list, key date), on the day
// (moments feed, finish window, add-ons, opt-in alerts), after (sign-off, bond
// entry report, referral link, home file), and a view-only copy to share.
//
// Storage, per booking (bk = job.group || job.id):
//   prep/<bk>     { ticks: { id: iso } }
//   keydate/<bk>  { date, what, at }
//   signoff/<bk>  { at, name }
//   addon/<bk>    [ { id, title, note, price, state, at, decidedAt, invoiced } ]
//   moment/<bk>   [ { id, t, at, by } ]            short updates Jack (or the team) posts
//   alerts/<bk>   { phone, at }                    client opted in to arrive / finish texts
//   entry/<bk>    [ { id, name, type, size, at } ] + entryf/<bk>/<id> (the file)
//   vsharejob/<bk> -> token, vshare/<token> -> { bk }     view-only link
//   refby/<bk> -> code, ref/<code> -> { bk, name, suburb, at }
//   home/<addrKey> { prefs, at }
//   plus/settings  see SETTINGS
import { randomBytes } from "node:crypto";

export const SETTINGS = {
  areaHours: { kitchen: 4, bathroom: 3, toilet: 0.5, laundry: 1, living: 2, bedroom: 2, window: 2, outdoor: 1.5, entry: 1, other: 1.5 },
  showEta: true,
  alertsOn: false,
  alertArrive: "Hi {first}, the Bardon Clean team has arrived at {place}. Follow along on your link: {link}",
  alertFinish: "Hi {first}, your clean at {place} is finished. Photos and the full report are on your link: {link}",
  taxPct: null, // falls back to the money settings (books.pricing.tax)
  deepMonths: 6,
};
export const AREA_LABEL = { kitchen: "Kitchen", bathroom: "Bathroom", toilet: "Separate toilet", laundry: "Laundry", living: "Living & dining", bedroom: "Bedrooms", window: "Windows & tracks", outdoor: "Outdoor, deck & garage", entry: "Entry, halls & stairs", other: "Any other area" };

export async function loadPlusSettings(s) {
  const x = (await s.get("plus/settings")) || {};
  return { ...SETTINGS, ...x, areaHours: { ...SETTINGS.areaHours, ...(x.areaHours || {}) } };
}
export function cleanPlusSettings(b, prev) {
  const o = { ...prev };
  if (b.areaHours && typeof b.areaHours === "object") {
    o.areaHours = { ...prev.areaHours };
    for (const k of Object.keys(SETTINGS.areaHours)) { const v = Number(b.areaHours[k]); if (isFinite(v) && v >= 0 && v <= 40) o.areaHours[k] = Math.round(v * 4) / 4; }
  }
  if (typeof b.showEta === "boolean") o.showEta = b.showEta;
  if (typeof b.alertsOn === "boolean") o.alertsOn = b.alertsOn;
  for (const k of ["alertArrive", "alertFinish"]) if (typeof b[k] === "string" && b[k].trim()) o[k] = b[k].trim().slice(0, 400);
  if (b.taxPct === null || b.taxPct === "") o.taxPct = null; else if (b.taxPct !== undefined) { const v = Number(b.taxPct); if (isFinite(v) && v >= 0 && v <= 60) o.taxPct = v; }
  if (b.deepMonths !== undefined) { const v = Math.round(Number(b.deepMonths)); if (v >= 1 && v <= 24) o.deepMonths = v; }
  return o;
}

export const areaKey = (name) => {
  const n = String(name || "").toLowerCase();
  if (/kitchen|pantry/.test(n)) return "kitchen";
  if (/toilet|\bwc\b|powder/.test(n)) return "toilet";
  if (/bath|ensuite|shower/.test(n)) return "bathroom";
  if (/laundry/.test(n)) return "laundry";
  if (/living|dining|lounge|family|rumpus|media|study/.test(n)) return "living";
  if (/bed/.test(n)) return "bedroom";
  if (/window|track/.test(n)) return "window";
  if (/outdoor|garage|deck|balcon|patio|verandah|yard/.test(n)) return "outdoor";
  if (/entry|hall|stair/.test(n)) return "entry";
  return "other";
};

export const kindOf = (svc) => { const s = String(svc || ""); return /bond|lease|vacate/i.test(s) ? "bond" : /pre.?sale/i.test(s) ? "presale" : /deep|move.?in/i.test(s) ? "deep" : /regular/i.test(s) ? "regular" : "other"; };
const BNE = 10 * 3600e3;
export const bneToday = () => new Date(Date.now() + BNE).toISOString().slice(0, 10);
const hhmm = (ms) => new Date(ms + BNE).toISOString().slice(11, 16);
const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").trim().slice(0, n) : "");
export const rid = (p = "") => p + randomBytes(5).toString("hex");
export const addrKey = (j) => {
  const a = String(j.address || "").toLowerCase().replace(/^sample:\s*/, "").replace(/\b(street|st|road|rd|terrace|tce|avenue|ave|drive|dr|court|ct|place|pl|crescent|cres|lane|ln|parade|pde)\b\.?/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return a ? (a + "|" + String(j.suburb || "").toLowerCase().trim()).slice(0, 120) : "";
};

// ---- prep lists, by kind of clean ----
export const PREP = {
  presale: [
    ["benches", "Benchtops and surfaces cleared", "The less on them, the more we can polish."],
    ["bath", "Toiletries and personal items out of bathrooms", "Toothbrushes, razors, bottles in the shower."],
    ["private", "Valuables, mail and paperwork put away", "Nothing private in photos either."],
    ["stays", "Anything that's staying is in its final spot", "So we clean around it once, not twice."],
    ["power", "Power and water on", "We need both to clean."],
    ["date", "Open home or photo date added below", "So we can make sure we finish in time."],
  ],
  bond: [
    ["out", "Furniture and belongings out", "The clean goes best in an empty home."],
    ["bins", "Bins emptied and rubbish gone", "Including the garage and yard."],
    ["report", "Entry condition report ready", "Upload it below and we'll lay our report out against it."],
    ["power", "Power and water still connected", "Please don't disconnect until after the clean."],
    ["keys", "Key arrangement sorted", "Add it in the access details."],
    ["date", "Key handover or inspection date added below", ""],
  ],
  deep: [
    ["floors", "Floors and benches as clear as you can make them", "More clear space means more time on the detail."],
    ["private", "Valuables and paperwork put away", ""],
    ["pets", "Pets sorted for the day", "Add any details in the access section."],
    ["focus", "Your focus areas in the access notes", "Anything you want extra attention on."],
    ["power", "Power and water on", ""],
  ],
  other: [
    ["clear", "Benches and floors as clear as you can make them", ""],
    ["private", "Valuables and paperwork put away", ""],
    ["pets", "Pets sorted for the day", ""],
  ],
};
export const prepFor = (kind) => PREP[kind] || PREP.other;
export const KEYDATE = { presale: ["First open home", "Photography", "Styling", "Something else"], bond: ["Key handover", "Exit inspection", "Something else"], deep: ["Guests arriving", "Moving in", "Event at home", "Something else"], other: ["Something on that day", "Something else"] };

// ---- a booking's days, as one ----
const dayList = (roster, job) => (job.group ? roster.jobs.filter((x) => x.group === job.group) : [job]).slice().sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || "")));

// ---- finish window: from the area estimates, the areas still to do and who's on site ----
export function finishWindow(job, L, set, now = Date.now()) {
  if (!L || L.done) return null;
  if (L.eta) return { set: L.eta };
  const arrivedIds = Object.keys(L.arrived || {}).filter((id) => L.arrived[id] && !(L.left || {})[id]);
  if (!arrivedIds.length) return null;
  const rooms = job.rooms && job.rooms.length ? job.rooms : [];
  let left = 0;
  for (const r of rooms) {
    const st = L.rooms && L.rooms[r] && L.rooms[r].s;
    const h = Number(set.areaHours[areaKey(r)]) || 1.5;
    if (st === "d") continue;
    left += st === "p" ? h * 0.5 : h;
  }
  if (!left) return { from: hhmm(now + 15 * 60e3), to: hhmm(now + 45 * 60e3) };
  const hrs = left / arrivedIds.length;
  const q = (ms) => Math.round(ms / (15 * 60e3)) * 15 * 60e3;
  const from = q(now + hrs * 3600e3), to = from + 45 * 60e3;
  return { from: hhmm(from), to: hhmm(to) };
}

// ---- moments feed: everything that's happened on the job, newest first ----
export function moments(view, posted = []) {
  const L = view.live || {}, out = [], name = (id) => (view.team.find((t) => t.id === id) || {}).name || "The team";
  for (const [id, at] of Object.entries(L.arrived || {})) if (at) out.push({ k: "arrive", at, t: `${name(id)} arrived` });
  for (const [r, x] of Object.entries(L.rooms || {})) {
    if (!x) continue;
    if (x.st) out.push({ k: "start", at: x.st, t: `Started on the ${r.toLowerCase()}` });
    if (x.s === "p" && !x.st) out.push({ k: "start", at: x.at, t: `Started on the ${r.toLowerCase()}` });
    if (x.s === "d") {
      const ph = (L.photos || []).find((p) => p.room === r && p.kind === "after");
      const n = (L.checks || {})[r] || 0;
      out.push({ k: "done", at: x.at, t: `${r} done`, sub: n ? `${n} check${n === 1 ? "" : "s"} ticked off` : "", room: r, ...(ph ? { photo: { id: ph.id, j: ph.j } } : {}) });
    }
  }
  for (const f of L.flags || []) out.push({ k: "flag", at: f.at, t: `Noted: ${f.t}` });
  for (const m of posted) out.push({ k: "note", at: m.at, t: m.t });
  const lk = Object.values(L.lock || {}).filter(Boolean).sort();
  if (lk.length) out.push({ k: "lock", at: lk[lk.length - 1], t: "Locked up and handover checks done" });
  if (L.done) out.push({ k: "ready", at: L.done, t: "Ready. Final checks complete." });
  return out.filter((m) => m.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
}

// ---- what the client's link gets on top of the job view ----
export async function clientExtras(s, roster, job, view, opts = {}) {
  const bk = job.group || job.id, kind = kindOf(job.service);
  const [set, prep, keydate, signoff, addons, posted, alerts, entry, ref, vtok] = await Promise.all([
    loadPlusSettings(s), s.get(`prep/${bk}`), s.get(`keydate/${bk}`), s.get(`signoff/${bk}`), s.get(`addon/${bk}`),
    s.get(`moment/${bk}`), s.get(`alerts/${bk}`), s.get(`entry/${bk}`), s.get(`refby/${bk}`), s.get(`vsharejob/${bk}`),
  ]);
  const days = dayList(roster, job), t = bneToday();
  const ak = addrKey(job), home = ak ? await s.get(`home/${ak}`) : null;
  // Other cleans at the same home, with a link to their report when there is one.
  const hist = [];
  if (ak) {
    const seen = new Set([bk]);
    for (const j of roster.jobs.slice().sort((a, b) => b.date.localeCompare(a.date))) {
      const k = j.group || j.id;
      if (j.sample || seen.has(k) || addrKey(j) !== ak || j.date > t) continue;
      seen.add(k);
      hist.push({ date: j.date, service: j.service || "Clean", ...(opts.viewer ? {} : j.share ? { href: `/v/${j.share}` } : {}) });
      if (hist.length >= 12) break;
    }
  }
  const hideEta = !set.showEta || !!(await s.get(`etahide/${bk}`));
  const L = view.live || {};
  const out = {
    kind, today: t, firstDay: days[0].date, lastDay: days[days.length - 1].date,
    moments: moments(view, posted || []),
    // Only on a day the team is actually on site (the view's day is today's day when there is one).
    finish: hideEta || job.date !== t ? null : finishWindow({ rooms: view.rooms }, { ...(opts.raw || L), rooms: L.rooms, eta: L.eta, done: L.done }, set),
    history: hist,
  };
  if (opts.viewer) return { ...out, viewer: true };
  return {
    ...out,
    prep: { items: prepFor(kind).map(([id, t, d]) => ({ id, t, d })), ticks: { ...((prep && prep.ticks) || {}), ...(keydate && prepFor(kind).some((x) => x[0] === "date") ? { date: keydate.at } : {}) } },
    keydate: keydate || null, keyOpts: KEYDATE[kind] || KEYDATE.other,
    signoff: signoff || null,
    addons: (addons || []).map(({ id, title, note, price, state, at, decidedAt, photo }) => ({ id, title, note, price, state, at, decidedAt, ...(photo ? { photo } : {}) })),
    alerts: set.alertsOn ? { on: !!alerts, phone: alerts ? alerts.phone.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3") : "" } : null,
    entry: (entry || []).map(({ id, name, type, at }) => ({ id, name, type, at })),
    ref: ref ? `/quote?src=ref-${ref}` : "",
    viewLink: vtok ? `/s/${vtok}` : "",
    prefs: (home && home.prefs) || "",
  };
}

// ---- actions from the client's own link ----
export const DATA_URL = /^data:([\w/+.-]+);base64,(.+)$/s;
const OK_TYPES = { "image/jpeg": 1, "image/png": 1, "image/heic": 1, "image/webp": 1, "application/pdf": 1 };
export async function clientAction(s, roster, job, b, { notify, where, sendSms, auMobile }) {
  const bk = job.group || job.id, kind = kindOf(job.service), now = new Date().toISOString();
  switch (b.action) {
    case "x-prep": {
      const ids = prepFor(kind).map((x) => x[0]), id = String(b.id || "");
      if (!ids.includes(id)) return { error: "Unknown item" };
      const rec = (await s.get(`prep/${bk}`)) || { ticks: {} };
      if (b.value) rec.ticks[id] = now; else delete rec.ticks[id];
      await s.set(`prep/${bk}`, rec);
      return { ok: true, ticks: rec.ticks };
    }
    case "x-keydate": {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : "";
      if (!date) { await s.del(`keydate/${bk}`); return { ok: true, keydate: null }; }
      const what = str(b.what, 60) || "Something on that day";
      const rec = { date, what, at: now };
      const prev = await s.get(`keydate/${bk}`);
      await s.set(`keydate/${bk}`, rec);
      const days = dayList(roster, job), last = days[days.length - 1].date;
      const clash = date < last ? "before the clean finishes" : date === last ? "on the last day of the clean" : "";
      if (!prev || prev.date !== date || clash) await notify(s, { type: "access", title: `${clash ? "Check timing: " : ""}${what} ${date} · ${where(job)}`, body: clash ? `The client's ${what.toLowerCase()} is ${clash}.` : `The client added their ${what.toLowerCase()}.`, tags: clash ? "warning" : "calendar", priority: clash ? 5 : 2, url: "/desk/" });
      return { ok: true, keydate: rec };
    }
    case "x-signoff": {
      const days = dayList(roster, job);
      if (days[days.length - 1].date > bneToday()) return { error: "You can sign off once the clean is finished." };
      const prev = await s.get(`signoff/${bk}`);
      if (prev) return { ok: true, signoff: prev };
      const rec = { at: now, name: str(b.name, 80) };
      await s.set(`signoff/${bk}`, rec);
      await notify(s, { type: "feedback", title: `Signed off: ${where(job)}`, body: `${rec.name || "The client"} tapped "I'm happy with the clean".`, tags: "white_check_mark", url: "/desk/" });
      return { ok: true, signoff: rec };
    }
    case "x-addon": {
      const list = (await s.get(`addon/${bk}`)) || [], a = list.find((x) => x.id === b.id);
      if (!a) return { error: "That extra isn't there any more." };
      if (a.state !== "pending") return { ok: true, addons: list };
      a.state = b.decision === "yes" ? "approved" : "declined"; a.decidedAt = now;
      await s.set(`addon/${bk}`, list);
      await notify(s, { type: "feedback", title: `${a.state === "approved" ? "Approved" : "Declined"}: ${a.title} · ${where(job)}`, body: a.state === "approved" ? `$${a.price} approved. Tell the team to go ahead.` : "The client said no thanks.", tags: a.state === "approved" ? "moneybag" : "x", priority: 5, url: "/desk/" });
      if (a.state === "approved") await addToInvoice(s, roster, job, a).catch(() => {});
      return { ok: true, addons: list };
    }
    case "x-alerts": {
      const set = await loadPlusSettings(s);
      if (!set.alertsOn) return { error: "Text updates aren't switched on." };
      if (!b.on) { await s.del(`alerts/${bk}`); return { ok: true, alerts: { on: false, phone: "" } }; }
      const phone = auMobile(b.phone);
      if (!phone) return { error: "That isn't an Australian mobile number." };
      await s.set(`alerts/${bk}`, { phone, at: now });
      return { ok: true, alerts: { on: true, phone: phone.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3") } };
    }
    case "x-share": {
      let tk = await s.get(`vsharejob/${bk}`);
      if (!tk) { tk = randomBytes(15).toString("hex"); await s.set(`vsharejob/${bk}`, tk); await s.set(`vshare/${tk}`, { bk, at: now }); }
      return { ok: true, link: `/s/${tk}` };
    }
    case "x-ref": {
      let code = await s.get(`refby/${bk}`);
      if (!code) { code = randomBytes(4).toString("hex"); await s.set(`refby/${bk}`, code); await s.set(`ref/${code}`, { bk, name: job.client || "", suburb: job.suburb || "", at: now }); }
      return { ok: true, link: `/quote?src=ref-${code}` };
    }
    case "x-prefs": {
      const ak = addrKey(job);
      if (!ak) return { error: "No address on this booking." };
      const prefs = str(b.prefs, 1200);
      await s.set(`home/${ak}`, { prefs, at: now, by: "client" });
      await notify(s, { type: "access", title: `Home preferences updated: ${where(job)}`, body: prefs.slice(0, 300) || "(cleared)", tags: "house", priority: 2, url: "/desk/" });
      return { ok: true, prefs };
    }
    case "x-entry": {
      const list = (await s.get(`entry/${bk}`)) || [];
      if (list.length >= 12) return { error: "That's the most files we can hold. Text Jack the rest." };
      const m = DATA_URL.exec(String(b.data || ""));
      if (!m || !OK_TYPES[m[1]]) return { error: "Upload a PDF or a photo." };
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > 4.5 * 1024 * 1024) return { error: "That file is too big. Try a photo of each page instead." };
      const id = rid("e");
      await s.setBin(`entryf/${bk}/${id}`, buf);
      list.push({ id, name: str(b.name, 100) || (m[1] === "application/pdf" ? "Entry report.pdf" : "Entry report photo"), type: m[1], size: buf.length, at: now });
      await s.set(`entry/${bk}`, list);
      if (list.length === 1) await notify(s, { type: "access", title: `Entry condition report uploaded: ${where(job)}`, body: "It's on the booking in the desk.", tags: "page_facing_up", priority: 2, url: "/desk/" });
      return { ok: true, entry: list.map(({ id, name, type, at }) => ({ id, name, type, at })) };
    }
    case "x-entry-del": {
      const list = ((await s.get(`entry/${bk}`)) || []).filter((x) => x.id !== b.id);
      await s.set(`entry/${bk}`, list); await s.del(`entryf/${bk}/${String(b.id || "").replace(/[^\w]/g, "")}`);
      return { ok: true, entry: list.map(({ id, name, type, at }) => ({ id, name, type, at })) };
    }
  }
  return null;
}

// Approved extra: add it to the booking's unpaid final invoice if there is one; otherwise
// it waits in the desk ("Add to invoice").
export async function addToInvoice(s, roster, job, a) {
  const { loadDocs, saveDoc } = await import("./docs.mjs");
  const ids = new Set(dayList(roster, job).map((d) => d.id));
  const docs = await loadDocs(s);
  const quoteIds = new Set(docs.filter((d) => d.kind === "quote" && ids.has(d.jobId)).map((d) => d.id));
  const inv = docs.find((d) => d.kind === "invoice" && !d.archived && !d.isDeposit && d.state !== "paid" && (ids.has(d.jobId) || (d.quoteId && quoteIds.has(d.quoteId))));
  if (!inv) return false;
  const raw = await s.get(`doc/${inv.id}`); if (!raw) return false;
  raw.items = [...(raw.items || []), { title: a.title, desc: a.note || "Approved by you on your clean link.", qty: 1, price: a.price }];
  await saveDoc(s, raw);
  const bk = job.group || job.id, list = (await s.get(`addon/${bk}`)) || [], x = list.find((y) => y.id === a.id);
  if (x) { x.invoiced = inv.id; await s.set(`addon/${bk}`, list); }
  return true;
}

// ---- opt-in text alerts (only when Jack has switched them on) ----
export async function milestoneText(s, roster, job, what, { sendSms }) {
  const set = await loadPlusSettings(s);
  if (!set.alertsOn) return;
  const bk = job.group || job.id, a = await s.get(`alerts/${bk}`);
  if (!a || !a.phone) return;
  const sentKey = `alertsent/${bk}/${what}/${what === "arrive" ? job.date : "x"}`;
  if (await s.get(sentKey)) return;
  await s.set(sentKey, { at: new Date().toISOString() });
  const SITE = (process.env.URL || "https://bardon-roster.netlify.app").replace(/\/$/, "");
  const fill = (t) => t.replace(/\{first\}/g, String(job.client || "there").split(/\s+/)[0]).replace(/\{place\}/g, String(job.address || job.suburb || "your place").replace(/^Sample:\s*/, "")).replace(/\{link\}/g, job.share ? `${SITE}/v/${job.share}` : SITE);
  await sendSms(a.phone, fill(what === "arrive" ? set.alertArrive : set.alertFinish), `alert-${what}`, { name: job.client || "" });
}
