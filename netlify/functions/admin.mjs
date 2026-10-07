import { createHash } from "node:crypto";
import { store, json, checkAdmin, adminIsSet, setAdmin } from "../../lib/core.mjs";

// One-time reset code given to Jack directly (only its hash lives here). Works once.
const RESET_HASH = "48ebef29c86c57b7f9f2e77dc78246ba3c90396a76ff4f6e6f57fc88830c564f";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { b = {}; }
  const s = await store();
  if (b.action === "setup") {
    if (await adminIsSet(s)) return json({ error: "A password is already set" }, 409);
    const pw = String(b.password || "");
    if (pw.length < 6) return json({ error: "Use at least 6 characters" }, 400);
    await setAdmin(s, pw);
    return json({ ok: true });
  }
  if (b.action === "reset") {
    const code = String(b.code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (await s.get(`reset-used/${RESET_HASH}`)) return json({ error: "That reset code has already been used. Ask Claude for a new one." }, 410);
    if (createHash("sha256").update(code).digest("hex") !== RESET_HASH) return json({ error: "That code isn't right. Check the dashes and try again." }, 401);
    const pw = String(b.password || "");
    if (pw.length < 6) return json({ error: "Use at least 6 characters" }, 400);
    await setAdmin(s, pw);
    await s.set(`reset-used/${RESET_HASH}`, { at: new Date().toISOString() });
    return json({ ok: true });
  }
  if (b.action === "change") {
    if (!(await checkAdmin(s, req))) return json({ error: "Wrong password" }, 401);
    const pw = String(b.password || "");
    if (pw.length < 6) return json({ error: "Use at least 6 characters" }, 400);
    await setAdmin(s, pw);
    return json({ ok: true });
  }
  if (await checkAdmin(s, req)) return json({ ok: true });
  // Typing the one-time reset code into the normal password box also works:
  // it becomes the new password.
  const typed = String(req.headers.get("x-admin-key") || "").trim().toUpperCase();
  if (typed && createHash("sha256").update(typed).digest("hex") === RESET_HASH && !(await s.get(`reset-used/${RESET_HASH}`))) {
    await setAdmin(s, String(req.headers.get("x-admin-key") || ""));
    await s.set(`reset-used/${RESET_HASH}`, { at: new Date().toISOString() });
    return json({ ok: true, reset: true });
  }
  return json({ ok: false }, 200);
};

export const config = { path: "/api/admin" };
