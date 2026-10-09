// Client text templates.
// GET  -> { sections, vars, templates, reviewLink }
// POST {action:"save", id, text, title?} | {action:"reset", id}
//      {action:"add", section, title, text} | {action:"delete", id} | {action:"review", reviewLink}
import { store, json, checkAdmin } from "../../lib/core.mjs";
import { SECTIONS, VARS, loadTemplates, updateTemplates } from "../../lib/templates.mjs";

export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  if (req.method === "GET") {
    const t = await loadTemplates(s);
    return json({ sections: SECTIONS, vars: VARS, templates: t.list, reviewLink: t.reviewLink });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const r = await updateTemplates(s, b);
  if (r.error) return json({ error: r.error }, 400);
  const t = await loadTemplates(s);
  return json({ ok: true, templates: t.list, reviewLink: t.reviewLink });
};

export const config = { path: "/api/templates" };
