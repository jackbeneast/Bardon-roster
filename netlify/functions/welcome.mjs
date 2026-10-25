// Onboarding: one personal welcome link per new starter (/w/<token>) that holds
// everything they need — contract, new starter form, their shift and first-day
// info — with each step ticking itself as they do it. Jack runs it from the hub's
// Onboarding section and texts each step from the business number.
//   GET  (public) ?t=<welcome token>            their welcome page data
//   GET  (admin)                                { people } everyone in trial or onboarding
//   POST (admin)  { action: "add", name, phone, email?, trialDate? }   a new starter who didn't apply online
//                 { action: "prep", id }        make their links (contract, form, welcome) if missing
//                 { action: "sent", id, step }  log that a step's text went out
//                 { action: "trial", id, trialDate }
import { randomBytes } from "node:crypto";
import { store, json, checkAdmin, loadRoster, loadConfirms, loadAcks, shiftOf, sig } from "../../lib/core.mjs";
import { loadCandidates } from "./careers.mjs";
import { linkOf } from "./contracts.mjs";
import { auMobile } from "../../lib/mm.mjs";

const SITE = () => (process.env.URL || "https://bardon-roster.netlify.app").replace(/\/$/, "");
const str = (v, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const day = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const tok = () => randomBytes(18).toString("hex");
const today = () => new Date(Date.now() + 10 * 36e5).toISOString().slice(0, 10); // Brisbane
const STEPS = ["welcome", "trial", "contract", "form", "reminder", "dayBefore"];

// Make sure they're on the team list, and have a contract, form link and welcome link.
async function prep(s, c) {
  const roster = await loadRoster(s);
  let changed = false;
  if (!c.teamId || !roster.team.some((t) => t.id === c.teamId)) {
    const tid = "t" + randomBytes(4).toString("hex");
    roster.team.push({ id: tid, name: c.name, phone: auMobile(c.phone) || c.phone, newStarter: true, addedAt: new Date().toISOString() });
    await s.set("roster", { ...roster, savedAt: new Date().toISOString() });
    c.teamId = tid; changed = true;
  }
  if (!c.contractId || !(await s.get(`ct/${c.contractId}`))) {
    const token = tok(), id = "c" + Date.now().toString(36) + randomBytes(3).toString("hex");
    const ct = { id, token, name: c.name, email: c.email || "", start: day(c.trialDate) || day(c.start), sentAt: new Date().toISOString(), status: "sent", candId: c.id };
    await s.set(`ct/${id}`, ct); await s.set(`cttok/${token}`, { id });
    c.contractId = id; changed = true;
  }
  const p = (await s.get(`staff/${c.teamId}`)) || { docs: {} };
  if (!p.startToken) { p.startToken = tok(); await s.set(`staff/${c.teamId}`, p); }
  if (!c.welcome) { c.welcome = tok(); await s.set(`wtok/${c.welcome}`, { id: c.id }); changed = true; }
  if (changed) await s.set(`cand/${c.id}`, c);
  return c;
}

// Where they're at, worked out from the records themselves.
async function statusOf(s, c, ctx) {
  const { roster, confirms, acks } = ctx;
  const ct = c.contractId ? await s.get(`ct/${c.contractId}`) : null;
  const p = c.teamId ? await s.get(`staff/${c.teamId}`) : null;
  const mine = c.teamId ? roster.jobs.filter((j) => !j.sample && (j.staff || []).includes(c.teamId)).sort((a, b) => (a.date + shiftOf(a, c.teamId).start).localeCompare(b.date + shiftOf(b, c.teamId).start)) : [];
  const next = mine.find((j) => j.date >= today()) || null;
  let shift = null;
  if (next) {
    const sh = shiftOf(next, c.teamId), cf = confirms[next.id] && confirms[next.id][c.teamId];
    shift = { jobId: next.id, date: next.date, start: sh.start, end: sh.end, address: next.address || "", suburb: next.suburb || "", client: next.client || "", meet: next.meet || "",
      confirmed: cf && cf.k === sig(next, c.teamId) ? cf.s : "" };
  }
  const links = c.welcome ? {
    welcome: `${SITE()}/w/${c.welcome}`,
    contract: ct ? linkOf(ct) : "",
    form: p && p.startToken ? `${SITE()}/start/${p.startToken}` : "",
    roster: c.teamId ? `${SITE()}/?p=${c.teamId}` : "",
  } : null;
  return {
    contract: ct ? (ct.status === "signed" ? "signed" : "sent") : "",
    contractSignedAt: ct && ct.signedAt || "",
    form: p && p.onboardedAt ? "done" : "",
    formAt: p && p.onboardedAt || "",
    firstDay: c.teamId && acks[c.teamId] ? "read" : "",
    shift, links, hasProfile: !!(p && p.onboardedAt),
  };
}

const publicStep = (key, label, done, link, note) => ({ key, label, done: !!done, link: link || "", note: note || "" });

export default async (req) => {
  const s = await store(), u = new URL(req.url);

  // ---- their welcome page ----
  if (req.method === "GET" && u.searchParams.has("t")) {
    const t = u.searchParams.get("t") || "";
    if (!/^[a-f0-9]{24,64}$/.test(t)) return json({ error: "This link isn't right. Text Jack and he'll send it again." }, 404);
    const w = await s.get(`wtok/${t}`), c = w && (await s.get(`cand/${w.id}`));
    if (!c || c.stage === "no") return json({ error: "This link has expired. Text Jack and he'll send a new one." }, 404);
    const [roster, confirms, acks] = await Promise.all([loadRoster(s), loadConfirms(s), loadAcks(s)]);
    const st = await statusOf(s, c, { roster, confirms, acks });
    const info = roster.info || {};
    return json({
      first: c.name.split(/\s+/)[0], teamId: c.teamId,
      shift: st.shift && { jobId: st.shift.jobId, meet: st.shift.meet, date: st.shift.date, start: st.shift.start, end: st.shift.end, address: st.shift.address, suburb: st.shift.suburb, confirmed: st.shift.confirmed },
      info: { meet: info.meet || "", wear: info.wear || "", bring: info.bring || "", extra: info.extra || "" },
      firstDayRead: !!st.firstDay,
      steps: [
        publicStep("contract", "Sign your employment agreement", st.contract === "signed", st.links.contract, "About 10 minutes. Sign with your finger."),
        publicStep("form", "Fill in your new starter form", st.form === "done", st.links.form, "Tax, super, bank and emergency contact. Have your TFN and bank details handy."),
        publicStep("shift", "Confirm your shift", st.shift && st.shift.confirmed === "yes", st.links.roster, st.shift ? "" : "Jack will put your shift on the roster soon."),
        publicStep("firstday", "Read your first-day info", st.firstDay, "", "Below. Tap Got it once you've read it."),
      ],
      jack: "0406 216 212",
    });
  }

  const admin = await checkAdmin(s, req);
  if (!admin) return json({ error: "Log in first" }, 401);

  if (req.method === "GET") {
    const [cands, roster, confirms, acks] = await Promise.all([loadCandidates(s), loadRoster(s), loadConfirms(s), loadAcks(s)]);
    const live = cands.filter((c) => c.stage === "trial" || c.stage === "onboarding" || (c.stage === "active" && c.welcome && (Date.now() - Date.parse(c.moved || c.at)) < 14 * 864e5));
    const people = await Promise.all(live.map(async (c) => ({ ...c, status: await statusOf(s, c, { roster, confirms, acks }) })));
    return json({ people, info: roster.info || {} });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }

  if (b.action === "add") {
    const name = str(b.name, 100), phone = auMobile(b.phone), email = str(b.email, 160).toLowerCase();
    if (name.length < 2) return json({ error: "Add their full name." }, 400);
    if (!phone) return json({ error: "Add their mobile (04xx xxx xxx)." }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "That email doesn't look right." }, 400);
    const dup = (await loadCandidates(s)).find((c) => auMobile(c.phone) === phone && c.stage !== "no");
    let c = dup || { id: "c" + Date.now().toString(36) + randomBytes(3).toString("hex"), at: new Date().toISOString(), name, phone, email, suburb: "", days: [], rightToWork: "yes", heard: "other", added: true };
    if (!dup) { c.stage = "trial"; c.seen = true; }
    if (dup && (dup.stage === "applied" || dup.stage === "screened")) c.stage = "trial";
    if (email && !c.email) c.email = email;
    if (day(b.trialDate)) c.trialDate = day(b.trialDate);
    c.moved = new Date().toISOString();
    await s.set(`cand/${c.id}`, c);
    c = await prep(s, c);
    return json({ ok: true, id: c.id });
  }

  const c = await s.get(`cand/${str(b.id, 40)}`);
  if (!c) return json({ error: "That person isn't there any more. Refresh." }, 404);
  if (b.action === "prep") { await prep(s, c); return json({ ok: true }); }
  if (b.action === "sent") {
    if (!STEPS.includes(b.step)) return json({ error: "Bad step" }, 400);
    c.sent = { ...(c.sent || {}), [b.step]: new Date().toISOString() };
    await s.set(`cand/${c.id}`, c);
    return json({ ok: true });
  }
  if (b.action === "trial") {
    c.trialDate = day(b.trialDate);
    if (c.contractId) { const ct = await s.get(`ct/${c.contractId}`); if (ct && ct.status !== "signed" && c.trialDate) { ct.start = c.trialDate; await s.set(`ct/${ct.id}`, ct); } }
    await s.set(`cand/${c.id}`, c);
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/welcome" };
