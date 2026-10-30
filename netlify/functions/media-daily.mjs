// 6:30am Brisbane: read the news and flag any story Jack could comment on (lib/media.mjs).
import { store } from "../../lib/core.mjs";
import { scanMedia, markScanned, mediaAi } from "../../lib/media.mjs";

export default async () => {
  if (!mediaAi()) return;
  const s = await store();
  try { await markScanned(s, await scanMedia(s, { push: true })); }
  catch (e) { console.error("media scan", e); }
};

export const config = { schedule: "30 20 * * *" };
