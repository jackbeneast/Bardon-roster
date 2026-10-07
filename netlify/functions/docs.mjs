// Quotes and invoices. Jack (admin) creates and edits; clients open a private
// link (/q/<token> or /i/<token>) to view, accept and pay.
import { store, json, checkAdmin } from "../../lib/core.mjs";
import {
  loadSettings, cleanSettings, cleanDoc, loadDocs, findByToken, saveDoc, newDoc,
  recordPayment, addJobFromQuote, publicView, totals, statusOf, today, addDays, depositDesc,
} from "../../lib/docs.mjs";

const r2 = (v) => Math.round(v * 100) / 100;

export default async (req) => {
  const s = await store();
  const admin = await checkAdmin(s, req);
  const u = new URL(req.url);

  if (req.method === "GET") {
    const t = u.searchParams.get("t");
    if (t) {
      const d = await findByToken(s, t);
      if (!d || (d.status === "draft" && !admin)) return json({ error: "This link isn't active. Call Jack at Bardon Clean on 0406 216 212." }, 404);
      if (!admin) {
        const now = new Date().toISOString();
        if (!d.viewedAt) { d.viewedAt = now; d.flag ||= "viewed"; d.flagAt ||= now; }
        d.lastViewed = now; await saveDoc(s, d);
      }
      const set = await loadSettings(s);
      const out = publicView(d, set);
      out.card = !!process.env.STRIPE_SECRET_KEY;
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
    if (st === "expired") return json({ error: "This quote has expired. Call Jack on 0406 216 212 for an updated one." }, 410);
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
    return json({ ok: true });
  }

  if (!admin) return json({ error: "Wrong password" }, 401);

  // ---- Admin actions ----
  const set = await loadSettings(s);
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
  const d = await s.get(`doc/${String(b.id || "")}`);
  if (!d) return json({ error: "Not found" }, 404);
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
    await recordPayment(s, d, { amt, date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : today(), method: b.method || "Bank transfer" });
    delete d.flag; await saveDoc(s, d);
    return json({ ok: true });
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
      kind: "invoice", status: "draft", quoteId: d.id, quoteNum: d.num, client: d.client, site: d.site, suburb: d.suburb,
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
