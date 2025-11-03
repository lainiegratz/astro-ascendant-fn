// CommonJS syntax so it runs cleanly under Netlify's bundler
const tzLookup = require("tz-lookup");

// --- helper: CORS ---
function cors(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      // lock this to your Squarespace domain later
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(bodyObj)
  };
}

// --- helper: robust geocoder (Open-Meteo -> maps.co fallback) ---
async function geocodePlace(placeText) {
  const candidates = Array.from(new Set([
    placeText.trim(),
    placeText.replace(/\s*,\s*/g, ", ").trim(), // normalize commas
    placeText.replace(/\bUSA\b/g, "US"),        // USA -> US
    placeText.replace(/\bVA\b/g, "Virginia"),   // VA -> Virginia
  ]));

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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors(200, { ok: true });
  if (event.httpMethod !== "POST") return cors(405, { error: "Method not allowed" });

  try {
    const { month, day, year, hour, minute, placeText } = JSON.parse(event.body || "{}");
    if (!month || !day || !year || !hour || !minute || !placeText) {
      return cors(400, { error: "Missing required fields." });
    }

    // 1) Geocode city (with fallback)
    const geo = await geocodePlace(placeText);
    if (!geo) return cors(400, { error: "Could not find that place. Try City, State, Country." });
    const { lat, lon, provider, matched } = geo;

    // 2) IANA timezone
const timezone = tzLookup(lat, lon);

// 3) Test payload (swap to real API later)
return cors(200, {
  ascendantSign: "Test Mode (add API keys later)",
  ascendantDegree: 0,
  lat, lon, timezone
});

