// Messages: two-way texting with clients and leads from the business number.
// GET                -> inbox { ready, from, hookOn, threads[], unread, people[], team[] }
// GET ?t=04xxxxxxxx  -> one conversation (and marks it read)
// GET ?count=1       -> { unread }
// POST {action:"send", to, text, name?} | {action:"read"|"archive"|"unarchive", phone}
//      {action:"name", phone, name} | {action:"connect"} | {action:"pull"}
//      {action:"contacts", list:[{name, phone, note?}]} | {action:"uncontact", phone}
import { store, json, checkAdmin, loadRoster } from "../../lib/core.mjs";
import { loadSettings, loadDocs } from "../../lib/docs.mjs";
import { loadRequests, SERVICES } from "../../lib/requests.mjs";
import { mmReady, sendSms, auMobile } from "../../lib/mm.mjs";
import { loadIndex, loadThread, markRead, setMeta, unreadCount, connectHooks, pullInbound, directory, loadContacts, saveContacts, removeContact } from "../../lib/messages.mjs";

async function sources(s) {
  const [requests, docs, roster, contacts, idx] = await Promise.all([loadRequests(s).catch(() => []), loadDocs(s).catch(() => []), loadRoster(s).catch(() => ({})), loadContacts(s).catch(() => []), loadIndex(s).catch(() => ({}))]);
  const reqs = requests.map((r) => ({ ...r, serviceLabel: (SERVICES[r.service] || SERVICES.other).label }));
  // Anyone texted before, with a name given in the conversation, is searchable too.
  const named = Object.entries(idx).filter(([, x]) => x.name).map(([phone, x]) => ({ phone, name: x.name, at: x.lastAt, note: "Texted before" }));
  return { reqs, docs, roster, contacts: [...contacts, ...named] };
}
async function people(s, src) {
  const { reqs, docs, roster, contacts } = src || (await sources(s));
  return directory({ requests: reqs, docs: docs.filter((d) => !d.archived || d.client?.phone), agents: roster.agents || [], team: roster.team || [], contacts });
}
// The records behind a conversation, so templates fill in links, amounts and dates.
function recordsFor(phone, { reqs, docs, roster }, jobId) {
  const mine = docs.filter((d) => !d.archived && auMobile(d.client?.phone) === phone);
  const quote = mine.find((d) => d.kind === "quote" && d.state !== "declined") || null;
  const invs = mine.filter((d) => d.kind === "invoice");
  const invoice = invs.find((d) => d.totals?.due > 0.005 && d.state !== "draft") || invs[0] || null;
  const jobs = (roster.jobs || []).filter((j) => !j.sample);
  let job = jobId ? jobs.find((j) => j.id === jobId) : null;
  if (!job) {
    const ids = new Set(mine.map((d) => d.jobId).filter(Boolean));
    const today = new Date(Date.now() + 10 * 3600e3).toISOString().slice(0, 10);
    const cands = jobs.filter((j) => ids.has(j.id)).sort((a, b) => a.date.localeCompare(b.date));
    job = cands.find((j) => j.date >= today) || cands[cands.length - 1] || null;
  }
  const group = job && job.group ? jobs.filter((j) => j.group === job.group) : [];
  const req = reqs.find((r) => auMobile(r.phone) === phone) || null;
  return { quote, invoice, job, jobs: group, req: req && { name: req.name, suburb: req.suburb, address: req.address, service: req.serviceLabel } };
}

export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (url.searchParams.get("count")) {
      await pullInbound(s);
      return json({ unread: unreadCount(await loadIndex(s)) });
    }
    const t = url.searchParams.get("t");
    if (t) {
      const phone = auMobile(t);
      if (!phone) return json({ error: "That isn't an Australian mobile number" }, 400);
      await pullInbound(s);
      const src = await sources(s);
      const [thread, dir] = await Promise.all([loadThread(s, phone), people(s, src)]);
      if (thread.unread) await markRead(s, phone);
      const who = dir[phone] || { name: "", ctx: [] };
      return json({ ready: mmReady(), thread: { ...thread, unread: 0, name: thread.name || who.name }, ctx: who.ctx.slice(0, 6), rec: recordsFor(phone, src, url.searchParams.get("job") || "") });
    }
    await pullInbound(s);
    const src = await sources(s);
    const [idx, dir, set, hook] = await Promise.all([loadIndex(s), people(s, src), loadSettings(s), s.get("mmhook")]);
    const threads = Object.entries(idx).map(([phone, x]) => {
      const who = dir[phone] || { name: "", ctx: [] };
      return { phone, ...x, name: x.name || who.name, tag: who.ctx[0] ? who.ctx[0].label : "" };
    }).sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));
    // Everyone with a mobile we know about, for "New message".
    const list = Object.entries(dir).map(([phone, x]) => ({ phone, name: x.name, tag: x.ctx[0] ? x.ctx[0].label : "", kind: x.ctx[0] ? x.ctx[0].kind : "", at: x.ctx[0]?.at || "" }))
      .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 1500);
    // Team members with a mobile, pinned at the top of the inbox for one-tap texting.
    const team = (src.roster.team || []).filter((t) => !t.owner && !t.archived && auMobile(t.phone))
      .map((t) => ({ phone: auMobile(t.phone), name: t.name || "" }));
    return json({ ready: mmReady(), from: set.biz.sms, hookOn: !!(hook && hook.on), threads, unread: unreadCount(idx), people: list, team });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const phone = auMobile(b.phone || b.to);

  if (b.action === "send") {
    const r = await sendSms(b.to, b.text, "chat", { name: typeof b.name === "string" ? b.name : "" });
    if (!r.ok) return json({ error: r.error }, r.status);
    return json({ ok: true, thread: await loadThread(s, r.to) });
  }
  if (b.action === "connect") {
    const r = await connectHooks(s);
    if (!r.ok) return json({ error: r.error }, 502);
    await pullInbound(s, true);
    return json({ ok: true });
  }
  if (b.action === "contacts") {
    const r = await saveContacts(s, Array.isArray(b.list) ? b.list : []);
    if (!r.added && !r.updated && !(b.list || []).some((x) => auMobile(x && x.phone))) return json({ error: "No Australian mobile numbers found" }, 400);
    return json({ ok: true, ...r });
  }
  if (b.action === "uncontact") { if (!phone) return json({ error: "That isn't an Australian mobile number" }, 400); await removeContact(s, phone); return json({ ok: true }); }
  if (b.action === "pull") { const n = await pullInbound(s, true); return json({ ok: true, added: n }); }
  if (!phone) return json({ error: "That isn't an Australian mobile number" }, 400);
  if (b.action === "read") { await markRead(s, phone); return json({ ok: true }); }
  if (b.action === "archive" || b.action === "unarchive") { await setMeta(s, phone, { archived: b.action === "archive" }); return json({ ok: true }); }
  if (b.action === "name") { await setMeta(s, phone, { name: String(b.name || "") }); return json({ ok: true }); }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/messages" };
