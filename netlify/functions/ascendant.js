const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import tzLookup from "tz-lookup";

/** CORS helper */
function cors(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
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

    // 1) Geocode city
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(placeText)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    const geoJson = await geoRes.json();
    if (!geoJson?.results?.length) return cors(400, { error: "Could not find that place." });
    const { latitude: lat, longitude: lon } = geoJson.results[0];

    // 2) Get timezone
    const timezone = tzLookup(lat, lon);

    // 3) Return placeholder result
    return cors(200, {
      ascendantSign: "Test Mode (add API keys later)",
      ascendantDegree: 0,
      lat, lon, timezone
    });
  } catch (err) {
    return cors(500, { error: err.message });
  }
};