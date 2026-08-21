/* Public Google rating + a few reviews.
   Optional env: GOOGLE_PLACES_API_KEY (Places API, server only).
   Falls back to reviews.json so the house still speaks without a key. */

var fs = require("fs");
var path = require("path");

var PLACE_ID = "ChIJA7O_BgBLekgRM6KmmvtDE_k";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

function fallback() {
  var file = path.join(process.cwd(), "reviews.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function textOf(review) {
  if (!review) return "";
  var original = review.originalText && review.originalText.text;
  var plain = review.text && review.text.text;
  return String(original || plain || "").replace(/\s+/g, " ").trim();
}

function fromPlaces(payload) {
  var reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
  return {
    placeId: PLACE_ID,
    name: "Blanco Coffee House",
    rating: Number(payload.rating) || 0,
    count: Number(payload.userRatingCount) || 0,
    url:
      payload.googleMapsUri ||
      "https://search.google.com/local/reviews?placeid=" + PLACE_ID,
    writeUrl: "https://search.google.com/local/writereview?placeid=" + PLACE_ID,
    reviews: reviews
      .map(function (row) {
        var author =
          (row.authorAttribution && row.authorAttribution.displayName) || "Guest";
        return {
          author: String(author).trim(),
          relativeTime: String(row.relativePublishTimeDescription || "").trim(),
          rating: Number(row.rating) || 0,
          text: textOf(row)
        };
      })
      .filter(function (row) {
        return row.text;
      })
      .slice(0, 5)
  };
}

async function live() {
  var key = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();
  if (!key) return null;
  var res = await fetch(
    "https://places.googleapis.com/v1/places/" + encodeURIComponent(PLACE_ID),
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "rating,userRatingCount,googleMapsUri,reviews.rating,reviews.relativePublishTimeDescription,reviews.originalText,reviews.text,reviews.authorAttribution.displayName"
      }
    }
  );
  if (!res.ok) return null;
  var payload = await res.json();
  var data = fromPlaces(payload);
  if (!data.rating || !data.reviews.length) return null;
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.end();
    return;
  }
  if (req.method && req.method !== "GET") {
    json(res, 405, { error: "Use GET." });
    return;
  }

  try {
    var data = await live();
    json(res, 200, data || fallback());
  } catch (err) {
    try {
      json(res, 200, fallback());
    } catch (readErr) {
      json(res, 502, { error: "Reviews could not be loaded." });
    }
  }
};
