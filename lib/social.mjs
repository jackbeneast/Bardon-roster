// Social & Google posts: a rolling two-week posting plan for the Google Business Profile
// and Instagram, built from the hub's own job photos (the same bank the website photos use).
// Each post gets a photo (or a before/after pair), a caption, and is marked posted by Jack.
// Nothing is ever posted automatically: Jack shares each one from his phone.
//
// Blobs:  social/posts    [post]   (rolling; posted/skipped kept 120 days for "used photo" memory)
//         social/settings { gbp, ig }   posts per week
//         social/reject   { <photo id>: 1 }  photos Claude said aren't fit to post
//         social/pairrate { <after id>: { r, why, hd, al, p, at } }  Claude's rating of each line-up pair
//         social/pairhide { <after id>: 1 }  line-up pairs Jack hid
//         social/pairjack { <after id>: "y" | "n" }  Jack's own call on each pair (this is what counts)
import { randomBytes } from "node:crypto";
import { loadRoster, loadAllLive, bookingLive, ROOMS } from "./core.mjs";

const P = /^[a-f0-9]{24}$/;
const BNE = 10 * 3600e3;
export const todayBne = () => new Date(Date.now() + BNE).toISOString().slice(0, 10);
export const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dow = (d) => new Date(d + "T00:00:00Z").getUTCDay();
const AHEAD = 14, MISSED_DAYS = 7, KEEP_DAYS = 120;

// Which weekdays each channel posts on, by posts per week (0 = Sun).
export const DAYS = {
  gbp: { 1: [2], 2: [2, 4], 3: [1, 3, 5] },
  ig: { 2: [1, 4], 3: [1, 3, 6], 4: [1, 3, 5, 6] },
};
export const DEFAULTS = { gbp: 2, ig: 3 };
export const CH_NAME = { gbp: "Google", ig: "Instagram" };

export const SVC = { presale: "Pre-sale clean", bond: "Bond clean", deep: "Deep clean", other: "Clean" };
export const svcOf = (s) => { s = String(s || ""); return /pre.?sale/i.test(s) ? "presale" : /bond|lease|move/i.test(s) ? "bond" : /deep/i.test(s) ? "deep" : "other"; };
export const PAGE = {
  presale: "https://bardonclean.au/pre-sale-cleaning-brisbane/",
  bond: "https://bardonclean.au/bond-cleaning-brisbane/",
  deep: "https://bardonclean.au/deep-cleaning-brisbane/",
  other: "https://bardonclean.au/",
};
// What each post is about, rotated so the feed doesn't say the same thing every time.
const ANGLES = ["result", "standard", "service", "tip"];

export async function loadSettings(s) {
  const v = (await s.get("social/settings")) || {};
  return { gbp: DAYS.gbp[v.gbp] ? v.gbp : DEFAULTS.gbp, ig: DAYS.ig[v.ig] ? v.ig : DEFAULTS.ig };
}
export async function saveSettings(s, b) {
  const cur = await loadSettings(s);
  const out = { gbp: DAYS.gbp[+b.gbp] ? +b.gbp : cur.gbp, ig: DAYS.ig[+b.ig] ? +b.ig : cur.ig };
  await s.set("social/settings", out);
  return out;
}
export async function loadPosts(s) { const v = await s.get("social/posts"); return Array.isArray(v) ? v : []; }
export const savePosts = (s, l) => s.set("social/posts", l);

async function merged(s, prefix) {
  const out = {};
  for (const v of await Promise.all((await s.list(prefix)).map((k) => s.get(k)))) Object.assign(out, v || {});
  return out;
}

// ---- the photo bank ----
// Every real job's photos, sorted by the team (or by the hub's automatic sorting), minus anything
// flagged private, plus Jack's own uploaded website photos. Ratings come from the website picker.
export async function loadBank(s) {
  const [roster, raw, guess, rate, upsRaw, rej, prate, phide, pjack] = await Promise.all([
    loadRoster(s), loadAllLive(s), merged(s, "demoguess/"), merged(s, "demorate/"), s.get("demouploads"), s.get("social/reject"), s.get("social/pairrate"), s.get("social/pairhide"), s.get("social/pairjack"),
  ]);
  const bad = rej || {}, pr = prate || {}, hid = phide || {}, jk = pjack || {};
  const live = bookingLive(roster, raw);
  const afters = [], befores = [], lined = [], seen = new Set();
  for (const j of roster.jobs) {
    if (j.sample) continue;
    const key = j.group || j.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const svc = svcOf(j.service);
    const dates = roster.jobs.filter((x) => (x.group || x.id) === key).map((x) => x.date).sort();
    const list = (live[j.id] && live[j.id].photos) || [];
    // Afters taken in the line-up camera, with the before they were lined up against.
    const byId = Object.fromEntries(list.map((p) => [p.id, p]));
    for (const p of list) {
      const b = p.kind === "after" && p.pair && byId[p.pair];
      if (!b || !P.test(p.id) || !P.test(b.id) || b.kind !== "before" || bad[p.id] || bad[b.id] || hid[p.id]) continue;
      if ((guess[p.id] && guess[p.id].priv) || (guess[b.id] && guess[b.id].priv)) continue;
      lined.push({ a: { j: p.j || j.id, id: p.id }, b: { j: b.j || j.id, id: b.id }, room: p.room || b.room || "", shot: b.sl || "", svc, key, date: dates[0] || "", at: p.tk || p.at || "", rt: pr[p.id] || null, jk: jk[p.id] || "", prop: String(j.address || j.suburb || j.client || "Job " + (dates[0] || "")).slice(0, 80), sub: String(j.suburb || "").slice(0, 40) });
    }
    for (const p of list) {
      if (!P.test(p.id) || bad[p.id]) continue;
      const g = guess[p.id], r = rate[p.id];
      let room = p.room, kind = p.kind;
      if (!(ROOMS.includes(room) && (kind === "before" || kind === "after"))) {
        if (!g || g.priv || !ROOMS.includes(g.room) || !g.kind) continue;
        room = g.room; kind = g.kind;
      }
      if ((g && g.priv) || (r && r.p)) continue;
      const it = { j: p.j || j.id, id: p.id, room, svc, key, date: dates[0] || "", r: r ? r.r : 0 };
      (kind === "after" ? afters : befores).push(it);
    }
  }
  for (const u of Array.isArray(upsRaw) ? upsRaw : []) {
    if (!u || !P.test(String(u.id || "")) || bad[u.id]) continue;
    const r = rate[u.id];
    if (r && r.p) continue;
    afters.push({ j: "upload", id: u.id, room: ROOMS.includes(u.room) ? u.room : "", svc: SVC[u.svc] ? u.svc : "other", key: "upload", date: String(u.at || "").slice(0, 10), r: r ? r.r : 4 });
  }
  lined.sort((x, y) => (y.at || "").localeCompare(x.at || ""));
  return { afters, befores, lined };
}

// ---- picking photos ----
function usedIds(posts) { const u = new Set(); for (const p of posts) if (p.status !== "skipped") for (const x of p.ph || []) u.add(x.id); return u; }
// Higher is better. Unrated photos count as a 3; anything rated 1-2 is never posted.
function score(it, recent) {
  let v = (it.r || 3) * 10;
  if (recent.rooms.includes(it.room)) v -= 12;
  if (recent.svcs[0] === it.svc) v -= 6;
  if (recent.keys.includes(it.key)) v -= 8;
  if (it.date) v += Math.max(0, 6 - Math.floor((Date.now() - Date.parse(it.date)) / (30 * 864e5))); // fresher jobs a little higher
  return v;
}
function recentOf(posts, ch) {
  const l = posts.filter((p) => p.ch === ch && p.status !== "skipped").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return { rooms: l.slice(0, 2).map((p) => p.room), svcs: l.map((p) => p.svc), keys: l.slice(0, 2).map((p) => p.key) };
}
function pickAfter(bank, used, recent, avoid = new Set()) {
  const c = bank.afters.filter((x) => !used.has(x.id) && !avoid.has(x.id) && (x.r === 0 || x.r >= 3));
  c.sort((a, b) => score(b, recent) - score(a, recent));
  return c[0] || null;
}
// A before/after set: the best room on a job that has both. Up to 3 of each go to Claude,
// which picks the pair taken from the same spot (see matchPair in the write step).
function pickPair(bank, used, recent, avoid = new Set()) {
  const groups = {};
  for (const x of bank.afters) if (!used.has(x.id) && !avoid.has(x.id) && x.key !== "upload" && (x.r === 0 || x.r >= 3)) (groups[x.key + "|" + x.room] ||= { a: [], b: [] }).a.push(x);
  for (const x of bank.befores) if (!used.has(x.id) && !avoid.has(x.id) && groups[x.key + "|" + x.room]) groups[x.key + "|" + x.room].b.push(x);
  const ok = Object.values(groups).filter((g) => g.a.length && g.b.length);
  if (!ok.length) return null;
  ok.forEach((g) => { g.a.sort((x, y) => score(y, recent) - score(x, recent)); g.v = score(g.a[0], recent) + Math.min(g.b.length, 3); });
  ok.sort((x, y) => y.v - x.v);
  const g = ok[0];
  return { a: g.a.slice(0, 3), b: g.b.slice(0, 3) };
}
const ph = (x) => ({ j: x.j, id: x.id });
// Only pairs Jack marked post-worthy are used. Claude's ratings are a hint, never the decision.
export const goodLined = (x) => x.jk === "y";
function pickLined(bank, used, recent, avoid = new Set()) {
  const c = (bank.lined || []).filter((x) => goodLined(x) && !used.has(x.a.id) && !used.has(x.b.id) && !avoid.has(x.a.id));
  const v = (x) => (x.rt ? x.rt.r : 3) * 10;
  c.sort((x, y) => (v(y) - (recent.rooms.includes(y.room) ? 8 : 0) - (recent.keys.includes(y.key) ? 5 : 0)) - (v(x) - (recent.rooms.includes(x.room) ? 8 : 0) - (recent.keys.includes(x.key) ? 5 : 0)) || (y.at || "").localeCompare(x.at || ""));
  return c[0] || null;
}
const asLined = (post, x) => { Object.assign(post, { kind: "pair", lu: 1, ph: [ph(x.b), ph(x.a)], room: x.room, svc: x.svc, key: x.key, matched: 1 }); delete post.cand; if (x.rt && x.rt.hd) post.lhd = x.rt.hd; };

// Fills a post with photos. Google posts are after-only; Instagram alternates
// before/after pairs and single afters (when a job has a pair to offer).
function fill(post, bank, posts, avoid) {
  const used = usedIds(posts.filter((p) => p.id !== post.id)), recent = recentOf(posts.filter((p) => p.id !== post.id), post.ch);
  const igN = posts.filter((p) => p.ch === "ig" && p.id !== post.id && p.date < post.date && p.status !== "skipped").length;
  // Instagram: every second post is a before & after, but only from the line-up camera and only
  // pairs Claude rated strong. Loose befores and afters rarely line up, so they're never paired.
  if (post.ch === "ig" && igN % 2 === 1) { const x = pickLined(bank, used, recent, avoid); if (x) { asLined(post, x); return true; } }
  const pr = null;
  if (pr) {
    Object.assign(post, { kind: "pair", ph: [ph(pr.b[0]), ph(pr.a[0])], cand: { b: pr.b.map(ph), a: pr.a.map(ph) }, room: pr.a[0].room, svc: pr.a[0].svc, key: pr.a[0].key, matched: 0 });
    return true;
  }
  const a = pickAfter(bank, used, recent, avoid);
  if (!a) { Object.assign(post, { kind: "after", ph: [], room: "", svc: "other", key: "" }); delete post.cand; return false; }
  Object.assign(post, { kind: "after", ph: [ph(a)], room: a.room, svc: a.svc, key: a.key });
  delete post.cand; delete post.matched; delete post.lu; delete post.lhd;
  return true;
}

// ---- captions without Claude (also the instant placeholder while Claude writes) ----
const AREA = { "Kitchen": "kitchen", "Bathrooms": "bathroom", "Bedrooms": "bedroom", "Living & dining": "living area", "Laundry": "laundry", "Windows & tracks": "windows and tracks", "Outdoor & garage": "outdoor area" };
const HEAD = { "Kitchen": "Kitchen, cleaned top to bottom.", "Bathrooms": "Bathroom, detailed.", "Bedrooms": "Bedroom, cleaned.", "Living & dining": "Living area, cleaned.", "Laundry": "Laundry, cleaned.", "Windows & tracks": "Tracks, cleared.", "Outdoor & garage": "Outdoor area, cleaned." };
const TAGS = { presale: "#presaleclean #sellingbrisbane", bond: "#bondclean #endofleaseclean", deep: "#deepclean #springclean", other: "#housecleaning" };
const BASE_TAGS = "#brisbanecleaning #brisbaneinnerwest #bardonclean";
const ANGLE_LINE = {
  result: (a) => `Every surface in this ${a} done by hand, top to bottom.`,
  standard: () => `Fresh microfibre cloths on every clean, never reused between homes. Tools cleaned before and after every job.`,
  service: (a, svc) => svc === "presale" ? `Pre-sale cleaning, finished before the stylists and photographers arrive.` : svc === "bond" ? `Bond cleaning worked through area by area, so nothing gets missed.` : `A deep clean goes past the surfaces: the edges, tracks and corners a regular clean skips.`,
  tip: (a) => `Tip: work top to bottom in any ${a}. Dust falls, so do the high spots first and the floors last.`,
};
export function template(post) {
  const a = AREA[post.room] || "home", svc = post.svc || "other";
  const head = (post.lu && post.lhd) || HEAD[post.room] || "Handed back like this.";
  const line = (ANGLE_LINE[post.angle] || ANGLE_LINE.result)(a, svc);
  const what = `A ${a} after a recent ${SVC[svc].toLowerCase()} in Brisbane's inner west.`;
  if (post.ch === "gbp") return { head, cap: `${what} ${line}\n\nBardon Clean does pre-sale, bond and deep cleaning across Brisbane's inner west. Quotes at bardonclean.au.` };
  return { head, cap: `${head}\n\n${what}\n\n${line}\n\nPre-sale, bond and deep cleaning across Brisbane's inner west. Quotes at the link in our bio.\n\n${BASE_TAGS} ${TAGS[svc]}` };
}

// ---- the plan ----
const nid = () => randomBytes(6).toString("hex");
// Keeps two weeks of posts ready, marks old unposted ones as missed, prunes history.
export async function ensurePlan(s, today = todayBne()) {
  const [posts0, set] = await Promise.all([loadPosts(s), loadSettings(s)]);
  let posts = posts0.filter((p) => p.date >= addDays(today, -KEEP_DAYS));
  let changed = posts.length !== posts0.length;
  for (const p of posts) if (!p.status && p.date < addDays(today, -MISSED_DAYS)) { p.status = "skipped"; p.auto = 1; changed = true; }
  // Future posts on days the cadence no longer uses (settings changed) are dropped if untouched.
  const keep = (p) => p.status || p.date < today || p.extra || DAYS[p.ch][set[p.ch]].includes(dow(p.date)) || p.edited;
  if (posts.some((p) => !keep(p))) { posts = posts.filter(keep); changed = true; }
  let bank = null;
  for (const p of posts) {
    if (p.status || p.date < today) continue;
    if (p.kind === "pair" && !p.lu) { bank ||= await loadBank(s); fill(p, bank, posts); Object.assign(p, template(p), { ai: 0, txt: p.ch === "ig" ? 1 : 0 }); delete p.edited; changed = true; }
    else if (/restor/i.test((p.head || "") + (p.cap || ""))) { Object.assign(p, template(p), { ai: 0 }); delete p.edited; changed = true; }
  }
  // The very first plan starts with a Google post today, so there's something to post straight away.
  if (!posts0.length && !(await s.get("social/started"))) {
    await s.set("social/started", { at: new Date().toISOString() });
    if (!DAYS.gbp[set.gbp].includes(dow(today))) {
      bank = await loadBank(s);
      const post = { id: nid(), ch: "gbp", date: today, angle: ANGLES[0], status: "", ai: 0, extra: 1 };
      fill(post, bank, posts);
      Object.assign(post, template(post), { txt: 0 });
      posts.push(post); changed = true;
    }
  }
  for (let i = 0; i < AHEAD; i++) {
    const d = addDays(today, i);
    for (const ch of ["gbp", "ig"]) {
      if (!DAYS[ch][set[ch]].includes(dow(d)) || posts.some((p) => p.ch === ch && p.date === d && !p.extra)) continue;
      bank ||= await loadBank(s);
      const n = posts.filter((p) => p.ch === ch).length;
      const post = { id: nid(), ch, date: d, angle: ANGLES[n % ANGLES.length], status: "", ai: 0 };
      fill(post, bank, posts);
      Object.assign(post, template(post), { txt: ch === "ig" ? 1 : 0 });
      posts.push(post);
      changed = true;
    }
  }
  // Posts still waiting on a photo get another try when new photos come in.
  for (const p of posts) if (!p.status && !(p.ph || []).length && p.date >= today) { bank ||= await loadBank(s); if (fill(p, bank, posts)) { Object.assign(p, template(p)); changed = true; } }
  posts.sort((a, b) => (a.date + a.ch).localeCompare(b.date + b.ch));
  if (changed) await savePosts(s, posts);
  return { posts, settings: set };
}

export async function addExtra(s, ch, date) {
  const posts = await loadPosts(s), bank = await loadBank(s);
  const n = posts.filter((p) => p.ch === ch).length;
  const post = { id: nid(), ch, date, angle: ANGLES[n % ANGLES.length], status: "", ai: 0, extra: 1 };
  fill(post, bank, posts);
  Object.assign(post, template(post), { txt: ch === "ig" ? 1 : 0 });
  posts.push(post);
  posts.sort((a, b) => (a.date + a.ch).localeCompare(b.date + b.ch));
  await savePosts(s, posts);
  return post;
}

// A different photo for one post. reject: Claude (or Jack) said the old one isn't fit to post.
export async function swapPhoto(s, id, { reject = false, kind = "" } = {}) {
  const posts = await loadPosts(s), post = posts.find((p) => p.id === id);
  if (!post) return null;
  const old = (post.ph || []).map((x) => x.id).concat(((post.cand && post.cand.a) || []).map((x) => x.id));
  if (reject && old.length) { const r = (await s.get("social/reject")) || {}; for (const x of post.ph || []) r[x.id] = 1; await s.set("social/reject", r); }
  const bank = await loadBank(s), avoid = new Set([...(post.skip || []), ...old]);
  post.skip = [...avoid].slice(-60);
  if (kind === "pair" || (!kind && post.lu)) {
    const used = usedIds(posts.filter((p) => p.id !== id)), recent = recentOf(posts.filter((p) => p.id !== id), post.ch);
    const x = pickLined(bank, used, recent, avoid);
    if (x) { asLined(post, x); if (!post.edited) Object.assign(post, template(post), { ai: 0 }); post.fx = 0.5; post.fy = 0.5; await savePosts(s, posts); return post; }
    kind = "after";
  }
  if (kind === "after") {
    const used = usedIds(posts.filter((p) => p.id !== id)), recent = recentOf(posts.filter((p) => p.id !== id), post.ch);
    const pr = kind === "pair" ? pickPair(bank, used, recent, avoid) : null;
    const a = !pr ? pickAfter(bank, used, recent, avoid) : null;
    if (pr) Object.assign(post, { kind: "pair", ph: [ph(pr.b[0]), ph(pr.a[0])], cand: { b: pr.b.map(ph), a: pr.a.map(ph) }, room: pr.a[0].room, svc: pr.a[0].svc, key: pr.a[0].key, matched: 0 });
    else if (a) { Object.assign(post, { kind: "after", ph: [ph(a)], room: a.room, svc: a.svc, key: a.key }); delete post.cand; delete post.matched; }
    else post.ph = [];
  } else fill(post, bank, posts, avoid);
  if (!post.edited) Object.assign(post, template(post), { ai: 0 });
  post.fx = 0.5; post.fy = 0.5;
  await savePosts(s, posts);
  return post;
}

// ---- Claude: captions, and matching before/after shots ----
const API = "https://api.anthropic.com/v1/messages";
const MODEL = () => process.env.SOCIAL_MODEL || process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
export const aiOn = () => !!process.env.ANTHROPIC_API_KEY;

async function claude(body, ms = 9000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  let r;
  try {
    r = await fetch(API, { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: MODEL(), ...body }) });
  } catch (e) {
    throw Object.assign(new Error(e.name === "AbortError" ? "Claude took too long. Try again." : "Couldn't reach Claude"), { status: 504 });
  } finally { clearTimeout(t); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("social claude", r.status, JSON.stringify(d).slice(0, 400));
    throw Object.assign(new Error(r.status === 401 ? "The Claude key is wrong. Check ANTHROPIC_API_KEY in Netlify." : r.status === 429 || r.status === 529 ? "Claude is busy. Try again in a minute." : "Couldn't write the caption"), { status: 502 });
  }
  return (d.content || []).find((c) => c.type === "tool_use")?.input || {};
}

const BRAND = `You write social posts for Bardon Clean, a premium residential cleaning business in Brisbane's inner west, Australia, run by its owner Jack.
Services: pre-sale cleaning (before a home is styled, photographed and listed), bond / end-of-lease cleaning, and deep cleaning.

Voice: clean, direct, calm and confident. Plain Australian English and spelling (colour, organise). Short sentences. No hype words (amazing, sparkling!!, game-changer), no exclamation marks, at most one emoji and usually none. Sound like a careful tradesperson proud of the detail, not an ad agency.

Facts you may use (true, from the owner):
- Fresh microfibre cloths on every clean, never reused between homes.
- Tools cleaned before and after every clean.
- Products are premium and constantly tested.
- The team is paid above award.
- Fully insured, including $20m public liability.
- Clients get a private job link with before and after photos and a job report.

Hard rules:
- Describe only what you can actually see in the photo. Never invent details, results or stories.
- No statistics, percentages, counts or numbers of any kind except the insurance figure above. No "hundreds of homes", no review counts.
- No promises about how fast a quote comes back, how soon a clean can be booked, selling faster, higher sale prices, guarantees, re-cleans or return visits.
- Never mention a client, an address, a street, a suburb, or anything that could identify the home.
- Never include a phone number.
- Call kitchens, bathrooms, laundries etc. "areas" when speaking generally, not "rooms".
- No prices.
- Don't overclaim the result. Never use: restored, restoration, brand new, like new, as new, good as new, perfect, flawless, pristine, spotless, immaculate, transformed. Say what was actually done (cleaned, degreased, descaled, wiped down, detailed, cleared) and what you can see.`;

const CAP_TOOL = {
  name: "write_post",
  description: "Write the post for this photo, or reject the photo if it isn't fit to post.",
  input_schema: {
    type: "object",
    properties: {
      usable: { type: "boolean", description: "False if the after photo is dark, blurry, cluttered, not obviously clean, a toilet bowl, a drain, or otherwise unflattering for a premium cleaning brand." },
      private: { type: "boolean", description: "True if any photo shows faces, people, family photos, mail or documents with names, a street number, number plates or a distinctive street view." },
      headline: { type: "string", description: "Text that goes ON the image: 2 to 5 words naming the main thing shown, in the format '[Thing], [what was done].', e.g. 'Oven, degreased.', 'Shower glass, cleared.', 'Rangehood filters, degreased.', 'Kitchen, cleaned top to bottom.' Use a plain verb for what was done, never 'restored'. Must match the photo." },
      caption: { type: "string", description: "The post text." },
    },
    required: ["usable", "private", "headline", "caption"],
  },
};
const ANGLE_BRIEF = {
  result: "Angle: the result. Point out the specific detail visible in the photo that shows care (edges, grout, glass, tracks, stovetop, etc.).",
  standard: "Angle: how Bardon Clean works. Tie what's in the photo to ONE of the true facts (fresh cloths every clean, tools cleaned before and after, premium tested products, team paid above award).",
  service: "Angle: the service. Explain briefly what this kind of clean is for and who it's for, using the photo as the example.",
  tip: "Angle: a genuinely useful, accurate home-care tip related to what's shown (e.g. how to keep shower glass clear, how to stop grease building up on a rangehood). One tip, practical, no product brand names.",
};
const CH_BRIEF = {
  gbp: `Channel: Google Business Profile post (an "update" shown on Bardon Clean's Google listing to people searching locally).
Format: 50 to 110 words, 2 short paragraphs. No hashtags (they do nothing on Google). No phone number. No emoji. Mention naturally which service it was and that it's in Brisbane's inner west (good for local search), and end with a plain line pointing to quotes at bardonclean.au.`,
  ig: `Channel: Instagram feed post.
Format: first line is a short hook (can echo the headline). Then 2 to 4 short lines with a blank line between paragraphs. Then a call to action line: "Pre-sale, bond and deep cleaning across Brisbane's inner west. Quotes via the link in our bio." Then a final line of 6 to 9 relevant lowercase hashtags, always including #brisbanecleaning and #brisbaneinnerwest. Total under 130 words before the hashtags.`,
};

export async function writeCaption(post, imgs) {
  const content = [];
  if (post.kind === "pair") {
    content.push({ type: "text", text: "BEFORE photo:" }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgs[0] } });
    content.push({ type: "text", text: "AFTER photo (the one that matters for usable):" }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgs[1] } });
  } else content.push({ type: "text", text: "AFTER photo:" }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgs[0] } });
  content.push({ type: "text", text: `${CH_BRIEF[post.ch]}\n\nThe job was a ${SVC[post.svc || "other"].toLowerCase()}${post.room ? `; the area is ${post.room.toLowerCase()}` : ""}.\n${ANGLE_BRIEF[post.angle] || ANGLE_BRIEF.result}${post.kind === "pair" ? "\nThe image is a before/after comparison; the caption can reference the change, but only what's visible." : ""}` });
  const x = await claude({ max_tokens: 900, system: BRAND, tools: [CAP_TOOL], tool_choice: { type: "tool", name: CAP_TOOL.name }, messages: [{ role: "user", content }] });
  return {
    usable: x.usable !== false, priv: x.private === true,
    head: String(x.headline || "").replace(/[\r\n]+/g, " ").replace(/\brestored\b/gi, "cleaned").trim().slice(0, 48),
    cap: scrub(String(x.caption || "").trim().slice(0, 1400), post.ch),
  };
}
// Belt and braces on the rules Google enforces: no phone numbers in a Google post.
function scrub(t, ch) {
  const PH = /(?:\+?61[\s-]?|0)(?:4\d{2}[\s-]?\d{3}[\s-]?\d{3}|[2378][\s-]?\d{4}[\s-]?\d{4})/;
  t = t.replace(new RegExp("[^.!?\\n]*" + PH.source + "[^.!?\\n]*[.!?]*[ \\t]*", "g"), "").replace(/!{2,}/g, ".");
  t = t.replace(/\brestored\b/gi, "cleaned").replace(/\brestoration\b/gi, "detailed clean");
  if (ch === "gbp") t = t.replace(/[ \t]*#\w+/g, "").replace(/[ \t]{2,}/g, " ");
  return t.trim();
}

const MATCH_TOOL = {
  name: "pick_pair",
  description: "Pick the before/after combination that shows the same spot from a similar angle.",
  input_schema: {
    type: "object",
    properties: {
      b: { type: "integer", description: "Best before photo number (0 if none match)." },
      a: { type: "integer", description: "Best after photo number (0 if none match)." },
      same_spot: { type: "boolean", description: "True only if that before and after clearly show the same object or surface from a similar position." },
      good: { type: "boolean", description: "True if the pair shows an obvious, satisfying change and nothing gross (toilet bowls, drains) or private (faces, family photos, mail, street numbers)." },
    },
    required: ["b", "a", "same_spot", "good"],
  },
};
// befores/afters: [b64]. Returns { b, a } (0-based) or null when no pair lines up.
export async function matchPair(room, befores, afters) {
  const content = [];
  befores.forEach((d, i) => content.push({ type: "text", text: `Before ${i + 1}:` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: d } }));
  afters.forEach((d, i) => content.push({ type: "text", text: `After ${i + 1}:` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: d } }));
  content.push({ type: "text", text: `${room || "Home"} photos from one cleaning job. Pick the before/after pair for a side-by-side social post. Be strict about same_spot.` });
  const x = await claude({ max_tokens: 300, system: "You pick photos for a premium cleaning company's social media. Be strict.", tools: [MATCH_TOOL], tool_choice: { type: "tool", name: MATCH_TOOL.name }, messages: [{ role: "user", content }] }, 9500);
  const b = Number(x.b) - 1, a = Number(x.a) - 1;
  if (!x.same_spot || !x.good || !(b >= 0 && b < befores.length) || !(a >= 0 && a < afters.length)) return null;
  return { b, a };
}

// ---- line-up pairs: ranking the before & afters ----
const PAIR_TOOL = {
  name: "rate_pairs",
  description: "Rate every before/after pair for a premium cleaning company's Instagram and website.",
  input_schema: {
    type: "object",
    properties: {
      pairs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "The pair number given in the message." },
            aligned: { type: "boolean", description: "True if the before and after show the same thing from close to the same position, so they read as a fair side-by-side." },
            rating: { type: "integer", minimum: 1, maximum: 5, description: "How powerful the pair is as a before & after post. 5 = an obvious, satisfying change anyone sees in a second (built-up grease to clean steel, soap-scummed glass to clear, grimy tracks to clean, a cluttered dirty benchtop to a clear clean one), both shots well lit and lined up, nothing gross in the after. 4 = clear change, good photos. 3 = change visible but subtle or the photos are plain. 2 = hard to see a difference. 1 = no visible difference, dark, blurry, or unflattering (toilet bowls, drains, hair)." },
            private: { type: "boolean", description: "True if either photo shows faces, people, family photos, mail or documents with names, a street number, number plates or a distinctive street view." },
            why: { type: "string", description: "At most 10 words on what makes it strong or weak, naming what changed, e.g. 'Grease gone from rangehood filters, crisp lined-up angle'." },
            headline: { type: "string", description: "2 to 5 words for the post, format '[Thing], [what was done].', e.g. 'Oven, degreased.', 'Shower glass, cleared.'. Plain verbs only: never restored, transformed, like new, spotless." },
          },
          required: ["n", "aligned", "rating", "private", "why", "headline"],
        },
      },
    },
    required: ["pairs"],
  },
};
// pairs: [{ b: b64, a: b64, room }]. Returns [{ r, al, p, why, hd }] in the same order.
export async function ratePairs(pairs) {
  const content = [];
  pairs.forEach((x, i) => {
    content.push({ type: "text", text: `Pair ${i + 1}${x.room ? ` (${x.room})` : ""}, BEFORE:` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: x.b } });
    content.push({ type: "text", text: `Pair ${i + 1}, AFTER:` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: x.a } });
  });
  content.push({ type: "text", text: `Rate all ${pairs.length} pairs. The after was taken with a faded overlay of the before, so most will line up; judge how striking the change is. Be strict: only a few pairs deserve a 5.` });
  const x = await claude({ max_tokens: 900, system: "You pick before & after photos for a premium residential cleaning company's Instagram and website. Be strict and honest. Only judge what you can see.", tools: [PAIR_TOOL], tool_choice: { type: "tool", name: PAIR_TOOL.name }, messages: [{ role: "user", content }] }, 9500);
  const list = Array.isArray(x.pairs) ? x.pairs : [];
  return pairs.map((_, i) => {
    const y = list.find((z) => Number(z.n) === i + 1) || {};
    return {
      r: Math.max(1, Math.min(5, Number(y.rating) || 1)), al: y.aligned === true, p: y.private !== false,
      why: String(y.why || "").replace(/\brestor\w*/gi, "cleaned").slice(0, 90),
      hd: String(y.headline || "").replace(/[\r\n]+/g, " ").replace(/\brestored\b/gi, "cleaned").trim().slice(0, 48),
    };
  });
}

// Every line-up pair, best first, with whether it's already in a post.
export async function pairsView(s) {
  const [bank, posts] = await Promise.all([loadBank(s), loadPosts(s)]);
  const inPost = {};
  // Only a before & after post counts as using the pair; the after on its own in a post is just noted.
  const solo = {};
  for (const p of posts) if (p.status !== "skipped") for (const x of p.ph || []) (p.kind === "pair" ? inPost : solo)[x.id] = { id: p.id, ch: p.ch, date: p.date, status: p.status || "" };
  const out = bank.lined.map((x) => ({ ...x, post: inPost[x.a.id] || null, solo: !inPost[x.a.id] && solo[x.a.id] ? solo[x.a.id] : null }));
  out.sort((x, y) => (y.date || "").localeCompare(x.date || "") || x.key.localeCompare(y.key) || (x.at || "").localeCompare(y.at || ""));
  return out;
}
export async function savePairRatings(s, add) {
  const cur = (await s.get("social/pairrate")) || {};
  Object.assign(cur, add);
  await s.set("social/pairrate", cur);
}
export async function judgePair(s, aid, v) {
  const cur = (await s.get("social/pairjack")) || {};
  if (v === "y" || v === "n") cur[aid] = v; else delete cur[aid];
  await s.set("social/pairjack", cur);
}
export async function hidePair(s, aid, on = true) {
  const cur = (await s.get("social/pairhide")) || {};
  if (on) cur[aid] = 1; else delete cur[aid];
  await s.set("social/pairhide", cur);
}

// One post from a chosen line-up pair. Instagram gets the side-by-side; Google stays after-only.
export async function postFromPair(s, aid, ch, date) {
  const [posts, bank] = await Promise.all([loadPosts(s), loadBank(s)]);
  const x = bank.lined.find((y) => y.a.id === aid);
  if (!x) return null;
  const n = posts.filter((p) => p.ch === ch).length;
  const post = { id: nid(), ch, date, angle: ANGLES[n % ANGLES.length], status: "", ai: 0, extra: 1, picked: 1 };
  if (ch === "ig") asLined(post, x);
  else Object.assign(post, { kind: "after", ph: [ph(x.a)], room: x.room, svc: x.svc, key: x.key, ...(x.rt && x.rt.hd ? { head: x.rt.hd } : {}) });
  Object.assign(post, template(post), { txt: ch === "ig" ? 1 : 0 });
  if (ch === "gbp" && x.rt && x.rt.hd) post.head = x.rt.hd;
  posts.push(post);
  posts.sort((a, b) => (a.date + a.ch).localeCompare(b.date + b.ch));
  await savePosts(s, posts);
  return post;
}
