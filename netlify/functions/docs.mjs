// Quotes and invoices. Jack (admin) creates and edits; clients open a private
// link (/q/<token> or /i/<token>) to view, accept and pay.
import { store, json, checkAdmin } from "../../lib/core.mjs";
import {
  loadSettings, cleanSettings, cleanDoc, loadDocs, findByToken, saveDoc, newDoc,
  recordPayment, addJobFromQuote, publicView, totals, statusOf, today, addDays, depositDesc, reportFor,
} from "../../lib/docs.mjs";
import { notify, money, fmtDay } from "../../lib/notify.mjs";
import { planImport } from "../../lib/jobberImport.mjs";

// "Quote #172 for Hughes" style label.
const label = (d) => `${d.kind === "quote" ? "Quote" : "Invoice"} #${d.num}${d.client?.name ? " for " + d.client.name : ""}`;

const r2 = (v) => Math.round(v * 100) / 100;

export default async (req) => {
  const s = await store();
  const admin = await checkAdmin(s, req);
  const u = new URL(req.url);

  if (req.method === "GET") {
    const t = u.searchParams.get("t");
    if (t) {
      const d = await findByToken(s, t);
      if (!d || (d.status === "draft" && !admin)) return json({ error: "This link isn't active. Text Jack at Bardon Clean on 0468 193 772." }, 404);
      if (!admin) {
        // Only counted when the page runs in a real browser (link previews don't run it).
        const now = new Date().toISOString();
        const firstView = !d.viewedAt;
        const reopened = !firstView && d.lastViewed && Date.now() - Date.parse(d.lastViewed) > 12 * 3600e3;
        if (firstView) { d.viewedAt = now; d.flag ||= "viewed"; d.flagAt ||= now; }
        d.views = (d.views || 0) + 1;
        d.lastViewed = now; await saveDoc(s, d);
        const st = statusOf(d);
        if ((firstView || reopened) && !["accepted", "declined", "paid"].includes(st)) {
          const tt = totals(d);
          await notify(s, {
            type: d.kind === "quote" ? "quote_view" : "inv_view",
            title: `${label(d)} ${firstView ? "opened" : "opened again"}`,
            body: `${d.site || d.suburb || ""}${d.kind === "quote" ? ` · ${money(tt.total)}` : ` · ${money(tt.due)} due`}`.replace(/^ · /, ""),
            tags: "eyes", priority: 2, url: `/money/#/doc/${d.id}`,
          });
        }
      }
      const set = await loadSettings(s);
      const out = publicView(d, set);
      out.card = !!process.env.STRIPE_SECRET_KEY;
      // Invoices link to the job report (live page with photos) once the job is on the roster.
      if (d.kind === "invoice" && !d.isDeposit) { const r = await reportFor(s, d); if (r) out.report = r; }
      // After accepting, point the client at their deposit invoice.
      if (d.kind === "quote" && d.depositInvoice) {
        const inv = await s.get(`doc/${d.depositInvoice}`);
        if (inv) out.depositLink = { token: inv.token, num: inv.num, state: statusOf(inv), due: totals(inv).due };
      }
      return json(out);
    }
    if (!admin) return json({ error: "Log in first" }, 401);
    const [docs, settings] = await Promise.all([loadDocs(s), loadSettings(s)]);
    return json({ docs, settings, card: !!process.env.STRIPE_SECRET_KEY });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }

  // ---- Client actions (by private link) ----
  if (b.action === "accept") {
    const q = await findByToken(s, b.t);
    if (!q || q.kind !== "quote" || q.status === "draft") return json({ error: "This link isn't active." }, 404);
    if (q.status === "accepted") return json({ ok: true });
    const st = statusOf(q);
    if (st === "expired") return json({ error: "This quote has expired. Text Jack on 0468 193 772 for an updated one." }, 410);
    const name = String(b.name || "").trim().slice(0, 120);
    if (name.length < 2) return json({ error: "Type your name to accept." }, 400);
    q.status = "accepted"; q.acceptedAt = new Date().toISOString(); q.acceptedName = name;
    q.flag = "accepted"; q.flagAt = q.acceptedAt;
    const set = await loadSettings(s);
    if (q.depositPct > 0 && !q.depositInvoice) {
      const t = totals(q);
      const inv = await newDoc(s, set, {
        kind: "invoice", status: "sent", sentAt: q.acceptedAt, quoteId: q.id, quoteNum: q.num,
        client: q.client, site: q.site, suburb: q.suburb, service: q.service, serviceDate: q.serviceDate,
        issued: today(), dueDate: today(), gst: q.gst, showTerms: false,
        isDeposit: true,
        items: [{ title: `${q.depositPct}% deposit${q.site ? ` | ${q.site}` : ""}`, desc: depositDesc(q.depositPct, q.service) + ` Quote #${q.num}.`, qty: 1, price: r2(t.sub * q.depositPct / 100) }],
        notes: "",
      });
      await saveDoc(s, inv);
      q.depositInvoice = inv.id;
    }
    try { q.jobId = (await addJobFromQuote(s, q)) || q.jobId; } catch { /* job can be added by hand */ }
    await saveDoc(s, q);
    const tq = totals(q);
    await notify(s, {
      type: "quote_accept", title: `${label(q)} accepted`,
      body: `${money(tq.total)}${q.site ? " · " + q.site : ""}${q.serviceDate ? `\nClean ${fmtDay(q.serviceDate)}${q.jobId ? ", added to the roster" : ""}` : "\nNo date yet, add it to the roster"}${q.depositInvoice ? `\n${q.depositPct}% deposit invoice sent to them` : ""}`,
      tags: "tada", priority: 5, url: `/money/#/doc/${q.id}`,
    });
    return json({ ok: true });
  }

  if (!admin) return json({ error: "Wrong password" }, 401);

  // ---- Admin actions ----
  const set = await loadSettings(s);
  if (b.action === "jobber-import") {
    // Preview first (commit: false), then write (commit: true). Safe to run again.
    const files = (Array.isArray(b.files) ? b.files : []).slice(0, 12).map((f) => ({ name: String(f?.name || ""), text: String(f?.text || "").slice(0, 3e6) }));
    if (!files.length) return json({ error: "Pick your Jobber export files first" }, 400);
    const [docs, books] = await Promise.all([loadDocs(s), s.get("books")]);
    const p = planImport(files, docs, set, books || {});
    if (!p.summary.has.includes("invoices") && !p.summary.has.includes("quotes")) return json({ error: "Those files don't look like Jobber's Invoices or Quotes reports." }, 400);
    if (!b.commit) return json({ ok: true, summary: p.summary, report: p.report });
    for (const d of p.live) await saveDoc(s, d);
    const arcIds = new Set(p.archive.map((d) => d.id));
    const old = (await s.get("jbarchive"))?.docs || [];
    // Keep earlier-imported history that this set of files didn't include (e.g. invoices-only re-run).
    const keep = old.filter((d) => !arcIds.has(d.id) && !p.live.some((x) => x.id === d.id) && !(p.summary.has.includes(d.kind === "quote" ? "quotes" : "invoices")));
    await s.set("jbarchive", { at: new Date().toISOString(), docs: [...keep, ...p.archive] });
    // Docs that were live last time and are now closed move to the archive.
    for (const d of p.archive) if (docs.some((x) => x.id === d.id && !x.archived)) { await s.del(`doc/${d.id}`); const t = docs.find((x) => x.id === d.id)?.token; if (t) await s.del(`doctok/${t}`); }
    const raw = (await s.get("docset")) || {};
    await s.set("docset", { ...raw, nextInvoice: p.nextInvoice, nextQuote: p.nextQuote });
    if (Object.keys(p.recur).length) {
      const bk = (await s.get("books")) || {};
      bk.recur = { ...(bk.recur || {}) };
      for (const [k, v] of Object.entries(p.recur)) if (bk.recur[k] == null) bk.recur[k] = v.price;
      await s.set("books", bk);
    }
    await s.set("jobber-import", { at: new Date().toISOString(), summary: { ...p.summary, openInvoices: undefined, openQuotes: undefined } });
    return json({ ok: true, summary: p.summary, report: p.report });
  }
  if (b.action === "settings") {
    const clean = cleanSettings(b.settings || {});
    await s.set("docset", clean);
    return json({ ok: true });
  }
  if (b.action === "save") {
    let d = b.id ? await s.get(`doc/${b.id}`) : null;
    if (b.id && !d) return json({ error: "That one was deleted" }, 404);
    const fields = cleanDoc(b.doc || {}, d);
    if (!d) d = await newDoc(s, set, fields); else d = { ...d, ...fields, kind: d.kind };
    if (d.kind === "quote" && !d.validUntil) d.validUntil = addDays(d.issued, set.quoteValidDays || 30);
    if (d.kind === "invoice" && !d.dueDate) d.dueDate = addDays(d.issued, set.invoiceDueDays || 0);
    await saveDoc(s, d);
    return json({ ok: true, id: d.id });
  }
  let d = await s.get(`doc/${String(b.id || "")}`);
  // Jobber history can only be copied into something new.
  if (!d && b.action === "duplicate") d = ((await s.get("jbarchive"))?.docs || []).find((x) => x.id === String(b.id || "")) || null;
  if (!d) return json({ error: "Not found" }, 404);
  if (b.action === "tojob" && d.kind === "quote") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) return json({ error: "Pick the date of the clean" }, 400);
    if (d.jobId) {
      const roster = await (await import("../../lib/core.mjs")).loadRoster(s);
      if (roster.jobs.some((j) => j.id === d.jobId)) return json({ ok: true, jobId: d.jobId });
      d.jobId = ""; // the job was deleted from the roster, so make a new one
    }
    if (d.status !== "accepted") { d.status = "accepted"; d.acceptedAt ||= new Date().toISOString(); d.acceptedName ||= "Marked by Jack"; }
    d.jobId = await addJobFromQuote(s, d, { date: b.date, start: b.start, end: b.end });
    for (const iid of [d.depositInvoice, ...(d.invoices || [])].filter(Boolean)) { const x = await s.get(`doc/${iid}`); if (x && !x.serviceDate) { x.serviceDate = d.serviceDate; await saveDoc(s, x); } }
    await saveDoc(s, d);
    return json({ ok: true, jobId: d.jobId });
  }
  if (b.action === "confirmed") { d.confirmedAt = new Date().toISOString(); await saveDoc(s, d); return json({ ok: true }); }
  if (b.action === "sent") { if (d.status === "draft") d.status = "sent"; d.sentAt ||= new Date().toISOString(); await saveDoc(s, d); return json({ ok: true }); }
  if (b.action === "seen") { delete d.flag; delete d.flagAt; await saveDoc(s, d); return json({ ok: true }); }
  if (b.action === "status" && d.kind === "quote" && ["accepted", "declined", "sent"].includes(b.status)) {
    d.status = b.status;
    if (b.status === "accepted") { d.acceptedAt ||= new Date().toISOString(); d.acceptedName ||= "Marked by Jack"; try { d.jobId = (await addJobFromQuote(s, d)) || d.jobId; } catch {} }
    await saveDoc(s, d); return json({ ok: true });
  }
  if (b.action === "pay") {
    const amt = Number(b.amt);
    if (!(amt > 0)) return json({ error: "Enter the amount paid" }, 400);
    const pid = await recordPayment(s, d, { amt, date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : today(), method: b.method || "Bank transfer" });
    delete d.flag; await saveDoc(s, d);
    return json({ ok: true, pid });
  }
  if (b.action === "unpay") { d.payments = (d.payments || []).filter((p) => p.id !== b.pid); await saveDoc(s, d); return json({ ok: true }); }
  if (b.action === "invoice" && d.kind === "quote") {
    // Invoice from a quote: "full" = everything, "balance" = total minus deposits paid.
    const t = totals(d);
    let items = d.items;
    if (b.mode === "balance" && d.depositInvoice) {
      const dep = await s.get(`doc/${d.depositInvoice}`);
      const paid = dep ? totals(dep).paid : 0;
      if (paid > 0) items = [...d.items, { title: `Less deposit paid (invoice #${dep.num})`, desc: "", qty: 1, price: -r2(d.gst ? paid / 1.1 : paid) }];
    }
    const inv = await newDoc(s, set, {
      kind: "invoice", status: "draft", quoteId: d.id, quoteNum: d.num, jobId: d.jobId || "", client: d.client, site: d.site, suburb: d.suburb,
      service: d.service, beds: d.beds, baths: d.baths, serviceDate: d.serviceDate, issued: today(),
      dueDate: addDays(today(), set.invoiceDueDays || 0), gst: d.gst, items, notes: "", showTerms: false,
    });
    await saveDoc(s, inv);
    (d.invoices ||= []).push(inv.id); await saveDoc(s, d);
    return json({ ok: true, id: inv.id, total: t.total });
  }
  if (b.action === "duplicate") {
    const c = await newDoc(s, set, { ...cleanDoc(d, null), kind: b.kind === "invoice" ? "invoice" : d.kind, issued: today(), validUntil: "", dueDate: "", serviceDate: "" });
    if (c.kind === "quote") c.validUntil = addDays(c.issued, set.quoteValidDays || 30); else c.dueDate = addDays(c.issued, set.invoiceDueDays || 0);
    await saveDoc(s, c);
    return json({ ok: true, id: c.id });
  }
  if (b.action === "delete") {
    await s.del(`doc/${d.id}`); if (d.token) await s.del(`doctok/${d.token}`);
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/docs" };
