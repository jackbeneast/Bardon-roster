// "Check the news now" from the PR tab. Runs in the background (up to 15 minutes), so the news
// reading and Claude's picks never hit the normal time limit. The page polls ?part=media for media/last.
import { store, checkAdmin } from "../../lib/core.mjs";
import { scanMedia, markScanned, mediaAi } from "../../lib/media.mjs";

export default async (req) => {
  const s = await store();
  if (!(await checkAdmin(s, req)) || !mediaAi()) return;
  try { await markScanned(s, await scanMedia(s, { push: false })); }
  catch (e) { console.error("media scan", e); await s.set("media/last", { at: new Date().toISOString(), read: 0, found: 0, err: e.message || "The news check didn't finish." }); }
};
