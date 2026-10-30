// Fresh photo & video ideas for Jack to film on the job, written by Claude.
// Each batch is steered by: the jobs coming up this week, the time of year in Brisbane, a few
// randomly drawn formats (so batches don't all look alike), every idea already shown (no repeats),
// and Jack's own reactions (saved / filmed = more like this, "not for me" = less like this).
//
// Blob: ideas/list  [{ id, at, t, fmt, svc, hook, shots[], txt, cap, len, st: ""|"fav"|"done"|"no" }]  newest first
import { randomBytes } from "node:crypto";
import { loadRoster } from "./core.mjs";
import { claude, BRAND, svcOf, todayBne, addDays } from "./social.mjs";

const KEEP = 300, PER = 3, BATCHES = 2;
export const loadIdeas = async (s) => { const v = await s.get("ideas/list"); return Array.isArray(v) ? v : []; };
const saveIdeas = (s, l) => s.set("ideas/list", l.slice(0, KEEP));

// Formats and angles, drawn at random so every batch is pushed somewhere different.
const SEEDS = [
  "POV: the viewer is the homeowner walking in after the clean",
  "Sound-on: the satisfying sound of one specific task (squeegee, scrub brush, vacuum on carpet, spray and wipe)",
  "Hands-only: the whole clip is just hands and the surface, no faces",
  "Myth vs fact about a common cleaning habit (accurate, practical)",
  "'What most people miss': one overlooked spot in a home",
  "What a real estate photographer's camera sees, and why that spot matters before listing photos",
  "Time-lapse of one area from start to finish (phone propped in a corner)",
  "Carousel: several stills of one theme (e.g. every edge, every handle, every track)",
  "Split-screen same-spot before and after",
  "Swipe or wipe transition: the wipe of the cloth reveals the after shot",
  "The kit: one tool or product and exactly what it's for",
  "Stop-motion or quick cuts of fresh cloths being folded and laid out",
  "A 15-second tip to camera from Jack, in a finished area",
  "Behind the scenes of how the job is run: the checklist, the photos, the client job link on the phone screen",
  "Detail macro: extreme close-up of a surface you'd never normally look at",
  "Seasonal: something that matters in a Brisbane home at this time of year",
  "Quiz: 'Guess the area' from an extreme close-up, reveal at the end",
  "Last 10 seconds of the job: the final checks before leaving",
  "Hosting or move-out angle: getting a home ready for the next people",
  "Series idea: one recurring short format Jack could repeat every week",
];
const SEASON = {
  0: "Mid-summer: heat, humidity, storms, mould and mildew in bathrooms, school holidays, January lease turnover.",
  1: "Late summer: humidity, mould, storm debris on windows and outdoor areas, back-to-school.",
  2: "Early autumn: humidity easing, autumn property listings starting, Easter often around now.",
  3: "Autumn: autumn selling season, milder weather, good light for photos.",
  4: "Late autumn: cooler mornings, autumn listings, end-of-financial-year moves coming.",
  5: "Start of winter, dry season: end of financial year moves and lease changes, dust, low winter light.",
  6: "Winter: dry and dusty, westerly winds, short days, fewer listings, school holidays.",
  7: "Late winter: spring selling season is about to start, sellers preparing homes, the Ekka.",
  8: "Early spring: spring property listings in full swing, pollen, warmer days, school holidays late in the month.",
  9: "Spring: peak spring selling season, jacaranda flowers dropping on decks, paths and outdoor areas, storm season starting, humidity rising.",
  10: "Late spring: storm season, humidity rising, jacarandas, end-of-year leases and moves, pre-Christmas listings.",
  11: "Summer and Christmas: hosting family, end-of-year moves and lease ends, heat and humidity, storms, mould.",
};
const SVC_NAME = { presale: "pre-sale clean", bond: "bond clean", deep: "deep clean", other: "clean" };

function pick(arr, n) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); }

async function upcoming(s, today) {
  const r = await loadRoster(s), end = addDays(today, 7), seen = new Set(), out = [];
  for (const j of (r.jobs || []).filter((x) => !x.sample && x.date >= today && x.date <= end).sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const k = j.group || j.id; if (seen.has(k)) continue; seen.add(k);
    out.push({ date: j.date, svc: svcOf(j.service) });
  }
  return out;
}
const when = (d, today) => d === today ? "today" : d === addDays(today, 1) ? "tomorrow" : new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", { weekday: "long", timeZone: "UTC" });

const TOOL = {
  name: "content_ideas",
  description: "Give Jack fresh photo and video ideas to film on the job.",
  input_schema: {
    type: "object",
    properties: {
      ideas: {
        type: "array", minItems: PER, maxItems: PER,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Punchy name for the idea, 3 to 8 words." },
            format: { type: "string", enum: ["Reel", "Story", "Carousel", "Photo", "Talking to camera"] },
            service: { type: "string", enum: ["any", "presale", "bond", "deep"], description: "Which kind of job it suits." },
            hook: { type: "string", description: "One or two sentences: the concept and why someone scrolling would stop for it." },
            shots: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" }, description: "The exact clips or photos to capture on site, in order. Concrete: where to stand, what to point the phone at, how long, vertical or landscape." },
            onscreen: { type: "string", description: "Text to put on the video or image, under 9 words. Empty if none." },
            caption: { type: "string", description: "A first line for the caption, under 20 words, plain and true." },
            length: { type: "string", description: "e.g. '12 sec', '3 slides', '20 sec'." },
          },
          required: ["title", "format", "service", "hook", "shots", "onscreen", "caption", "length"],
        },
      },
    },
    required: ["ideas"],
  },
};

async function oneBatch({ today, list, jobs, svc, seeds }) {
  const month = +today.slice(5, 7) - 1;
  const liked = list.filter((x) => x.st === "fav" || x.st === "done").slice(0, 15).map((x) => `- ${x.t} (${x.fmt})`);
  const nope = list.filter((x) => x.st === "no").slice(0, 15).map((x) => `- ${x.t} (${x.fmt})`);
  const shown = list.slice(0, 80).map((x) => `- ${x.t}`);
  const want = svc && SVC_NAME[svc] ? `All ${PER} ideas must suit a ${SVC_NAME[svc]}.` : jobs.length ? "Make at least one idea fit the next job coming up." : "";
  const prompt = `Jack films short photo and video content on his own phone while he's on cleaning jobs, then posts it to Instagram (Reels, Stories, feed), his Google Business Profile, and sometimes LinkedIn for real estate agents. Give him ${PER} fresh, genuinely creative ideas he hasn't seen before.

Today is ${today} in Brisbane. Time of year: ${SEASON[month]}
${jobs.length ? `Jobs coming up this week:\n${jobs.slice(0, 8).map((j) => `- ${when(j.date, today)} (${j.date}): ${SVC_NAME[j.svc]}`).join("\n")}` : "No jobs on the roster this week yet."}
${want}

Push each idea in a different direction. Use one of these as the starting point for each idea, one each, in any order:
${seeds.map((x) => `- ${x}`).join("\n")}

Every idea must be:
- Filmable by Jack alone, with a phone, during a normal job, in under 3 minutes of filming.
- Specific to cleaning homes and to Bardon Clean (premium, careful, detail-first), not generic lifestyle content.
- Free of client faces, names, house numbers, street views, mail, family photos or personal belongings. No toilets or drains as the subject.
- Honest: no invented results, no numbers or statistics, no promises (sale prices, speed, guarantees, return visits), no "restored", "like new", "spotless" or similar overclaims. Name no other brands or specific songs.
${liked.length ? `\nJack liked these. Do more in this spirit, but never repeat them:\n${liked.join("\n")}` : ""}
${nope.length ? `\nJack said "not for me" to these. Steer away from their style:\n${nope.join("\n")}` : ""}
${shown.length ? `\nAlready shown to Jack. Don't repeat or lightly reword any of these:\n${shown.join("\n")}` : ""}`;
  const x = await claude({ max_tokens: 1800, temperature: 1, system: BRAND, tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name }, messages: [{ role: "user", content: prompt }] }, 9500);
  return (x.ideas || []).slice(0, PER).map((i) => ({
    id: randomBytes(6).toString("hex"), at: today,
    t: String(i.title || "").slice(0, 80), fmt: String(i.format || "Reel").slice(0, 24),
    svc: ["presale", "bond", "deep"].includes(i.service) ? i.service : "any",
    hook: String(i.hook || "").slice(0, 400), shots: (Array.isArray(i.shots) ? i.shots : []).slice(0, 5).map((y) => String(y).slice(0, 260)),
    txt: String(i.onscreen || "").slice(0, 80), cap: String(i.caption || "").slice(0, 200), len: String(i.length || "").slice(0, 24), st: "",
  })).filter((i) => i.t && i.shots.length);
}

// Two batches of 3 written side by side (different formats each), so a tap gives 6 ideas in the same time as 3.
export async function freshIdeas(s, { svc = "" } = {}) {
  const today = todayBne(), [list, jobs] = await Promise.all([loadIdeas(s), upcoming(s, today)]);
  const seeds = pick(SEEDS, PER * BATCHES);
  const res = await Promise.allSettled(Array.from({ length: BATCHES }, (_, k) => oneBatch({ today, list, jobs, svc, seeds: seeds.slice(k * PER, k * PER + PER) })));
  const seen = new Set(), add = [];
  for (const r of res) if (r.status === "fulfilled") for (const i of r.value) { const k = i.t.toLowerCase(); if (!seen.has(k)) { seen.add(k); add.push(i); } }
  if (!add.length) { const e = res.find((r) => r.status === "rejected"); throw e ? e.reason : Object.assign(new Error("Claude didn't come back with ideas. Try again."), { status: 502 }); }
  const cur = await loadIdeas(s);
  await saveIdeas(s, [...add, ...cur]);
  return { add, jobs };
}

export async function markIdea(s, id, st) {
  const l = await loadIdeas(s), x = l.find((y) => y.id === id);
  if (!x) return null;
  x.st = ["fav", "done", "no", ""].includes(st) ? st : "";
  await saveIdeas(s, l);
  return x;
}

export async function ideasView(s) {
  const today = todayBne(), [list, jobs] = await Promise.all([loadIdeas(s), upcoming(s, today)]);
  return { ideas: list, jobs: jobs.slice(0, 6).map((j) => ({ ...j, when: when(j.date, today) })), today };
}
