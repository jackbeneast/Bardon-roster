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
const ANGLES = ["result", "jack", "season", "standard", "service", "hot", "tip", "result"];

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
  const [roster, raw, guess, rate, upsRaw, rej, prate, phide, pjack, rba] = await Promise.all([
    loadRoster(s), loadAllLive(s), merged(s, "demoguess/"), merged(s, "demorate/"), s.get("demouploads"), s.get("social/reject"), s.get("social/pairrate"), s.get("social/pairhide"), s.get("social/pairjack"), s.get("reportba"),
  ]);
  const bad = rej || {}, pr = prate || {}, hid = phide || {}, jk = { ...(pjack || {}) };
  // Pairs Jack picked for a client's report count as approved for posts too, unless he marked them "not using".
  for (const v of Object.values(rba || {})) if (v && v.st === "y") for (const id of v.ids || []) if (!jk[id]) jk[id] = "y";
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
const asAfterOf = (post, x) => { Object.assign(post, { kind: "after", ph: [ph(x.a)], room: x.room, svc: x.svc, key: x.key, ap: 1 }); delete post.cand; delete post.matched; delete post.lu; if (x.rt && x.rt.hd) post.lhd = x.rt.hd; else delete post.lhd; };
const asLined = (post, x) => { Object.assign(post, { kind: "pair", lu: 1, ap: 1, ph: [ph(x.b), ph(x.a)], room: x.room, svc: x.svc, key: x.key, matched: 1 }); delete post.cand; if (x.rt && x.rt.hd) post.lhd = x.rt.hd; };

// Fills a post with photos. Google posts are after-only; Instagram alternates
// before/after pairs and single afters (when a job has a pair to offer).
function fill(post, bank, posts, avoid) {
  const used = usedIds(posts.filter((p) => p.id !== post.id)), recent = recentOf(posts.filter((p) => p.id !== post.id), post.ch);
  const igN = posts.filter((p) => p.ch === "ig" && p.id !== post.id && p.date < post.date && p.status !== "skipped").length;
  // Instagram: every second post is a before & after, but only from the line-up camera and only
  // pairs Claude rated strong. Loose befores and afters rarely line up, so they're never paired.
  if (post.ch === "ig" && igN % 2 === 1) { const x = pickLined(bank, used, recent, avoid); if (x) { asLined(post, x); return true; } }
  // Google: after photos only, but the after from a pair Jack approved comes first.
  if (post.ch === "gbp") { const x = pickLined(bank, used, recent, avoid); if (x && !used.has(x.a.id)) { asAfterOf(post, x); return true; } }
  const pr = null;
  if (pr) {
    Object.assign(post, { kind: "pair", ph: [ph(pr.b[0]), ph(pr.a[0])], cand: { b: pr.b.map(ph), a: pr.a.map(ph) }, room: pr.a[0].room, svc: pr.a[0].svc, key: pr.a[0].key, matched: 0 });
    return true;
  }
  const a = pickAfter(bank, used, recent, avoid);
  if (!a) { Object.assign(post, { kind: "after", ph: [], room: "", svc: "other", key: "" }); delete post.cand; return false; }
  Object.assign(post, { kind: "after", ph: [ph(a)], room: a.room, svc: a.svc, key: a.key });
  delete post.cand; delete post.matched; delete post.lu; delete post.lhd; delete post.ap;
  return true;
}

// ---- captions without Claude (also the instant placeholder while Claude writes) ----
// Written in Bardon Clean's voice. Several versions per area and angle, picked by post id so the feed doesn't repeat.
const AREA = { "Kitchen": "kitchen", "Bathrooms": "bathroom", "Bedrooms": "bedroom", "Living & dining": "living area", "Laundry": "laundry", "Windows & tracks": "windows and tracks", "Outdoor & garage": "outdoor area" };
const HEAD = {
  "Kitchen": ["Where buyers look first.", "The kitchen, done properly."],
  "Bathrooms": ["Where bathrooms give themselves away.", "Bathroom, detailed."],
  "Bedrooms": ["Edges included.", "Top to bottom."],
  "Living & dining": ["Clean you notice at the door.", "Light catches everything."],
  "Laundry": ["The area everyone forgets.", "Laundry, behind and under."],
  "Windows & tracks": ["Tracks, actually cleared.", "Glass, without the smears."],
  "Outdoor & garage": ["Outside counts too.", "The way in."],
};
const HOOK = {
  "Kitchen": ["Buyers open the oven. And the pantry, and the cupboards.", "The rangehood is the thing nobody looks at until they're buying the house.", "Kitchens hold on to grease in places you stop seeing: the rangehood, the splashback, the cupboard fronts."],
  "Bathrooms": ["Shower screens give a bathroom away.", "Soap film builds up so slowly you stop noticing it.", "Grout is where a bathroom shows its age, and where we spend our time."],
  "Bedrooms": ["Fan blades, skirting boards, window sills. The dust lives on the edges.", "A bedroom looks clean until the light hits the skirting boards."],
  "Living & dining": ["The clean you notice when you open the front door.", "Good light is great for a listing photo. It also shows every smear and speck of dust."],
  "Laundry": ["The laundry is the area everyone forgets until it's time to move out.", "Lint, detergent drips and dust behind the machine. The laundry collects it all quietly."],
  "Windows & tracks": ["Window tracks are where a quick clean gets caught out.", "Clean glass changes how a whole area feels."],
  "Outdoor & garage": ["The first thing anyone sees is the way in.", "Outdoor areas take the brunt of Brisbane weather."],
};
const SVC_LINE = {
  presale: ["On a pre-sale clean we work to what the camera and buyers will see, so this got proper time.", "When a home's going to market, the photos are the first inspection. We clean for the lens."],
  bond: ["On a bond clean we work through the same list property managers check against, area by area.", "Bond cleans are about the details on the exit checklist, so that's where the time goes."],
  deep: ["A deep clean goes past the surfaces, into the edges, tracks and corners a regular clean skips.", "This is what a deep clean is for: the build-up that a weekly wipe never reaches."],
  other: ["We work top to bottom, area by area, so nothing gets missed."],
};
const STANDARD = [
  "Slightly gross thought: the cloth that cleaned someone else's toilet yesterday. Where is it today? At our place, it's in the wash. Every home gets a fresh set of microfibre cloths.",
  "Our tools get cleaned before and after every job. Not exciting. Just how it should be.",
  "Our team is paid above award. Good cleaners stay, and you can see it in the corners.",
  "Every clean comes with a private link that shows each area as it's finished. You shouldn't have to go back and check.",
];
const TIP = {
  "Kitchen": "Free tip: soak your rangehood filters in hot water with a bit of dishwashing liquid every couple of months. Grease lifts off easily before it sets. Leave it a year and it's a different story.",
  "Bathrooms": "Free tip: keep a squeegee in the shower and give the glass ten seconds after each use. It's the most boring habit with the best payoff.",
  "Windows & tracks": "Free tip: vacuum window tracks dry before you wipe them. Wet dust just turns into mud in the corners.",
  "_": "Free tip: clean top to bottom. Dust falls, so do the high spots first and the floors last. Saves doing it twice.",
};
const JACK = [
  "Confession: I get weirdly invested in the bits nobody looks at. Tracks, skirting, the oven door glass. They're what tell you whether a cleaner did the job or just the parts you'd notice.",
  "I started Bardon Clean because I kept hearing the same stories: cleaners who didn't turn up, rushed jobs, and no way of knowing what was actually done. This is the standard I wanted instead.",
];
const HOT = [
  "Mild hot take: the bits nobody looks at matter most. Anyone can make a benchtop shine. The tracks, the grout and the oven glass are where you find out who actually did the job.",
  "Mild hot take: a clean you can't check is a clean you're taking on faith. That's why every one of ours comes with a link showing each area as it's finished.",
];
const SEASON_DRY = ["Brisbane winter is dry and dusty. It settles on every sill, blind slat and skirting board, and the low light shows all of it.", "Dry season dust gets everywhere: tracks, fans, blinds, the tops of door frames. The places you only notice when the sun comes in sideways."];
const SEASON_LINE = ["Brisbane humidity is great for the garden and rough on grout and shower screens. This time of year mould moves in fast, so the wet areas get extra time.", "Storm season means dust, leaf litter and rain spatter in every track and on every pane. The outside of a home takes a beating this time of year."];
const CTA_IG = ["Listing soon? Link's in the bio.", "Quotes through the link in our bio.", "Got one like this? Link's in the bio.", "Moving out or selling? Link's in the bio."];
const CTA_GBP = ["Quotes at bardonclean.au.", "If yours needs the same, get a quote at bardonclean.au.", "You can grab a quote at bardonclean.au."];
const TAGS = { presale: "#presaleclean #brisbanerealestate", bond: "#bondclean #endofleaseclean", deep: "#deepclean #bardonclean", other: "#housecleaning #bardonclean" };
const BASE_TAGS = "#brisbanecleaning #brisbaneinnerwest";
const pick = (arr, seed, k = 0) => { let h = 7; for (const c of String(seed || "") + k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return arr[h % arr.length]; };
export const CAPV = 3; // bump to rewrite every unposted, unedited caption in the new voice
export function template(post) {
  const room = post.room, svc = post.svc || "other", id = post.id || post.key || "";
  const head = ((post.lu || post.ap) && post.lhd) || pick(HEAD[room] || ["Top to bottom, edges included."], id, 1);
  const angle = post.angle || "result";
  let hook = pick(HOOK[room] || ["You stop seeing the build-up when you live with it. Everyone else doesn't."], id, 2);
  let body = pick(SVC_LINE[svc] || SVC_LINE.other, id, 4);
  if (angle === "standard") { hook = pick(STANDARD, id, 3); }
  else if (angle === "tip") body = TIP[room] || TIP._;
  else if (angle === "jack") { hook = pick(JACK, id, 3); body = "— Jack"; }
  else if (angle === "hot") { hook = pick(HOT, id, 3); body = "Agree or disagree? Tell me in the comments."; }
  else if (angle === "season") { const m = Number(String(post.date || "").slice(5, 7)) || 1; body = hook; hook = pick(m >= 5 && m <= 9 ? SEASON_DRY : SEASON_LINE, id, 3); }
  const svcName = { presale: "pre-sale clean", bond: "bond clean", deep: "deep clean", other: "clean" }[svc];
  if (post.ch === "gbp") return { capv: CAPV, head, cap: `${hook} ${body.replace(/^— Jack$/, "").replace(/ ?Tell me in the comments\.|Agree or disagree\? ?/g, "")}`.trim() + `\n\nFrom a ${svcName} in Brisbane's inner west. ${pick(CTA_GBP, id, 5)}` };
  return { capv: CAPV, head, cap: `${hook}\n\n${body}\n\n${pick(CTA_IG, id, 5)}\n\n${BASE_TAGS} ${TAGS[svc]}` };
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
    else if (!p.edited && p.capv !== CAPV) { Object.assign(p, template(p), { ai: 0 }); changed = true; }
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
  // A pair Jack has since marked "not using" comes back out of any upcoming post he hasn't posted or edited.
  if (posts.some((p) => !p.status && p.date >= today && p.ap && !p.edited)) {
    bank ||= await loadBank(s);
    const no = new Set(bank.lined.filter((x) => !goodLined(x)).map((x) => x.a.id));
    for (const p of posts) if (!p.status && p.date >= today && p.ap && !p.edited && (p.ph || []).some((y) => no.has(y.id))) {
      const drop = new Set((p.ph || []).map((y) => y.id)); p.ph = []; delete p.ap; delete p.picked;
      fill(p, bank, posts, drop); Object.assign(p, template(p), { ai: 0 }); changed = true;
    }
  }
  // New approved before & afters go into upcoming posts that haven't been touched yet:
  // Instagram's before & after slots first, then Google posts (using the after).
  if (posts.some((p) => !p.status && p.date >= today && !p.ap && !p.edited && !p.picked)) {
    bank ||= await loadBank(s);
    if (bank.lined.some(goodLined)) {
      for (const p of posts.filter((q) => !q.status && q.date >= today && !q.ap && !q.lu && !q.edited && !q.picked).sort((a, b) => (a.ch === "ig" ? 0 : 1) - (b.ch === "ig" ? 0 : 1) || a.date.localeCompare(b.date))) {
        const others = posts.filter((q) => q.id !== p.id), recent = recentOf(others, p.ch);
        // Untouched upcoming posts don't hold on to their photo: an approved pair can take it and they get another.
        const soft = (q) => !q.status && q.date >= today && !q.ap && !q.lu && !q.edited && !q.picked;
        const used = usedIds(others.filter((q) => !soft(q)));
        const igN = others.filter((q) => q.ch === "ig" && q.date < p.date && q.status !== "skipped").length;
        if (p.ch === "ig" && igN % 2 !== 1) continue;
        const x = pickLined(bank, used, recent, new Set(p.skip || []));
        if (!x) break;
        if (p.ch === "ig") asLined(p, x); else asAfterOf(p, x);
        Object.assign(p, template(p), { ai: 0 }); p.fx = 0.5; p.fy = 0.5;
        for (const q of others) if (soft(q) && (q.ph || []).some((y) => y.id === x.a.id || y.id === x.b.id)) { q.ph = []; fill(q, bank, posts, new Set([x.a.id, x.b.id, ...(q.skip || [])])); Object.assign(q, template(q), { ai: 0 }); }
        changed = true;
      }
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
const SEASON = ["mid-summer: heat, humidity, storms and mould; January lease turnover", "late summer: humidity and mould; storm clean-ups", "early autumn: listings picking up; humidity easing", "autumn selling season", "late autumn: end-of-financial-year moves coming", "end of financial year moves and lease changes; dry season dust", "winter: dry, dusty, short days, fewer listings", "late winter: sellers getting ready for spring", "spring: listings in full swing; pollen", "peak spring selling season; jacarandas; storm season starting", "storm season; humidity rising; end-of-year leases and moves; pre-Christmas listings", "Christmas hosting; end-of-year moves and lease ends; heat, storms and mould"];
const API = "https://api.anthropic.com/v1/messages";
const MODEL = () => process.env.SOCIAL_MODEL || process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
// Captions are the bit people read, so they get the stronger writer. Photo matching stays on the fast model.
const CAP_MODEL = () => process.env.CAPTION_MODEL || "claude-sonnet-5-5";
export const aiOn = () => !!process.env.ANTHROPIC_API_KEY;

export async function claude(body, ms = 9000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  let r;
  try {
    r = await fetch(API, { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ ...body, model: body.model || MODEL() }) });
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

export const BRAND = `You write Instagram and Google posts for Bardon Clean, a small premium residential cleaning business in Brisbane's inner west, owned and run by Jack East. He quotes every job himself, still cleans on jobs, and runs a small team. Services: pre-sale cleaning (before a home is styled, photographed and opened to buyers), bond / end-of-lease cleaning, and deep cleaning.

THE JOB
Write posts people actually read to the end. The test: would a Brisbane local scrolling at 9pm stop, smile or nod, and think "this bloke knows his stuff and actually cares"? If a post could have come from any cleaning company in Australia, it has failed. Being boring is the biggest failure, bigger than being slightly too casual.

THE VOICE
It's Jack talking. A real person with opinions, a dry sense of humour and an obsession with details most people never notice. Write like he'd say it out loud to a mate or a neighbour over the fence, then tidy it up a little.
- First person is good. "I" for Jack's own take, "we" for the team. Talk to "you".
- Have a point of view. Jack has pet peeves (cleaners who only do the bits you can see, reused cloths, rushed jobs, nobody knowing what was actually done), small obsessions (window tracks, grout lines, oven door glass, rangehood filters, skirting boards) and honest admissions ("it's not glamorous", "nobody will ever compliment your window tracks"). Use them.
- Dry, understated humour is welcome: a wry observation, a bit of self-awareness, an honest admission. Never jokey puns, never forced, never cringe.
- Make it about real life: selling and the open-home nerves, moving out and handing back keys, the grime you stop seeing when you live with it, Brisbane humidity, mould, storms, dust, the heat.
- Specific and concrete. Name the actual thing: the oven door glass, the shower screen, the tracks, the rangehood filters, the grout lines. Specific is interesting; general is wallpaper.
- Short sentences mixed with longer ones. Fragments are fine. Contractions always. Plain Australian English and spelling, relaxed but not ocker.
- One idea per post. Never a list of services or a list of standards.
- Never corporate: no "elevate", "seamless", "top-notch", "we pride ourselves", "look no further", "your home deserves", "sparkling", "pristine", "spotless", "game-changer", "hassle-free", "peace of mind", "excellence", "attention to detail" (show it instead). No exclamation marks. No emoji.

REAL LINES FROM BARDONCLEAN.AU (the energy to match)
- "Grout that actually looks white again. A rangehood that doesn't smell. The kind of clean you notice when you open the front door."
- "After years in a home, grime on tracks, rangehoods and grout becomes invisible to the people living there. It isn't invisible to a camera or a buyer."
- "Buyers look inside ovens, cupboards and showers. Those are the places we spend the most time."
- "We clean for the lens."
- "I kept hearing the same stories. Cleaners who didn't turn up, rushed jobs, and no way of knowing what was actually done until you went back to check."

TRUE FACTS YOU MAY USE (one per post at most, and only if it fits naturally)
- Fresh microfibre cloths on every clean, never reused between homes. Tools cleaned before and after every clean. Products tested and refined constantly.
- The team is paid above award. Fully insured, including $20m public liability.
- Every client gets a private link that shows each area being finished, so they know it's done without being there.
- Jack started Bardon Clean in 2025 after hearing too many stories of bad experiences with cleaners. Before that he worked in experience research and design at the University of Queensland, which is why he obsesses over how the whole thing feels for the client.
- Checklists: pre-sale covers the full kitchen (oven, rangehood, splashbacks, cupboard fronts), bathrooms, windows, tracks and sills. Bond covers the full oven (racks, trays, glass door inside and out), all cupboards and drawers inside and out, shower tiles, grout, screen, bath, toilet and vanity. Deep cleans cover grout scrubbing, rangehood filter degreasing, oven interior, dishwasher drum and blind slats front and back.

HARD RULES (any break makes the post unusable)
- Don't invent anything about this job or client: no "the owners said", "this took all morning", "it hadn't been cleaned in years", unless Jack's note says it. Jack's note is true and is the best material you have: build the post around it.
- No statistics, percentages or made-up numbers (the $20m figure and anything in Jack's note are fine). No "buyers decide in seconds", no review counts, no "hundreds of homes".
- No promises: nothing about quote turnaround, how soon a clean can be booked, selling faster or for more, getting bond back, guarantees, re-cleans or return visits.
- Never name a client, street or suburb. "Brisbane's inner west" or just "Brisbane" is fine.
- No phone numbers. No prices.
- Say "areas", not "rooms", when talking generally.
- Don't overclaim: never restored, restoration, brand new, like new, as new, perfect, flawless, immaculate, transformed. Say what was done (cleaned, degreased, descaled, scrubbed, cleared) and let the photo do the rest.

EXAMPLES OF THE STANDARD (style only, never copy the wording)

Instagram, pre-sale, oven:
"Nobody at an open home has ever said 'what a lovely oven'. But they do open it.

This one got the full treatment. Racks out, trays soaked, the door glass done inside and out, including the bit between the panes that everyone pretends isn't there.

It's not the glamorous part of a pre-sale clean. It's the part I'd be most nervous about if it was my house going on the market.

Listing soon? Link's in the bio.

#presaleclean #brisbanerealestate #brisbanecleaning #bardonclean"

Instagram, Jack's view, window tracks:
"Confession: I'm weirdly invested in window tracks.

Nobody looks at them. Which is exactly why they tell you whether a cleaner actually did the job or just the bits you'd notice. Ours get vacuumed out first, then wiped corner to corner. Every window.

Nobody will ever compliment your window tracks. That's sort of the point.

— Jack

#brisbanecleaning #brisbaneinnerwest #deepclean #bardonclean"

Instagram, how we work, bathroom:
"Slightly gross thought for a Tuesday: the cloth that cleaned someone else's toilet yesterday. Where is it today?

At our place it's in the wash. Every home gets a fresh set of microfibre cloths, nothing goes from one house to the next, and the tools get cleaned before and after every job.

Not exciting. Just how it should be.

#brisbanecleaning #bathroomclean #deepclean #bardonclean"

Google, deep clean, shower screen:
"Shower screens are sneaky. Soap film builds up so slowly you stop seeing it, until one day the glass is clear again and the whole bathroom looks lighter.

This one's from a deep clean in Brisbane's inner west this month: screen, tiles and grout lines all scrubbed back. If yours has gone a bit cloudy, we can help. Quotes at bardonclean.au."

WHAT FAILS (stiff, generic, forgettable. Never write like this)
"Kitchen, cleaned top to bottom. A kitchen after a recent deep clean in Brisbane's inner west. Every surface in this kitchen done by hand. Bardon Clean does pre-sale, bond and deep cleaning across Brisbane's inner west."
"Shower screens give a bathroom away. On a deep clean we go past the surfaces into the edges. Pre-sale, bond and deep cleaning across Brisbane's inner west. Quotes via the link in our bio."
Why they fail: they label the photo, explain the service like a brochure, have no opinion, no person behind them, and end on the same boilerplate every time.`;

const CAP_TOOL = {
  name: "write_post",
  description: "Write the post for this photo, or reject the photo if it isn't fit to post.",
  input_schema: {
    type: "object",
    properties: {
      usable: { type: "boolean", description: "False if the after photo is dark, blurry, cluttered, not obviously clean, a toilet bowl, a drain, or otherwise unflattering for a premium cleaning brand." },
      private: { type: "boolean", description: "True if any photo shows faces, people, family photos, mail or documents with names, a street number, number plates or a distinctive street view." },
      headline: { type: "string", description: "Short text that goes ON the image, 2 to 6 words, that makes someone stop scrolling and matches the photo. Either names the detail plainly ('Oven glass, inside and out.', 'Tracks, actually cleared.') or a short knowing line ('The bit buyers open first.', 'Grout, white again.'). No 'restored', no hype, no exclamation marks." },
      caption: { type: "string", description: "The post text." },
    },
    required: ["usable", "private", "headline", "caption"],
  },
};
const ANGLE_BRIEF = {
  result: "Angle: the detail. Find the one specific thing in the photo that most cleaners skip (oven glass, grout lines, shower screen, tracks, rangehood, skirting, stovetop) and say why Jack cares about it, with an opinion or a wry line. The photo is the proof, not the subject line.",
  standard: "Angle: how we work. Pick ONE true fact (fresh cloths every home, tools cleaned before and after, tested products, team paid above award, fully insured, the live job link) and make it a little story or a pointed observation about the industry, so it feels like a standard Jack actually cares about rather than a feature.",
  service: "Angle: the situation. Speak to someone right in that moment (the week before photos and the first open home, handing back keys at the end of a lease, a home that's overdue for more than a regular clean). Show you understand how that actually feels, then use the photo as the example.",
  tip: "Angle: a genuinely useful, accurate tip related to what's shown (keeping shower glass clear, stopping grease setting on a rangehood, keeping window tracks clean, beating mould in humid weather). One tip, practical, no brand names, said the way Jack would tell a mate. Generous: the reader should be able to use it without hiring anyone.",
  jack: "Angle: Jack's view. Jack's first person ('I'). A pet peeve, a confession, a small obsession, or why he started Bardon Clean (too many stories of cleaners not turning up, rushed jobs, no way of knowing what was done). Honest and a bit wry, never a sob story or a sales pitch. End with '— Jack' on its own line.",
  season: "Angle: right now in Brisbane. Tie the photo to what's happening this time of year (given below): humidity and mould, storms and dust, heat, the spring selling season, end-of-lease moves, Christmas hosting. Local and timely, so it obviously wasn't written six months ago. Nothing invented about specific weather events.",
  hot: "Angle: a mild hot take. One opinion Jack holds about cleaning that some people would argue with (e.g. that the bits nobody looks at matter most, that cheaper cleans cost you more in re-dos and stress, that a clean should be checkable, not taken on faith). Say it plainly, back it with the photo, and invite people to disagree in the comments. Opinion, never a statistic.",
};
const CH_BRIEF = {
  gbp: `Channel: Google Business Profile post (an update on Bardon Clean's Google listing, read by locals deciding who to call).
Format: 50 to 110 words, one or two short paragraphs. Still Jack's voice, just a touch more straightforward than Instagram. Open with the hook, not a label. No hashtags, no phone number, no emoji. Mention the service and Brisbane's inner west naturally, and finish with a natural, varied nudge to bardonclean.au for a quote (never the same wording twice in a row).`,
  ig: `Channel: Instagram feed post.
Format: the first line is everything, because it's all people see before "more". Make it something people want to finish: a confession, an opinion, a slightly gross truth, a question, a wry observation. Then 1 to 3 short paragraphs with a blank line between them. Then, usually, a short closing nudge in your own words that fits the post (e.g. "Listing soon? Link's in the bio.", "Quotes through the link in our bio.", or a question that invites comments instead). Never the same closing line as recent posts and never a list of services. Then one final line of 3 to 5 relevant lowercase hashtags, usually including #brisbanecleaning or #brisbaneinnerwest. Under 110 words before the hashtags.`,
};
export async function writeCaption(post, imgs, { recent = [] } = {}) {
  const content = [];
  if (post.kind === "pair") {
    content.push({ type: "text", text: "BEFORE photo:" }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgs[0] } });
    content.push({ type: "text", text: "AFTER photo (the one that matters for usable):" }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgs[1] } });
  } else content.push({ type: "text", text: "AFTER photo:" }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgs[0] } });
  const note = String(post.note || "").trim();
  const mon = Number(String(post.date || todayBne()).slice(5, 7)) || 1;
  content.push({ type: "text", text: `${CH_BRIEF[post.ch]}

The job was a ${SVC[post.svc || "other"].toLowerCase()}${post.room ? `; the area is ${post.room.toLowerCase()}` : ""}. The post goes out on ${post.date}; in Brisbane that's ${SEASON[mon - 1]}.
${note ? `\nJACK'S NOTE ABOUT THIS JOB (true, in his words; make it the heart of the post): "${note.slice(0, 400)}"\n` : ""}
${ANGLE_BRIEF[post.angle] || ANGLE_BRIEF.result}${post.kind === "pair" ? "\nThe image is a before/after comparison; the caption can talk about the change, but only what's visible." : ""}
${recent.length ? `\nRecent posts started like this. Don't reuse these openings, structures or closing lines:\n${recent.map((x) => `- ${x}`).join("\n")}\n` : ""}
Write it as Jack would. Read it back: if it sounds like a brochure or a template, rewrite it. Then check every hard rule.` });
  const x = await claude({ model: CAP_MODEL(), max_tokens: 900, temperature: 1, system: BRAND, tools: [CAP_TOOL], tool_choice: { type: "tool", name: CAP_TOOL.name }, messages: [{ role: "user", content }] }, 24000);
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
  const post = { id: nid(), ch, date, angle: ANGLES[n % ANGLES.length], status: "", ai: 0, extra: 1, picked: 1, ap: 1 };
  if (ch === "ig") asLined(post, x);
  else Object.assign(post, { kind: "after", ph: [ph(x.a)], room: x.room, svc: x.svc, key: x.key, ...(x.rt && x.rt.hd ? { head: x.rt.hd } : {}) });
  Object.assign(post, template(post), { txt: ch === "ig" ? 1 : 0 });
  if (ch === "gbp" && x.rt && x.rt.hd) post.head = x.rt.hd;
  posts.push(post);
  posts.sort((a, b) => (a.date + a.ch).localeCompare(b.date + b.ch));
  await savePosts(s, posts);
  return post;
}
