// Card payments through Stripe Checkout. Needs STRIPE_SECRET_KEY set in Netlify.
// Optional STRIPE_WEBHOOK_SECRET records payments even if the client closes the page early.
import { createHmac, timingSafeEqual } from "node:crypto";
import { store, json } from "../../lib/core.mjs";
import { findByToken, totals, recordPayment, today } from "../../lib/docs.mjs";
import { notify, money } from "../../lib/notify.mjs";

async function stripe(path, params, method = "POST") {
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: { authorization: "Bearer " + process.env.STRIPE_SECRET_KEY, "content-type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? new URLSearchParams(params).toString() : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || "Stripe error");
  return d;
}

async function settle(s, session) {
  if (session.payment_status !== "paid") return false;
  const d = await s.get(`doc/${session.metadata?.doc}`);
  if (!d || d.token !== session.metadata?.token) return false;
  const pid = await recordPayment(s, d, { amt: session.amount_total / 100, date: today(), method: "Card", ref: session.id });
  if (pid) {
    const t = totals(d), who = d.client?.name || "A client";
    await notify(s, { type: "paid", title: `${who} paid ${money(session.amount_total / 100)} by card`, body: `Invoice #${d.num}${d.site ? " · " + d.site : ""}${t.due > 0.005 ? `\n${money(t.due)} still owing` : "\nPaid in full"}`, tags: "moneybag", priority: 4, url: `/money/#/doc/${d.id}` });
  }
  return true;
}

export default async (req) => {
  const s = await store();
  const u = new URL(req.url);

  if (u.pathname.endsWith("/stripe-hook")) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const raw = await req.text();
    if (!secret) return json({ error: "Not set up" }, 400);
    const parts = Object.fromEntries((req.headers.get("stripe-signature") || "").split(",").map((x) => x.split("=")));
    const expect = createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
    const ok = parts.v1 && parts.v1.length === expect.length && timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expect));
    if (!ok || Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return json({ error: "Bad signature" }, 400);
    const ev = JSON.parse(raw);
    if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") await settle(s, ev.data.object);
    return json({ received: true });
  }

  if (!process.env.STRIPE_SECRET_KEY) return json({ error: "Card payments aren't set up yet. Please pay by bank transfer." }, 400);

  // Back from Stripe: confirm the session and record the payment.
  if (req.method === "GET") {
    const sid = u.searchParams.get("s") || "";
    if (!/^cs_[\w]+$/.test(sid)) return json({ error: "Bad session" }, 400);
    try { const ses = await stripe("checkout/sessions/" + sid, null, "GET"); return json({ ok: await settle(s, ses) }); }
    catch (e) { return json({ error: e.message }, 502); }
  }

  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
    const d = await findByToken(s, b.t);
    if (!d || d.kind !== "invoice" || d.status === "draft") return json({ error: "This invoice isn't active." }, 404);
    const t = totals(d);
    if (t.due < 0.5) return json({ error: "This invoice is already paid. Thank you." }, 400);
    const base = u.origin + "/i/" + d.token;
    try {
      const ses = await stripe("checkout/sessions", {
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "aud",
        "line_items[0][price_data][unit_amount]": String(Math.round(t.due * 100)),
        "line_items[0][price_data][product_data][name]": `Bardon Clean invoice #${d.num}`,
        ...(d.site ? { "line_items[0][price_data][product_data][description]": d.site.slice(0, 200) } : {}),
        ...(d.client?.email ? { customer_email: d.client.email } : {}),
        success_url: base + "?paid={CHECKOUT_SESSION_ID}",
        cancel_url: base,
        "metadata[doc]": d.id, "metadata[token]": d.token,
        "payment_intent_data[description]": `Invoice #${d.num}`,
      });
      return json({ url: ses.url });
    } catch (e) { return json({ error: "Couldn't start card payment: " + e.message }, 502); }
  }
  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: ["/api/pay", "/api/stripe-hook"] };
