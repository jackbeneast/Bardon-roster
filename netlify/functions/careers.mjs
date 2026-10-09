// Hiring: candidates from the careers page through to the team.
//   POST (public)  application from /careers
//   GET  (admin)   { candidates }
//   POST (admin)   { action: "update", id, stage?, score?, notes?, trialDate? }
//                  { action: "hire", id }  → adds them to the team as a new starter
//                  { action: "delete", id }
import { randomBytes, createHash } from "node:crypto";
import { store, json, checkAdmin, loadRoster } from "../../lib/core.mjs";
import { notify } from "../../lib/notify.mjs";

export const STAGES = ["applied", "screened", "trial", "onboarding", "active", "no"];
const EXP = { none: "No cleaning experience yet", home: "Cleaned for family or friends", housekeeping: "Hotel or housekeeping", commercial: "Commercial or office cleaning", residential: "Paid residential cleaning" };
const TRANSPORT = { car: "Own car and licence", licence: "Licence, no car", public: "Public transport" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = { "10": "Up to 10 a week", "20": "10 to 20 a week", "30": "20 to 30 a week", "38": "30 or more a week" };
const HEARD = { indeed: "Indeed", seek: "Seek", facebook: "Facebook", friend: "Friend or someone on the team", website: "Bardon Clean website", other: "Other" };

const str = (v, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const pick = (m, v) => (Object.prototype.hasOwnProperty.call(m, v) ? v : "");
const ipKey = (ip) => createHash("sha256").update("bc-job:" + String(ip || "")).digest("hex").slice(0, 20);
const cid = () => "c" + Date.now().toString(36) + randomBytes(3).toString("hex");

export function cleanApp(b) {
  const name = str(b.name, 100), phone = str(b.phone, 30), email = str(b.email, 160).toLowerCase();
  if (name.length < 2) return { error: "Add your name." };
  if (phone.replace(/\D/g, "").length < 8) return { error: "Add a mobile number so Jack can call you." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "That email doesn't look right." };
  const suburb = str(b.suburb, 80);
  if (!suburb) return { error: "Add the suburb you live in." };
  const work = b.rightToWork === "yes" ? "yes" : b.rightToWork === "no" ? "no" : "";
  if (!work) return { error: "Let us know if you can work in Australia." };
  const days = (Array.isArray(b.days) ? b.days : []).filter((d) => DAYS.includes(d));
  if (!days.length) return { error: "Tick the days you can work." };
  return { app: {
    name, phone, email, suburb, rightToWork: work, days, hours: pick(HOURS, b.hours), start: /^\d{4}-\d{2}-\d{2}$/.test(b.start || "") ? b.start : "",
    exp: pick(EXP, b.exp), transport: pick(TRANSPORT, b.transport), heard: pick(HEARD, b.heard), about: str(b.about, 1500),
  } };
}

export async function loadCandidates(s) {
  const keys = await s.list("cand/");
  return (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean).sort((a, b) => b.at.localeCompare(a.at));
}

export default async (req) => {
  const s = await store();
  const admin = await checkAdmin(s, req);
  if (req.method === "GET") {
    if (!admin) return json({ error: "Log in first" }, 401);
    return json({ candidates: await loadCandidates(s), labels: { EXP, TRANSPORT, HOURS, HEARD } });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Something went wrong sending that. Please try again." }, 400); }

  if (b.action) {
    if (!admin) return json({ error: "Log in first" }, 401);
    const id = str(b.id, 40), c = id && (await s.get(`cand/${id}`));
    if (!c) return json({ error: "That candidate isn't there any more. Refresh." }, 404);
    if (b.action === "delete") { await s.del(`cand/${id}`); return json({ ok: true }); }
    if (b.action === "update") {
      if (b.stage !== undefined) { if (!STAGES.includes(b.stage)) return json({ error: "Bad stage" }, 400); c.stage = b.stage; c.moved = new Date().toISOString(); }
      if (b.score && typeof b.score === "object") {
        const sc = {};
        for (const k of ["reliable", "attitude", "availability", "work"]) { const v = Number(b.score[k]); if (v >= 1 && v <= 3) sc[k] = v; }
        c.score = { ...(c.score || {}), ...sc };
      }
      if (typeof b.notes === "string") c.notes = str(b.notes, 2000);
      if (b.checks && typeof b.checks === "object") { c.checks = { ...(c.checks || {}) }; for (const k of ["contract", "form", "shirt"]) if (k in b.checks) c.checks[k] = !!b.checks[k]; }
      if (b.trialDate !== undefined) c.trialDate = /^\d{4}-\d{2}-\d{2}$/.test(b.trialDate || "") ? b.trialDate : "";
      c.seen = true;
      await s.set(`cand/${id}`, c);
      return json({ ok: true, candidate: c });
    }
    if (b.action === "hire") {
      const roster = await loadRoster(s);
      if (!c.teamId || !roster.team.some((t) => t.id === c.teamId)) {
        const tid = "t" + randomBytes(4).toString("hex");
        roster.team.push({ id: tid, name: c.name, phone: c.phone, newStarter: true });
        await s.set("roster", { ...roster, savedAt: new Date().toISOString() });
        c.teamId = tid;
      }
      c.stage = b.stage === "trial" ? "trial" : "onboarding"; c.moved = new Date().toISOString();
      if (b.trialDate !== undefined) c.trialDate = /^\d{4}-\d{2}-\d{2}$/.test(b.trialDate || "") ? b.trialDate : "";
      await s.set(`cand/${id}`, c);
      return json({ ok: true, candidate: c });
    }
    return json({ error: "Unknown action" }, 400);
  }

  // ---- Public application ----
  if (b.hp || !(Number(b.t) >= 4000)) return json({ ok: true }); // bot trap: hidden field or instant submit
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "";
  const rateKey = `jobrate/${ipKey(ip)}/${new Date().toISOString().slice(0, 13)}`;
  const n = ((await s.get(rateKey))?.n || 0) + 1;
  if (n > 4) return json({ error: "That's a few applications in a short time. Text Jack on 0468 193 772." }, 429);
  await s.set(rateKey, { n });
  const { app, error } = cleanApp(b);
  if (error) return json({ error }, 400);
  const c = { id: cid(), at: new Date().toISOString(), stage: app.rightToWork === "no" ? "no" : "applied", auto: app.rightToWork === "no" ? "No right to work in Australia" : "", ...app };
  await s.set(`cand/${c.id}`, c);
  await notify(s, {
    type: "applicant", title: `New applicant: ${c.name}, ${c.suburb}`,
    body: [`${c.days.join(" ")}${c.hours ? " · " + HOURS[c.hours].toLowerCase() : ""}`, c.exp ? EXP[c.exp] : "", c.transport ? TRANSPORT[c.transport] : "", c.auto ? `Doesn't meet must-haves: ${c.auto}` : ""].filter(Boolean).join("\n"),
    tags: "bust_in_silhouette", priority: c.auto ? 2 : 4, url: "/?v=pipeline#hiring",
  });
  return json({ ok: true, first: c.name.split(/\s+/)[0] });
};

export const config = { path: "/api/careers" };
