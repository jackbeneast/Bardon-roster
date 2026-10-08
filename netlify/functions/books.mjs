// Profit & expenses (Jack only): job prices, expenses with receipt photos,
// regular outgoings, and the Jobber sync controls.
import { store, json, checkAdmin, loadRoster } from "../../lib/core.mjs";
import { loadDocs, loadSettings } from "../../lib/docs.mjs";
import { loadBooks, loadExpenses, cleanExpense, cleanFixed, quoteTotals, priceOf, moneySummary, CATS, SETUP } from "../../lib/books.mjs";
import { loadJobber, syncJobber } from "../../lib/jobber.mjs";

const r2 = (v) => Math.round(v * 100) / 100;

export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  const u = new URL(req.url);

  if (req.method === "GET") {
    if (u.searchParams.get("sum")) return json(await moneySummary(s));
    const pk = u.searchParams.get("price");
    if (pk) { // one booking, for the job editor in the hub
      const [roster, books, docs] = await Promise.all([loadRoster(s), loadBooks(s), loadDocs(s)]);
      const days = roster.jobs.filter((j) => (j.group || j.id) === pk);
      const rec = days.find((j) => j.rec)?.rec;
      const p = days.length ? priceOf(days, books, quoteTotals(docs)) : { price: null, from: "" };
      return json({ ...p, set: books.prices[pk] ?? null, recur: rec ? books.recur[rec] ?? null : null });
    }
    const rid = u.searchParams.get("receipt");
    if (rid) {
      const buf = await s.getBin(`rcpt/${rid.replace(/[^\w-]/g, "")}`);
      if (!buf) return json({ error: "No receipt" }, 404);
      return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" } });
    }
    const [roster, books, docs, expenses, set, jb] = await Promise.all([loadRoster(s), loadBooks(s), loadDocs(s), loadExpenses(s), loadSettings(s), loadJobber(s)]);
    const payments = [];
    for (const d of docs) if (d.kind === "invoice") for (const p of d.payments || []) payments.push({ date: p.date, amt: p.amt, method: p.method, num: d.num, client: d.client?.name || "", doc: d.id });
    const owing = r2(docs.filter((d) => d.kind === "invoice" && d.state !== "draft" && d.state !== "paid").reduce((a, d) => a + d.totals.due, 0));
    return json({
      jobs: roster.jobs.filter((j) => !j.sample), team: roster.team, pay: roster.pay || null,
      books, expenses, payments, owing, quoteTotals: quoteTotals(docs), gstReg: set.gst !== false,
      cats: CATS, setup: SETUP,
      jobber: { on: !!jb.url, last: jb.last, series: jb.series, pending: jb.pending },
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const books = await loadBooks(s);
  const saveBooks = () => s.set("books", books);

  switch (b.action) {
    case "price": { // price for one booking; null clears it
      const k = String(b.key || "").slice(0, 60); if (!k) return json({ error: "Missing job" }, 400);
      if (b.old && b.old !== k) delete books.prices[String(b.old).slice(0, 60)];
      const v = Number(b.price);
      if (b.price === null || b.price === "" || !isFinite(v)) delete books.prices[k]; else if (v >= 0 && v < 1e6) books.prices[k] = r2(v);
      await saveBooks(); return json({ ok: true });
    }
    case "prices": { // several at once from the "no price yet" list
      for (const [k, p] of Object.entries(b.prices || {}).slice(0, 300)) { const v = Number(p); if (p !== "" && p != null && isFinite(v) && v >= 0 && v < 1e6) books.prices[String(k).slice(0, 60)] = r2(v); }
      for (const [k, p] of Object.entries(b.recur || {}).slice(0, 100)) { const v = Number(p); if (p === "" || p == null) delete books.recur[k]; else if (isFinite(v) && v >= 0 && v < 1e6) books.recur[String(k).slice(0, 80)] = r2(v); }
      await saveBooks(); return json({ ok: true });
    }
    case "recur": {
      const k = String(b.key || "").slice(0, 80), v = Number(b.price);
      if (!k) return json({ error: "Missing series" }, 400);
      if (b.price === null || b.price === "" || !isFinite(v)) delete books.recur[k]; else books.recur[k] = r2(v);
      await saveBooks(); return json({ ok: true });
    }
    case "expense": {
      const prev = b.id ? await s.get(`exp/${b.id}`) : null;
      const e = cleanExpense(b.expense || {}, prev);
      if (!e || !e.date) return json({ error: "Enter the amount and date" }, 400);
      if (b.receipt && typeof b.receipt === "string") {
        const buf = Buffer.from(b.receipt.replace(/^data:image\/\w+;base64,/, ""), "base64");
        if (buf.length > 4.5e6) return json({ error: "That photo is too big" }, 413);
        await s.setBin(`rcpt/${e.id}`, buf); e.receipt = true;
      }
      if (b.dropReceipt) { await s.del(`rcpt/${e.id}`); delete e.receipt; }
      await s.set(`exp/${e.id}`, e);
      return json({ ok: true, expense: e });
    }
    case "delexpense": {
      const id = String(b.id || "").replace(/[^\w-]/g, "");
      await s.del(`exp/${id}`); await s.del(`rcpt/${id}`);
      return json({ ok: true });
    }
    case "fixed": {
      books.fixed = cleanFixed(b.fixed);
      if (b.setup && typeof b.setup === "object") for (const [k, v] of Object.entries(b.setup)) if (SETUP.some((x) => x[0] === k)) { if (v) books.setup[k] = v === "na" ? "na" : "done"; else delete books.setup[k]; }
      // Anything on the checklist that now has an outgoing counts as done.
      for (const f of books.fixed) if (f.setup && SETUP.some((x) => x[0] === f.setup)) books.setup[f.setup] = "done";
      await saveBooks(); return json({ ok: true, books });
    }
    case "jobberUrl": {
      const url = String(b.url || "").trim();
      if (url && !/^(https|webcal):\/\/[^\s]+\.ics/i.test(url)) return json({ error: "Paste the calendar link that ends in .ics (with everything after it)." }, 400);
      const jb = (await s.get("jobber")) || {};
      jb.url = url.replace(/^webcal:/i, "https:");
      await s.set("jobber", jb);
      if (!url) return json({ ok: true });
      try { return json(await syncJobber(s)); } catch (e) { return json({ error: e.message || "Couldn't read the Jobber calendar." }, 502); }
    }
    case "jobberSync": {
      try { return json(await syncJobber(s, { add: Array.isArray(b.add) ? b.add.map(String) : [], ignore: Array.isArray(b.ignore) ? b.ignore.map(String) : [] })); }
      catch (e) { return json({ error: e.message || "Couldn't read the Jobber calendar." }, 502); }
    }
  }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/books" };
