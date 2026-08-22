/* Public flag: is the card on for the house.
   No secrets, no session. The app uses this so Pay now can show
   even when /api/orders is still checking the member. */

var stripe = require("../lib/stripe");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.end();
    return;
  }
  if (req.method !== "GET") {
    json(res, 405, { error: "Use GET." });
    return;
  }
  json(res, 200, { stripe: stripe.stripeEnabled() });
};
