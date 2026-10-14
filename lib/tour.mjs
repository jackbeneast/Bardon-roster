// Walkthrough videos on a job (live record field "tour", shared by every day of a booking).
// Each item: { id: Bunny video guid, title, by, at, ready, failed?, secs? }
import { loadBooking, daysOf } from "./core.mjs";
import { bunnyOn, videoState } from "./bunny.mjs";

export const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TOUR_LIMIT = 12;

// Ask Bunny about any video still processing and save what changed.
// Bounded so a page load never waits on a long list.
export async function refreshTours(s, roster, jobs, max = 8) {
  if (!bunnyOn()) return false;
  const seen = new Set(); let calls = 0, changed = false;
  for (const job of jobs) {
    const home = daysOf(roster, job)[0];
    if (seen.has(home.id)) continue;
    seen.add(home.id);
    const raw = (await s.get(`live/${home.id}`)) || {};
    if (!(raw.tour || []).some((v) => !v.ready && !v.failed)) continue;
    const bk = await loadBooking(s, roster, home);
    let dirty = false;
    for (const v of bk.H.tour || []) {
      if (v.ready || v.failed || calls >= max) continue;
      calls++;
      try {
        const st = await videoState(v.id);
        if (st.ready !== !!v.ready || st.failed || st.secs !== v.secs || st.progress !== v.pct) {
          Object.assign(v, { ready: st.ready, secs: st.secs, pct: st.progress }); if (st.failed) v.failed = true; dirty = true;
        }
      } catch (e) { if (e.status === 404) { v.failed = true; dirty = true; } }
    }
    if (dirty) { await bk.save(); changed = true; }
  }
  return changed;
}
