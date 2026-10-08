// Xero connection (Jack only) and the OAuth callback Xero sends him back to.
import { store, json, checkAdmin } from "../../lib/core.mjs";
import { configured, startConnect, finishConnect, disconnect, refreshAccounts, loadXero, cleanXeroSettings, sync, status } from "../../lib/xero.mjs";
import { notify } from "../../lib/notify.mjs";

const back = (msg, ok) => new Response(null, { status: 302, headers: { location: `/books/#/xero?${ok ? "ok" : "err"}=${encodeURIComponent(msg)}`, "cache-control": "no-store" } });

export default async (req) => {
  const s = await store();
  const u = new URL(req.url);

  // Xero redirects the browser here after Jack approves the connection.
  if (u.pathname.endsWith("/callback")) {
    if (u.searchParams.get("error")) return back(u.searchParams.get("error_description") || "Xero connection was cancelled.", false);
    try {
      const x = await finishConnect(s, u.searchParams.get("code") || "", u.searchParams.get("state") || "");
      await notify(s, { type: "xero", title: `Xero connected to ${x.tenantName}`, body: "Payments and expenses will start going across once you've picked the bank account.", tags: "link", url: "/books/#/xero" });
      return back(`Connected to ${x.tenantName}`, true);
    } catch (e) { return back(e.message || "Couldn't connect Xero.", false); }
  }

  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  if (req.method === "GET") {
    try { return json(await status(s)); } catch (e) { return json({ error: e.message }, 502); }
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }

  try {
    switch (b.action) {
      case "connect":
        if (!configured()) return json({ error: "Xero app keys aren't set in Netlify yet (XERO_CLIENT_ID and XERO_CLIENT_SECRET)." }, 400);
        return json({ url: await startConnect(s) });
      case "disconnect":
        await disconnect(s); return json({ ok: true });
      case "accounts":
        await refreshAccounts(s); return json({ ok: true });
      case "settings": {
        const x = await loadXero(s);
        await s.set("xero", { ...x, ...cleanXeroSettings(b, x) });
        return json({ ok: true });
      }
      case "sync":
        return json(await sync(s, { manual: true }));
    }
  } catch (e) { return json({ error: e.message || "Xero didn't respond. Try again." }, 502); }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: ["/api/xero", "/api/xero/callback"] };
