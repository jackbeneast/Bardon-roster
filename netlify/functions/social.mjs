// Social & Google posts (admin only). See lib/social.mjs.
//   GET                          -> { posts, settings, ai, today, pages }   (tops up the two-week plan)
//   POST { action: "write", id }  -> Claude matches the before/after pair (if needed) then writes the caption.
//                                    Returns { post, again } — call again while again is true (one Claude call per request).
//   POST { action: "swap", id, kind?, reject? }   -> a different photo ("after" | "pair" | "" = same kind)
//   POST { action: "save", id, cap?, head?, txt?, fx?, fy? }  -> Jack's edits
//   POST { action: "status", id, status: "posted" | "skipped" | "" }
//   POST { action: "extra", ch, date? }   -> one more post (e.g. a second one today)
//   POST { action: "settings", gbp, ig }  -> posts per week
import { store, json, checkAdmin } from "../../lib/core.mjs";
import { ensurePlan, loadPosts, savePosts, swapPhoto, addExtra, saveSettings, writeCaption, matchPair, template, aiOn, todayBne, PAGE, DAYS } from "../../lib/social.mjs";

const D = /^\d{4}-\d{2}-\d{2}$/;
const thumb = async (s, x) => (await s.getBin(`photo/${x.j}/${x.id}.t`)) || (await s.getBin(`photo/${x.j}/${x.id}`));
const b64 = (buf) => Buffer.from(buf).toString("base64");

export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req))) return json({ error: "Log in first" }, 401);
  const today = todayBne();

  if (req.method === "GET") {
    const { posts, settings } = await ensurePlan(s, today);
    return json({ posts, settings, ai: aiOn(), today, pages: PAGE, days: DAYS });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad data" }, 400); }
  const id = String(b.id || "");

  if (b.action === "settings") return json({ ok: true, settings: await saveSettings(s, b), ...(await ensurePlan(s, today)) });

  if (b.action === "extra") {
    const ch = b.ch === "gbp" || b.ch === "ig" ? b.ch : null;
    if (!ch) return json({ error: "Pick Google or Instagram" }, 400);
    const date = D.test(String(b.date || "")) ? b.date : today;
    return json({ ok: true, post: await addExtra(s, ch, date) });
  }

  if (b.action === "swap") {
    const post = await swapPhoto(s, id, { reject: !!b.reject, kind: b.kind === "after" || b.kind === "pair" ? b.kind : "" });
    if (!post) return json({ error: "That post isn't there any more. Refresh." }, 404);
    return json({ ok: true, post });
  }

  const posts = await loadPosts(s), post = posts.find((p) => p.id === id);
  if (!post) return json({ error: "That post isn't there any more. Refresh." }, 404);

  if (b.action === "save") {
    if (typeof b.cap === "string") { post.cap = b.cap.slice(0, 2200); post.edited = 1; }
    if (typeof b.head === "string") { post.head = b.head.replace(/[\r\n]+/g, " ").slice(0, 60); post.edited = 1; }
    if (b.txt !== undefined) post.txt = b.txt ? 1 : 0;
    for (const k of ["fx", "fy"]) if (b[k] !== undefined) post[k] = Math.max(0, Math.min(1, Number(b[k]) || 0));
    await savePosts(s, posts);
    return json({ ok: true, post });
  }

  if (b.action === "status") {
    const st = ["posted", "skipped", ""].includes(b.status) ? b.status : null;
    if (st === null) return json({ error: "Bad status" }, 400);
    post.status = st; delete post.auto;
    if (st === "posted") post.postedAt = new Date().toISOString(); else delete post.postedAt;
    await savePosts(s, posts);
    return json({ ok: true, post });
  }

  if (b.action === "write") {
    if (!aiOn()) return json({ error: "Captions need the Claude key (ANTHROPIC_API_KEY) in Netlify. The ready-made caption still works.", off: true }, 503);
    if (!(post.ph || []).length) return json({ error: "No photo yet. Sort some job photos, then tap Different photo." }, 400);
    // Step 1 (pairs only): choose the before and after that line up.
    if (post.kind === "pair" && !post.matched && post.cand) {
      const [bs, as] = await Promise.all([Promise.all(post.cand.b.map((x) => thumb(s, x))), Promise.all(post.cand.a.map((x) => thumb(s, x)))]);
      const B = post.cand.b.filter((_, i) => bs[i]), A = post.cand.a.filter((_, i) => as[i]);
      let m = null;
      if (B.length && A.length) {
        try { m = await matchPair(post.room, bs.filter(Boolean).map(b64), as.filter(Boolean).map(b64)); }
        catch (e) { return json({ error: e.message }, e.status || 502); }
      }
      if (m) { post.ph = [B[m.b], A[m.a]]; post.matched = 1; }
      else { post.kind = "after"; post.ph = [A[0] || post.cand.a[0]]; delete post.cand; delete post.matched; }
      if (!post.edited) Object.assign(post, template(post));
      await savePosts(s, posts);
      return json({ ok: true, post, again: true });
    }
    // Step 2: the caption (and a last check that the photo is fit to post).
    const bins = await Promise.all(post.ph.map((x) => thumb(s, x)));
    if (bins.some((x) => !x)) { const np = await swapPhoto(s, id); return json({ ok: true, post: np, again: !!(np && np.ph.length), note: "A photo was missing, so it's been swapped." }); }
    let w;
    try { w = await writeCaption(post, bins.map(b64)); }
    catch (e) { return json({ error: e.message }, e.status || 502); }
    if (!w.usable || w.priv) {
      const np = await swapPhoto(s, id, { reject: true });
      return json({ ok: true, post: np, again: !!(np && np.ph.length), note: w.priv ? "That photo showed something private, so it's been swapped." : "That photo wasn't strong enough, so it's been swapped." });
    }
    const fresh = await loadPosts(s), p2 = fresh.find((p) => p.id === id);
    if (!p2) return json({ error: "That post isn't there any more. Refresh." }, 404);
    Object.assign(p2, { cap: w.cap || p2.cap, head: w.head || p2.head, ai: 1 });
    delete p2.edited;
    await savePosts(s, fresh);
    return json({ ok: true, post: p2 });
  }

  return json({ error: "Unknown request" }, 400);
};

export const config = { path: "/api/social" };
