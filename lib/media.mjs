// Media opportunities: every morning the hub reads the latest Australian news on cleaning, renting,
// bonds, mould, property sales and home care (Google News RSS, no key needed), and Claude picks the
// stories where Jack can credibly add an expert comment as a Brisbane cleaning business owner.
// Each one comes with his angle and a short pitch; a full media release is written on tap.
// Claude can also write a seasonal release when the news is quiet.
//
// Blobs: media/opps  [{ id, at, kind: "news"|"seasonal", score, news: {title, url, src, date}, why, angle, outlets, subj, pitch, rel?, st: ""|"saved"|"no" }]
//        media/seen  { <hash>: date }   story headlines already judged (so they aren't re-sent)
import { createHash, randomBytes } from "node:crypto";
import { notify } from "./notify.mjs";

const API = "https://api.anthropic.com/v1/messages";
const MODEL = () => process.env.MEDIA_MODEL || process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
export const mediaAi = () => !!process.env.ANTHROPIC_API_KEY;
const BNE = 10 * 3600e3;
const todayBne = () => new Date(Date.now() + BNE).toISOString().slice(0, 10);
const KEEP = 150;

// What the hub watches. Last 7 days, Australian edition.
const QUERIES = [
  "cleaning Brisbane", "cleaners Australia", "bond cleaning", "end of lease cleaning", "rental bond Queensland",
  "Queensland renters", "Residential Tenancies Authority", "mould home Queensland", "storm season Brisbane homes",
  "selling a home Brisbane", "Brisbane property market", "spring selling season", "home presentation sale",
  "spring cleaning", "cleaning tips", "cleaning products Australia", "cleaning industry wages", "Brisbane small business",
];

export const loadOpps = async (s) => { const v = await s.get("media/opps"); return Array.isArray(v) ? v : []; };
const saveOpps = (s, l) => s.set("media/opps", l.slice(0, KEEP));
const h8 = (t) => createHash("sha1").update(String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).digest("hex").slice(0, 12);

// ---------- news ----------
const ent = (t) => String(t || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? ent(m[1]) : ""; };
export function parseRss(xml) {
  return (String(xml).match(/<item>[\s\S]*?<\/item>/g) || []).map((x) => {
    const src = tag(x, "source");
    let title = tag(x, "title");
    if (src && title.endsWith(" - " + src)) title = title.slice(0, -(src.length + 3));
    const d = Date.parse(tag(x, "pubDate"));
    return { title, url: tag(x, "link"), src, date: isNaN(d) ? "" : new Date(d + BNE).toISOString().slice(0, 10) };
  }).filter((x) => x.title && /^https?:\/\//.test(x.url));
}
async function feed(q, ms = 4000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:7d")}&hl=en-AU&gl=AU&ceid=AU:en`, { signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (BardonCleanHub)" } });
    return r.ok ? parseRss(await r.text()).slice(0, 8) : [];
  } catch { return []; } finally { clearTimeout(t); }
}
async function news(s, ms) {
  const seen = (await s.get("media/seen")) || {}, out = [], have = new Set();
  for (const list of await Promise.all(QUERIES.map((q) => feed(q, ms)))) for (const n of list) {
    const k = h8(n.title);
    if (have.has(k) || seen[k]) continue;
    have.add(k); out.push({ ...n, k });
  }
  return { items: out, seen };
}

// ---------- Claude ----------
async function claude(body, ms = 9500) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  let r;
  try { r = await fetch(API, { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: MODEL(), ...body }) }); }
  catch (e) { throw Object.assign(new Error(e.name === "AbortError" ? "Claude took too long. Try again." : "Couldn't reach Claude"), { status: 504 }); }
  finally { clearTimeout(t); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("media claude", r.status, JSON.stringify(d).slice(0, 300)); throw Object.assign(new Error(r.status === 401 ? "The Claude key is wrong. Check ANTHROPIC_API_KEY in Netlify." : r.status === 429 || r.status === 529 ? "Claude is busy. Try again in a minute." : "Claude couldn't do that one. Try again."), { status: 502 }); }
  return (d.content || []).find((c) => c.type === "tool_use")?.input || {};
}

const JACK = `Jack East owns and runs Bardon Clean, a premium residential cleaning business in Brisbane's inner west. Services: pre-sale cleaning (before a home is styled, photographed and listed), bond / end-of-lease cleaning, and deep cleaning.

True facts you may use (nothing else about him or the business):
- Started Bardon Clean in early 2025 after hearing too many stories of people's bad experiences with cleaners.
- Before that: years in an experience research and design role at the University of Queensland, with UX and CX qualifications; he also started health businesses earlier.
- Works hands-on on jobs and runs a growing team. The team is paid above award.
- Fresh microfibre cloths on every clean, never reused between homes. Tools cleaned before and after every clean. Products tested and refined constantly.
- Fully insured, including $20m public liability.
- Built his own system: every client gets a private live job link showing each area being finished, with photos; agents get their own portal.

Hard rules: no statistics, percentages or numbers (except $20m insurance) and no invented facts, client stories, results or quotes from other people. No promises about bond refunds, sale prices or speed. No legal or tenancy advice beyond what is plainly common sense; point people to the RTA for rules. No prices. Plain Australian English and spelling. Nothing that sounds like an ad: a journalist must be able to use it as genuine expert comment.`;

const SEASON = ["mid-summer heat, humidity, storms and mould; January lease turnover", "late summer humidity and mould; storm clean-ups", "autumn listings starting; humidity easing", "autumn selling season", "late autumn; end-of-financial-year moves coming", "end of financial year moves and lease changes; dry season dust", "winter: dry, dusty, short days, fewer listings", "late winter: sellers preparing for spring", "spring listings in full swing; pollen", "peak spring selling season; jacarandas; storm season starting", "storm season; humidity rising; end-of-year leases and moves; pre-Christmas listings", "Christmas hosting; end-of-year moves and lease ends; heat, storms and mould"];

const SCAN_TOOL = {
  name: "media_opportunities",
  description: "Pick the news stories where Jack can credibly offer expert comment.",
  input_schema: { type: "object", properties: { picks: { type: "array", maxItems: 3, items: { type: "object", properties: {
    n: { type: "integer", description: "The story number from the list." },
    score: { type: "integer", minimum: 1, maximum: 5, description: "5 = Jack is an obvious, timely expert voice on this; 3 = a fair stretch but workable; below 3 = don't include it." },
    why: { type: "string", description: "One sentence: why this story is an opening for Jack right now." },
    angle: { type: "string", description: "Jack's take in 2 or 3 sentences: the practical, specific point he can add that the story is missing." },
    outlets: { type: "string", description: "Who to pitch: the outlet that ran it, plus the kind of Brisbane or Queensland media likely to follow it up (e.g. local radio, Brisbane News, property sections). No made-up journalist names." },
    subject: { type: "string", description: "Pitch email subject line, under 12 words." },
    pitch: { type: "string", description: "A short pitch email from Jack to a journalist, 80 to 140 words: reference the story, offer his specific angle in one or two points, say he's available for comment or interview this week, sign off 'Jack East, Owner, Bardon Clean, 0406 216 212, bardonclean.au'." },
  }, required: ["n", "score", "why", "angle", "outlets", "subject", "pitch"] } } }, required: ["picks"] },
};

// Read the news and keep the stories worth Jack's time. Returns the new opportunities.
export async function scanMedia(s, { push = false, quick = false } = {}) {
  const today = todayBne(), { items: all, seen } = await news(s, quick ? 2500 : 4000), items = all.slice(0, quick ? 40 : 70);
  if (!items.length) return { add: [], read: 0 };
  const prev = (await loadOpps(s)).filter((x) => x.st === "no").slice(0, 10).map((x) => `- ${x.news ? x.news.title : x.angle}`);
  const prompt = `Today is ${today}. Below are this week's Australian news stories. Pick up to 3 where Jack, as a Brisbane cleaning business owner, could genuinely be useful to a journalist as an expert voice (comment, follow-up story, practical tips segment, local angle). Skip anything where he'd be a stretch: crime, celebrity, overseas-only, company finance, or cleaning in a different sense (data cleaning, clean energy, money laundering). Fewer, stronger picks beat filling the list. If nothing fits, return no picks.
${prev.length ? `\nJack marked these as not relevant before. Avoid similar:\n${prev.join("\n")}\n` : ""}
Stories:
${items.map((n, i) => `${i + 1}. ${n.title} (${n.src}, ${n.date})`).join("\n")}`;
  const x = await claude({ max_tokens: 2000, system: JACK, tools: [SCAN_TOOL], tool_choice: { type: "tool", name: SCAN_TOOL.name }, messages: [{ role: "user", content: prompt }] }, quick ? 7000 : 25000);
  for (const n of items) seen[n.k] = today;
  const cut = Object.fromEntries(Object.entries(seen).filter(([, d]) => d >= new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)));
  await s.set("media/seen", cut);
  const add = (x.picks || []).filter((p) => p.score >= 3 && items[p.n - 1]).map((p) => {
    const n = items[p.n - 1];
    return { id: randomBytes(6).toString("hex"), at: today, kind: "news", score: p.score, news: { title: n.title, url: n.url, src: n.src, date: n.date }, why: String(p.why || "").slice(0, 400), angle: String(p.angle || "").slice(0, 800), outlets: String(p.outlets || "").slice(0, 300), subj: String(p.subject || "").slice(0, 140), pitch: String(p.pitch || "").slice(0, 1500), st: "" };
  });
  if (add.length) {
    await saveOpps(s, [...add, ...(await loadOpps(s))]);
    const best = add.slice().sort((a, b) => b.score - a.score)[0];
    if (push) await notify(s, { type: "media_opp", title: add.length === 1 ? "A media opportunity for you" : `${add.length} media opportunities for you`, body: `${best.news.title} (${best.news.src}). ${best.why}`, url: "/marketing/#pr", tags: "newspaper", priority: best.score >= 4 ? 4 : 3 });
  }
  return { add, read: items.length };
}

const REL_TOOL = {
  name: "media_release", description: "Write the media release.",
  input_schema: { type: "object", properties: {
    headline: { type: "string", description: "News-style headline, under 14 words. Not an ad." },
    sub: { type: "string", description: "One-sentence subheading." },
    body: { type: "string", description: "The release body, 230 to 350 words, starting 'BRISBANE, <day month year> –'. Inverted pyramid: the news hook first, then Jack's practical expert points, with two short direct quotes from Jack (clearly his opinion and experience, nothing invented about clients or results). Plain paragraphs separated by blank lines." },
    tips: { type: "string", description: "3 to 5 practical tips from Jack as short lines starting with '- ', useful to readers on their own. Empty if they don't fit." },
  }, required: ["headline", "sub", "body", "tips"] },
};
const BOILER = `About Bardon Clean
Bardon Clean is a premium residential cleaning business in Brisbane's inner west, specialising in pre-sale, bond and deep cleaning. It was started in 2025 by Jack East, who spent years in experience research and design at the University of Queensland before building a cleaning business around how clients actually experience the job. bardonclean.au

Media contact
Jack East, Owner, Bardon Clean
0406 216 212 · bardonclean.au
Available for interviews, comment and on-site photos.`;

function relText(r, date) {
  return `MEDIA RELEASE\n${date}\n\n${r.headline}\n${r.sub}\n\n${r.body.trim()}${r.tips && r.tips.trim() ? `\n\nJack's tips\n${r.tips.trim()}` : ""}\n\nENDS\n\n${BOILER}`;
}
const longDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Full release for an opportunity (news or seasonal).
export async function writeRelease(s, id) {
  const l = await loadOpps(s), o = l.find((x) => x.id === id);
  if (!o) return null;
  const today = todayBne();
  const ctx = o.kind === "news" ? `The news hook: "${o.news.title}" (${o.news.src}, ${o.news.date}). Don't quote or restate the article's facts beyond its headline; build the release around Jack's angle.` : `There's no news story: this is a seasonal release.`;
  const x = await claude({ max_tokens: 1500, system: JACK, tools: [REL_TOOL], tool_choice: { type: "tool", name: REL_TOOL.name }, messages: [{ role: "user", content: `Write a media release for Brisbane and Queensland media, dated ${longDate(today)}.\n${ctx}\nJack's angle: ${o.angle}` }] });
  if (!x.headline || !x.body) throw Object.assign(new Error("Claude didn't finish the release. Try again."), { status: 502 });
  const fresh = await loadOpps(s), o2 = fresh.find((y) => y.id === id);
  if (!o2) return null;
  o2.rel = { head: String(x.headline).slice(0, 160), text: relText({ headline: x.headline, sub: x.sub || "", body: String(x.body), tips: String(x.tips || "") }, longDate(today)).slice(0, 6000), at: today };
  await saveOpps(s, fresh);
  return o2;
}

const SEAS_TOOL = {
  name: "seasonal_angle", description: "A seasonal story angle for Jack.",
  input_schema: { type: "object", properties: {
    title: { type: "string", description: "Short working title for the story, under 10 words." },
    why: { type: "string", description: "One sentence: why media would run this now." },
    angle: { type: "string", description: "Jack's take in 2 or 3 sentences, practical and specific." },
    outlets: { type: "string", description: "Kinds of Brisbane or Queensland media to pitch. No made-up journalist names." },
    subject: { type: "string", description: "Pitch email subject, under 12 words." },
    pitch: { type: "string", description: "80 to 140 word pitch email from Jack offering the story and himself for comment, signed 'Jack East, Owner, Bardon Clean, 0406 216 212, bardonclean.au'." },
  }, required: ["title", "why", "angle", "outlets", "subject", "pitch"] },
};
export async function seasonalAngle(s) {
  const today = todayBne(), l = await loadOpps(s);
  const done = l.filter((x) => x.kind === "seasonal").slice(0, 15).map((x) => `- ${x.title || x.angle}`);
  const x = await claude({ max_tokens: 900, temperature: 1, system: JACK, tools: [SEAS_TOOL], tool_choice: { type: "tool", name: SEAS_TOOL.name }, messages: [{ role: "user", content: `Today is ${today} in Brisbane: ${SEASON[+today.slice(5, 7) - 1]}. Come up with one fresh story angle Brisbane or Queensland media would plausibly run this month, with Jack as the expert voice. It can be seasonal, practical consumer advice, a myth people believe about cleaning, the renting or selling cycle, or Jack's own founder story.${done.length ? `\nAlready done, don't repeat:\n${done.join("\n")}` : ""}` }] });
  if (!x.angle) throw Object.assign(new Error("Claude didn't come back with an angle. Try again."), { status: 502 });
  const o = { id: randomBytes(6).toString("hex"), at: today, kind: "seasonal", score: 3, title: String(x.title || "").slice(0, 120), why: String(x.why || "").slice(0, 400), angle: String(x.angle).slice(0, 800), outlets: String(x.outlets || "").slice(0, 300), subj: String(x.subject || "").slice(0, 140), pitch: String(x.pitch || "").slice(0, 1500), st: "" };
  await saveOpps(s, [o, ...l]);
  return o;
}

export async function markOpp(s, id, st) {
  const l = await loadOpps(s), o = l.find((x) => x.id === id);
  if (!o) return null;
  o.st = ["saved", "no", ""].includes(st) ? st : "";
  await saveOpps(s, l);
  return o;
}
export async function mediaView(s) {
  const l = await loadOpps(s), last = (await s.get("media/last")) || null;
  return { opps: l.filter((x) => x.st !== "no").slice(0, 40), last, ai: mediaAi(), today: todayBne() };
}
export const markScanned = (s, r) => s.set("media/last", { at: new Date().toISOString(), read: r.read, found: r.add.length });
