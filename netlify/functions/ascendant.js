// No node-fetch import needed; Netlify (Node 18+) has global fetch
import tzLookup from "tz-lookup";

/** CORS helper */
function cors(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      // set to your Squarespace domain once live, for now * is fine for testing
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(bodyObj)
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors(200, { ok: true });
  if (event.httpMethod !== "POST") return cors(405, { error: "Method not allowed" });

  try {
    const { month, day, year, hour, minute, placeText } = JSON.parse(event.body || "{}");
    if (!month || !day || !year || !hour || !minute || !placeText) {
      return cors(400, { error: "Missing required fields." });
    }

    // 1) Geocode city (Open-Meteo; no key)
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(placeText)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return cors(500, { error: `Geocoding failed (${geoRes.status})` });
    const geoJson = await geoRes.json();
    if (!geoJson?.results?.length) return cors(400, { error: "Could not find that place. Try City, Country." });
    const { latitude: lat, longitude: lon } = geoJson.results[0];

    // 2) Timezone from lat/lon
    const timezone = tzLookup(lat, lon);

    // 3) For now, return test payload (will swap to a real API once keys are added)
    return cors(200, {
      ascendantSign: "Test Mode (add API keys later)",
      ascendantDegree: 0,
      lat, lon, timezone
    });

  } catch (err) {
    return cors(500, { error: err.message });
  }
};
