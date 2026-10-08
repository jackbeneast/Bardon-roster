// Address lookup for the quote form, through Google Places (New). The key stays here,
// never in the page. Needs GOOGLE_MAPS_KEY in Netlify (restricted to "Places API (New)").
//   GET ?q=<text>&s=<session>  -> { suggestions: [{ id, main, secondary }] }
//   GET ?id=<place>&s=<session> -> { address, suburb, postcode, state, full }
//   No key set -> { off: true }, and the form just uses the typed fields.
import { store, json } from "../../lib/core.mjs";
import { ipKey } from "../../lib/requests.mjs";

const BNE = { latitude: -27.4698, longitude: 153.0251 };
const key = () => process.env.GOOGLE_MAPS_KEY || "";
const sess = (v) => (/^[\w-]{8,64}$/.test(v || "") ? v : undefined);

async function g(url, opts) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
  try { const r = await fetch(url, { ...opts, signal: ctl.signal }); return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }; }
  finally { clearTimeout(t); }
}

export default async (req) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!key()) return json({ off: true });
  const u = new URL(req.url);
  const s = await store();
  // Generous for a person typing, tight enough to stop anyone running up the bill.
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "";
  const rk = `addrrate/${ipKey(ip)}/${new Date().toISOString().slice(0, 13)}`;
  const n = ((await s.get(rk))?.n || 0) + 1;
  if (n > 150) return json({ off: true });
  await s.set(rk, { n });
  const headers = { "content-type": "application/json", "X-Goog-Api-Key": key() };

  try {
    const id = u.searchParams.get("id");
    if (id) {
      if (!/^[\w-]{10,300}$/.test(id)) return json({ error: "Bad place" }, 400);
      const st = sess(u.searchParams.get("s"));
      const r = await g(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}${st ? `?sessionToken=${st}` : ""}`, { headers: { ...headers, "X-Goog-FieldMask": "addressComponents,formattedAddress" } });
      if (!r.ok) return json({ off: true });
      const c = {}; for (const a of r.body.addressComponents || []) for (const t of a.types || []) c[t] ||= a;
      const L = (t) => c[t]?.longText || "", S = (t) => c[t]?.shortText || "";
      const street = [L("street_number"), L("route")].filter(Boolean).join(" ");
      const address = (L("subpremise") ? L("subpremise") + "/" : "") + street;
      return json({ address: address || (r.body.formattedAddress || "").split(",")[0], suburb: L("locality") || L("sublocality") || L("postal_town"), postcode: L("postal_code"), state: S("administrative_area_level_1"), full: r.body.formattedAddress || "", id });
    }
    const q = (u.searchParams.get("q") || "").trim().slice(0, 120);
    if (q.length < 3) return json({ suggestions: [] });
    const r = await g("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST", headers,
      body: JSON.stringify({ input: q, sessionToken: sess(u.searchParams.get("s")), includedRegionCodes: ["au"], regionCode: "au",
        includedPrimaryTypes: ["street_address", "subpremise", "premise"], locationBias: { circle: { center: BNE, radius: 50000 } } }),
    });
    if (!r.ok) return json({ off: true });
    return json({ suggestions: (r.body.suggestions || []).map((x) => x.placePrediction).filter(Boolean).slice(0, 5)
      .map((p) => ({ id: p.placeId, main: p.structuredFormat?.mainText?.text || p.text?.text || "", secondary: (p.structuredFormat?.secondaryText?.text || "").replace(/, Australia$/, "") })) });
  } catch { return json({ off: true }); }
};

export const config = { path: "/api/address" };
