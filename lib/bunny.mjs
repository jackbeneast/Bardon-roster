// Walkthrough videos live in Bunny Stream, not in Netlify. The phone uploads the file
// straight to Bunny (resumable, so a dropped signal picks up where it left off); this
// server only creates the video slot and signs the upload, so the key never reaches the browser.
//   BUNNY_STREAM_KEY      the Stream library's API key (Stream > library > API)
//   BUNNY_STREAM_LIBRARY  the library ID (defaults to Bardon Clean's library)
import { createHash } from "node:crypto";

const API = "https://video.bunnycdn.com";
export const LIB = () => String(process.env.BUNNY_STREAM_LIBRARY || "779139").trim();
const KEY = () => String(process.env.BUNNY_STREAM_KEY || "").trim();
export const bunnyOn = () => !!KEY();

// Bunny's encoding status codes
export const READY = 4;
const FAILED = [5, 6];

async function call(path, opt = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  let r;
  try {
    r = await fetch(`${API}/library/${LIB()}${path}`, {
      ...opt, signal: ctl.signal,
      headers: { AccessKey: KEY(), accept: "application/json", "content-type": "application/json", ...(opt.headers || {}) },
    });
  } catch (e) {
    throw Object.assign(new Error(e.name === "AbortError" ? "Bunny took too long to answer. Try again." : "Couldn't reach Bunny. Try again."), { status: 504 });
  } finally { clearTimeout(t); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = r.status === 401 ? "Bunny rejected the key. Check BUNNY_STREAM_KEY in Netlify." : d.message || d.Message || `Bunny error (${r.status})`;
    throw Object.assign(new Error(msg), { status: r.status === 404 ? 404 : 502 });
  }
  return d;
}

// Make an empty video in the library and sign a resumable upload into it.
export async function createUpload(title) {
  const v = await call("/videos", { method: "POST", body: JSON.stringify({ title: String(title || "Walkthrough").slice(0, 120) }) });
  if (!v.guid) throw Object.assign(new Error("Bunny didn't create the video"), { status: 502 });
  const expire = Math.floor(Date.now() / 1000) + 12 * 3600; // long enough for a slow upload on mobile data
  const signature = createHash("sha256").update(LIB() + KEY() + expire + v.guid).digest("hex");
  return { guid: v.guid, library: LIB(), expire, signature, endpoint: `${API}/tusupload` };
}

// Where the video is up to. ready = playable; failed = upload or encoding broke.
export async function videoState(guid) {
  const v = await call(`/videos/${encodeURIComponent(guid)}`);
  const st = Number(v.status);
  return { ready: st === READY, failed: FAILED.includes(st), progress: Number(v.encodeProgress) || 0, secs: Math.round(Number(v.length) || 0) };
}

export async function deleteVideo(guid) {
  try { await call(`/videos/${encodeURIComponent(guid)}`, { method: "DELETE" }); }
  catch (e) { if (e.status !== 404) throw e; } // already gone is fine
}

export const embedUrl = (guid) => `https://iframe.mediadelivery.net/embed/${LIB()}/${guid}?autoplay=true&preload=true&responsive=true`;
