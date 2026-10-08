// Xero: sends money in and money out from the hub to Xero so BAS is ready to lodge.
//
// Built for the Xero Ignite plan, which caps invoices (20/month) and bills (5/month).
// So nothing is sent as an invoice or bill. Instead:
//   - every payment received on a hub invoice  -> a "Receive Money" transaction (GST on Income)
//   - every expense logged in the hub          -> a "Spend Money" transaction (GST on Expenses), receipt photo attached
// Both match straight against the bank feed in Xero's reconcile screen.
// Payments or expenses removed from the hub are deleted in Xero on the next sync.
//
// Needs XERO_CLIENT_ID and XERO_CLIENT_SECRET set in Netlify (from developer.xero.com).
import { createHash, randomBytes } from "node:crypto";
import { loadDocs, loadSettings } from "./docs.mjs";
import { loadExpenses, CATS } from "./books.mjs";
import { notify, once } from "./notify.mjs";

const IDENTITY = process.env.XERO_IDENTITY_URL || "https://identity.xero.com";
const LOGIN = process.env.XERO_LOGIN_URL || "https://login.xero.com";
const API = process.env.XERO_API_URL || "https://api.xero.com";
// Apps created after 2 March 2026 must use Xero's granular scopes.
const SCOPES = "openid offline_access accounting.banktransactions accounting.contacts accounting.settings.read accounting.attachments";
const MAX_OPS = 40; // Xero allows 60 calls a minute; the rest go on the next run

const r2 = (v) => Math.round(v * 100) / 100;
const SITE = () => (process.env.URL || "https://bardon-roster.netlify.app").replace(/\/$/, "");
export const redirectUri = () => SITE() + "/api/xero/callback";
export const configured = () => !!(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
const bneToday = () => new Date(Date.now() + 10 * 3600e3).toISOString().slice(0, 10);
// First day of the current BAS quarter (Jul, Oct, Jan, Apr).
export function quarterStart(d = bneToday()) { const y = +d.slice(0, 4), m = +d.slice(5, 7); const qm = Math.floor((m - 1) / 3) * 3 + 1; return `${y}-${String(qm).padStart(2, "0")}-01`; }

// Hub expense categories -> standard Xero Australia chart of accounts (by name, then code).
export const CAT_GUESS = {
  "Cleaning products": ["Cleaning", "408"], "Equipment": ["General Expenses", "429"], "Fuel": ["Motor Vehicle Expenses", "449"],
  "Vehicle": ["Motor Vehicle Expenses", "449"], "Insurance": ["Insurance", "433"], "Phone & internet": ["Telephone & Internet", "489"],
  "Software": ["Subscriptions", "485"], "Marketing": ["Advertising", "400"], "Uniforms": ["General Expenses", "429"],
  "Accountant": ["Consulting & Accounting", "412"], "Bank & card fees": ["Bank Fees", "404"], "Subcontractors": ["Subcontractors", "429"],
  "Training": ["General Expenses", "429"], "Other": ["General Expenses", "429"],
};

// ---------- stored state ----------
// xero      : connection, tokens and settings
// xero/map  : what has been sent (hub id -> Xero id + fingerprint), so nothing is sent twice
export async function loadXero(s) { return (await s.get("xero")) || {}; }
export async function loadMap(s) { const m = (await s.get("xero/map")) || {}; return { pay: m.pay || {}, exp: m.exp || {}, contacts: m.contacts || {}, tenant: m.tenant || "" }; }

// ---------- OAuth ----------
export async function startConnect(s) {
  const state = randomBytes(16).toString("hex");
  await s.set("xero/state", { state, at: Date.now() });
  const q = new URLSearchParams({ response_type: "code", client_id: process.env.XERO_CLIENT_ID, redirect_uri: redirectUri(), scope: SCOPES, state });
  return `${LOGIN}/identity/connect/authorize?${q}`;
}

async function tokenCall(params) {
  const basic = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${IDENTITY}/connect/token`, { method: "POST", headers: { authorization: "Basic " + basic, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error === "invalid_grant" ? "Xero connection has expired. Reconnect Xero." : d.error_description || d.error || "Xero sign-in failed"); e.reconnect = d.error === "invalid_grant"; throw e; }
  return { access: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
}

export async function finishConnect(s, code, state) {
  const st = await s.get("xero/state");
  if (!st || st.state !== state || Date.now() - st.at > 15 * 60e3) throw new Error("That Xero link has expired. Start the connection again from the hub.");
  await s.del("xero/state");
  const tokens = await tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
  const r = await fetch(`${API}/connections`, { headers: { authorization: "Bearer " + tokens.access, accept: "application/json" } });
  const conns = await r.json().catch(() => []);
  const org = Array.isArray(conns) ? conns.find((c) => c.tenantType === "ORGANISATION") : null;
  if (!org) throw new Error("No Xero organisation was connected. Try again and pick Bardon Clean.");
  const x = await loadXero(s);
  const map = await loadMap(s);
  if (map.tenant && map.tenant !== org.tenantId) await s.set("xero/map", { tenant: org.tenantId }); // different org: start fresh
  else if (!map.tenant) await s.set("xero/map", { ...map, tenant: org.tenantId });
  const sameOrg = x.tenantId === org.tenantId;
  const next = {
    ...x, tokens, tenantId: org.tenantId, tenantName: org.tenantName, connectionId: org.id, connectedAt: new Date().toISOString(),
    from: x.from || quarterStart(), broken: "",
    ...(sameOrg ? {} : { bank: "", cardBank: "", sales: "", codes: {} }),
  };
  await s.set("xero", next);
  await refreshAccounts(s);
  return next;
}

export async function disconnect(s) {
  const x = await loadXero(s);
  if (x.tokens && x.connectionId) {
    try { const t = await accessToken(s, x); await fetch(`${API}/connections/${x.connectionId}`, { method: "DELETE", headers: { authorization: "Bearer " + t } }); } catch { /* already gone */ }
  }
  const { tokens, connectionId, ...rest } = x;
  await s.set("xero", { ...rest, disconnectedAt: new Date().toISOString() });
}

async function accessToken(s, x) {
  if (!x.tokens) throw new Error("Xero isn't connected");
  if (x.tokens.exp > Date.now()) return x.tokens.access;
  try {
    x.tokens = await tokenCall({ grant_type: "refresh_token", refresh_token: x.tokens.refresh });
  } catch (e) {
    if (e.reconnect) { x.broken = e.message; delete x.tokens; await s.set("xero", x); }
    throw e;
  }
  await s.set("xero", x);
  return x.tokens.access;
}

// ---------- API ----------
function xeroError(d, status) {
  const v = d?.Elements?.flatMap((e) => (e.ValidationErrors || []).map((m) => m.Message)) || [];
  if (v.length) return v.join(" ");
  if (status === 429) return "Xero is busy (rate limit). The rest will go on the next sync.";
  if (status === 401 || status === 403) return "Xero refused access. Reconnect Xero.";
  return d?.Detail || d?.Message || d?.Title || `Xero error ${status}`;
}
async function call(s, x, method, path, body, raw) {
  const t = await accessToken(s, x);
  const headers = { authorization: "Bearer " + t, "xero-tenant-id": x.tenantId, accept: "application/json" };
  if (body && !raw) headers["content-type"] = "application/json";
  if (raw) headers["content-type"] = raw;
  const r = await fetch(`${API}/api.xro/2.0/${path}`, { method, headers, body: body ? (raw ? body : JSON.stringify(body)) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(xeroError(d, r.status)); e.status = r.status; throw e; }
  return d;
}

export async function refreshAccounts(s) {
  const x = await loadXero(s);
  const d = await call(s, x, "GET", "Accounts");
  const accts = (d.Accounts || []).filter((a) => a.Status === "ACTIVE").map((a) => ({ id: a.AccountID, code: a.Code || "", name: a.Name, type: a.Type }));
  x.accounts = accts;
  const banks = accts.filter((a) => a.type === "BANK");
  if (!x.bank && banks.length === 1) x.bank = banks[0].id;
  const byName = (n) => accts.find((a) => a.name.toLowerCase() === n.toLowerCase() && a.code);
  const byCode = (c) => accts.find((a) => a.code === c);
  if (!x.sales || !byCode(x.sales)) x.sales = (byName("Sales") || byCode("200") || accts.find((a) => ["REVENUE", "SALES"].includes(a.type) && a.code) || {}).code || "";
  x.codes ||= {};
  for (const c of CATS) {
    if (x.codes[c] && byCode(x.codes[c])) continue;
    const [n, code] = CAT_GUESS[c] || ["General Expenses", "429"];
    x.codes[c] = (byName(n) || byCode(code) || byName("General Expenses") || accts.find((a) => a.type === "EXPENSE" && a.code) || {}).code || "";
  }
  await s.set("xero", x);
  return x;
}

export function cleanXeroSettings(b, x) {
  const ids = new Set((x.accounts || []).map((a) => a.id)), codes = new Set((x.accounts || []).map((a) => a.code).filter(Boolean));
  const o = {};
  if (b.bank !== undefined) o.bank = ids.has(b.bank) ? b.bank : "";
  if (b.cardBank !== undefined) o.cardBank = ids.has(b.cardBank) ? b.cardBank : "";
  if (b.sales !== undefined && codes.has(b.sales)) o.sales = b.sales;
  if (b.from !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(b.from)) o.from = b.from;
  if (b.codes && typeof b.codes === "object") { o.codes = { ...(x.codes || {}) }; for (const c of CATS) if (codes.has(b.codes[c])) o.codes[c] = b.codes[c]; }
  return o;
}

// ---------- what should be in Xero ----------
const fp = (o) => createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 16);

// One Receive Money per payment received on a hub invoice.
function payTxn(x, set, d, p) {
  const gstReg = set.gst !== false;
  const card = /card/i.test(p.method || "") && x.cardBank;
  const desc = `${d.isDeposit ? "Deposit" : "Payment"} for invoice #${d.num}${d.site ? " · " + d.site : d.suburb ? " · " + d.suburb : ""}${d.service ? " · " + d.service : ""}`;
  return {
    Type: "RECEIVE", Date: p.date, Reference: `INV ${d.num} · ${p.method || "Payment"}`.slice(0, 255),
    BankAccount: { AccountID: card || x.bank },
    LineAmountTypes: gstReg ? "Inclusive" : "NoTax",
    LineItems: [{ Description: desc.slice(0, 4000), Quantity: 1, UnitAmount: r2(p.amt), AccountCode: x.sales, ...(gstReg ? { TaxType: d.gst ? "OUTPUT" : "EXEMPTOUTPUT" } : {}) }],
    _contact: (d.client?.name || "").trim() || "Bardon Clean client",
  };
}

// One Spend Money per hub expense, with the GST amount Jack entered.
function expTxn(x, set, e) {
  const gstReg = set.gst !== false;
  const base = { Description: [e.cat, e.note].filter(Boolean).join(" · ").slice(0, 4000) || "Expense", Quantity: 1, AccountCode: x.codes?.[e.cat] || x.codes?.Other || "" };
  let lines = [{ ...base, UnitAmount: r2(e.amt) }];
  if (gstReg) {
    const full = r2(e.amt / 11);
    if (!(e.gst > 0)) lines[0].TaxType = "EXEMPTEXPENSES";
    else if (Math.abs(e.gst - full) <= 0.01) lines[0].TaxType = "INPUT";
    else { // part of the receipt had GST (e.g. mixed shop): split into a taxable line and a GST-free line
      const taxable = Math.min(r2(e.amt), r2(e.gst * 11));
      lines = [{ ...base, UnitAmount: taxable, TaxType: "INPUT" }];
      if (r2(e.amt - taxable) > 0) lines.push({ ...base, Description: base.Description + " (GST-free part)", UnitAmount: r2(e.amt - taxable), TaxType: "EXEMPTEXPENSES" });
    }
  }
  return {
    Type: "SPEND", Date: e.date, Reference: (e.note || e.cat || "").slice(0, 255),
    BankAccount: { AccountID: x.bank }, LineAmountTypes: gstReg ? "Inclusive" : "NoTax", LineItems: lines,
    _contact: (e.who || "").trim() || "Sundry supplier",
  };
}

export async function plan(s, x) {
  const [docs, exps, set, map] = await Promise.all([loadDocs(s), loadExpenses(s), loadSettings(s), loadMap(s)]);
  const from = x.from || quarterStart();
  const want = { pay: {}, exp: {} };
  for (const d of docs) {
    if (d.kind !== "invoice") continue;
    for (const p of d.payments || []) if (p.date >= from && p.amt > 0) want.pay[p.id] = { txn: payTxn(x, set, d, p), label: `${d.client?.name || "Client"} paid $${r2(p.amt).toFixed(2)} (invoice #${d.num})` };
  }
  for (const e of exps) if (e.date >= from && e.amt > 0) want.exp[e.id] = { txn: expTxn(x, set, e), receipt: !!e.receipt, label: `${e.who || e.cat} $${r2(e.amt).toFixed(2)}` };
  for (const k of ["pay", "exp"]) for (const [id, w] of Object.entries(want[k])) w.fp = fp(w.txn);
  const todo = [];
  for (const k of ["pay", "exp"]) {
    for (const [id, w] of Object.entries(want[k])) { const m = map[k][id]; if (!m) todo.push({ op: "add", k, id, w }); else if (m.fp !== w.fp || (w.receipt && !m.att)) todo.push({ op: "update", k, id, w, m }); }
    for (const [id, m] of Object.entries(map[k])) if (!want[k][id]) todo.push({ op: "delete", k, id, m });
  }
  return { todo, map, counts: { pay: Object.keys(want.pay).length, exp: Object.keys(want.exp).length } };
}

async function contactId(s, x, map, name) {
  const key = name.toLowerCase();
  if (map.contacts[key]) return map.contacts[key];
  const where = `Name=="${name.replace(/["\\]/g, "")}"`;
  const found = await call(s, x, "GET", "Contacts?where=" + encodeURIComponent(where) + "&summaryOnly=true");
  let cid = found.Contacts?.[0]?.ContactID;
  if (!cid) { const made = await call(s, x, "PUT", "Contacts", { Contacts: [{ Name: name.slice(0, 255) }] }); cid = made.Contacts?.[0]?.ContactID; }
  if (!cid) throw new Error("Couldn't create the contact in Xero");
  map.contacts[key] = cid;
  return cid;
}

// ---------- sync ----------
export async function sync(s, { manual = false } = {}) {
  const x = await loadXero(s);
  if (!x.tokens || !x.tenantId) return { skipped: "not connected" };
  if (!x.bank) return { skipped: "Pick the bank account in Xero settings first." };
  // One sync at a time (the 15-minute run and a tap on "Sync now" could overlap).
  const lock = await s.get("xero/lock");
  if (lock && Date.now() - lock.at < 3 * 60e3) return { skipped: "A sync is already running. Try again in a minute." };
  await s.set("xero/lock", { at: Date.now() });
  const res = { added: 0, updated: 0, deleted: 0, errors: [], left: 0 };
  try {
    const { todo, map } = await plan(s, x);
    let ops = 0;
    for (const t of todo) {
      if (ops >= MAX_OPS) { res.left++; continue; }
      try {
        if (t.op === "delete") {
          ops++;
          await call(s, x, "POST", `BankTransactions/${t.m.xid}`, { BankTransactions: [{ BankTransactionID: t.m.xid, Status: "DELETED" }] });
          delete map[t.k][t.id]; res.deleted++;
          continue;
        }
        const { _contact, ...txn } = t.w.txn;
        txn.Contact = { ContactID: await contactId(s, x, map, _contact) }; ops++;
        let xid = t.m?.xid, att = t.m?.att;
        if (t.op === "add" || t.m.fp !== t.w.fp) {
          if (xid) txn.BankTransactionID = xid;
          const out = await call(s, x, xid ? "POST" : "PUT", "BankTransactions", { BankTransactions: [txn] }); ops++;
          xid = out.BankTransactions?.[0]?.BankTransactionID;
          if (!xid) throw new Error("Xero didn't confirm it");
        }
        map[t.k][t.id] = { xid, fp: t.w.fp, att, at: new Date().toISOString() };
        if (t.k === "exp" && t.w.receipt && !att) {
          const buf = await s.getBin(`rcpt/${t.id}`);
          if (buf) { await call(s, x, "PUT", `BankTransactions/${xid}/Attachments/receipt-${t.id}.jpg`, Buffer.from(buf), "image/jpeg"); ops++; map[t.k][t.id].att = true; }
        }
        t.op === "add" ? res.added++ : res.updated++;
      } catch (e) {
        const msg = /reconciled/i.test(e.message) ? `${e.message} Unreconcile it in Xero first, or leave it as is.` : e.message;
        res.errors.push(`${t.op === "delete" ? "Removing" : t.op === "add" ? "Sending" : "Updating"} ${t.w?.label || (t.k === "pay" ? "a payment" : "an expense")}: ${msg}`);
        if (e.status === 401 || e.status === 403 || /Reconnect/.test(e.message)) break;
        if (e.status === 429) { res.left += 1; break; }
      } finally { await s.set("xero/map", map); }
    }
  } finally {
    await s.del("xero/lock");
  }
  const xx = await loadXero(s);
  xx.last = { at: new Date().toISOString(), ...res, errors: res.errors.slice(0, 10) };
  await s.set("xero", xx);
  if (res.errors.length && !manual && (await once(s, `xero/${bneToday()}/${fp(res.errors)}`)))
    await notify(s, { type: "xero", title: "Xero sync needs a look", body: res.errors.slice(0, 3).join("\n"), tags: "warning", priority: 3, url: "/books/#/xero" });
  return res;
}

// Status for the settings screen.
export async function status(s) {
  const x = await loadXero(s);
  const out = {
    configured: configured(), redirect: redirectUri(), connected: !!(x.tokens && x.tenantId), broken: x.broken || "",
    org: x.tenantName || "", connectedAt: x.connectedAt || "", from: x.from || quarterStart(),
    bank: x.bank || "", cardBank: x.cardBank || "", sales: x.sales || "", codes: x.codes || {},
    accounts: x.accounts || [], last: x.last || null, cats: CATS,
  };
  if (out.connected && x.bank) {
    const { todo, counts } = await plan(s, x);
    out.waiting = todo.length; out.counts = counts;
  }
  return out;
}
