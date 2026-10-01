import { store, json, checkAdmin, adminIsSet, setAdmin } from "../../lib/core.mjs";

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
  if (b.action === "change") {
    if (!(await checkAdmin(s, req))) return json({ error: "Wrong password" }, 401);
    const pw = String(b.password || "");
    if (pw.length < 6) return json({ error: "Use at least 6 characters" }, 400);
    await setAdmin(s, pw);
    return json({ ok: true });
  }
  return json({ ok: await checkAdmin(s, req) }, 200);
};

export const config = { path: "/api/admin" };
