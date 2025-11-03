// netlify/functions/ascendant.js
// CommonJS + native fetch (Node 18/20+), works on Netlify

const tzLookup = require("tz-lookup");

// ---- CORS helper ----
function cors(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      // When live, replace * with your Squarespace/custom domain
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(bodyObj)
  };
}

// ---- Geocoder helper with fallback (Open-Meteo -> maps.co) ----
async function geocodePlace(placeText) {
  const candidates = Array.from(new Set([
    String(placeText || "").trim(),
    String(placeText || "").replace(/\s*,\s*/g, ", ").trim(), // normalize commas
    String(placeText || "").replace(/\bUSA\b/g, "US"),
    String(placeText || "").replace(/\bVA\b/g, "Virginia")
  ])).filter(Boolean);

  // Try Open-Meteo first
  for (const q of candidates) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
    if (data && Array.isArray(data.results) && data.results.length) {
      const { latitude, longitude, name, country } = data.results[0];
      return { lat: latitude, lon: longitude, provider: "open-meteo", matched: `${name}, ${country}` };
    }
  }

  // Fallback: Nominatim proxy (maps.co)
  for (const q of candidates) {
    const url = `https://geocode.maps.co/search?q=${encodeURIComponent(q)}&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "ascendant-fn/1.0 (+contact)" } });
    if (!res.ok) continue;
    const arr = await res.json();
    if (Array.isArray(arr) && arr.length && arr[0].lat && arr[0].lon) {
      return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon), provider: "maps.co", matched: arr[0].display_name };
    }
  }

  return null;
}

// ---- Compute numeric UTC offset (hours) for an IANA zone + local datetime ----
function offsetHoursFor(ianaZone, birthDate, birthTime) {
  // birthDate: YYYY-MM-DD, birthTime: HH:mm (24h)
  // Heuristic using Intl timeZone conversion
  const wall = new Date(`${birthDate}T${birthTime}:00`);
  const zoneEpoch = Date.parse(new Date(wall).toLocaleString("en-US", { timeZone: ianaZone }));
  const utcEpoch  = Date.parse(new Date(wall).toUTCString());
  return (zoneEpoch - utcEpoch) / 3600000;
}

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") return cors(200, { ok: true });
  if (event.httpMethod !== "POST") return cors(405, { error: "Method not allowed" });

  try {
    const { month, day, year, hour, minute, placeText } = JSON.parse(event.body || "{}");

    // Basic validation
    if (!month || !day || !year || !hour || !minute || !placeText) {
      return cors(400, { error: "Missing required fields." });
    }

    // 1) Geocode
    const geo = await geocodePlace(placeText);
    if (!geo) {
      return cors(400, { error: "Could not find that place. Try City, State, Country." });
    }
    const { lat, lon, provider, matched } = geo;

    // 2) Timezone
    const timezone = tzLookup(lat, lon);

    // Build birth date/time strings
    const birthDate = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const birthTime = `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
    const tzOffset  = offsetHoursFor(timezone, birthDate, birthTime);

    // 3) Astrology API call (if keys present). Otherwise return Test Mode.
    const user = process.env.ASTROLOGY_API_USER_ID;
    const key  = process.env.ASTROLOGY_API_KEY;

const hasKeys = Boolean(user && key);

  if (!hasKeys) {
  return cors(200, { ascendantSign: "Test Mode (add API keys later)" });
}

   // Temporary Free API Test — Aztro (no keys needed)
const apiRes = await fetch("https://aztro.sameerkumar.website/?sign=leo&day=today", {
  method: "POST"
});


    if (!apiRes.ok) {
      const t = await apiRes.text();
      return cors(502, { error: `Astrology API error (${apiRes.status})`, details: t, debug: { tzOffset } });
    }

   const data = await apiRes.json();
const ascendantSign = "Leo (Demo Rising Sign)";

    const ascendantDegree = data?.ascendant?.degree ?? data?.degree ?? null;

    return cors(200, { ascendantSign });

  } catch (err) {
    return cors(500, { error: err.message });
  }
};
