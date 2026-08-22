/* Stripe Checkout for collections.
   Env: STRIPE_SECRET_KEY (prefer a restricted key, rk_), STRIPE_WEBHOOK_SECRET
   Never put those in client files. */

var Stripe = require("stripe");
var crypto = require("crypto");

var API_VERSION = "2026-07-29.dahlia";

function stripeClient() {
  var key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return null;
  return new Stripe(key, { apiVersion: API_VERSION });
}

function stripeEnabled() {
  return !!String(process.env.STRIPE_SECRET_KEY || "").trim();
}

function integrationId() {
  var letters = "abcdefghjkmnpqrstuvwxyz";
  var out = "blanco-collect-";
  var bytes = crypto.randomBytes(8);
  for (var i = 0; i < 8; i++) out += letters[bytes[i] % letters.length];
  return out;
}

function siteUrl(req) {
  var fromEnv = String(process.env.HOUSE_SITE_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  var host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host || host.indexOf("localhost") !== -1 || host.indexOf("127.0.0.1") !== -1) {
    return "https://www.blancocoffeehouse.com";
  }
  var proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  if (host === "blancocoffeehouse.com") return "https://www.blancocoffeehouse.com";
  return proto + "://" + host;
}

function pence(value) {
  return Math.round(Number(value) * 100);
}

function appReturnUrl(raw) {
  var href = String(raw || "").trim();
  if (!href || href.length > 300) return "";
  var base = href.split("#")[0];
  if (/^blanco:\/\//i.test(base)) return base.split("?")[0];
  if (/^exp:\/\//i.test(base)) return base.split("?")[0];
  return "";
}

async function createCollectionCheckout(req, order) {
  var stripe = stripeClient();
  if (!stripe) throw new Error("Card is not on yet.");
  var origin = siteUrl(req);
  var appReturn = appReturnUrl(order.return_url);
  var lineItems = (order.items || []).map(function (row) {
    return {
      quantity: row.qty,
      price_data: {
        currency: "gbp",
        unit_amount: pence(row.price_gbp),
        product_data: { name: String(row.name).slice(0, 80) }
      }
    };
  });
  var success = origin + "/account.html?paid=1";
  var cancel = origin + "/index.html#menu";
  if (appReturn) {
    success =
      origin + "/pay-return.html?paid=1&to=" + encodeURIComponent(appReturn);
    cancel =
      origin + "/pay-return.html?cancel=1&to=" + encodeURIComponent(appReturn);
  }
  var session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: order.email || undefined,
    client_reference_id: order.id,
    integration_identifier: integrationId(),
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: success,
    cancel_url: cancel,
    metadata: { order_id: order.id, from: appReturn ? "app" : "site" },
    line_items: lineItems
  });
  return session;
}

async function refundCollection(sessionId) {
  var stripe = stripeClient();
  if (!stripe || !sessionId) return null;
  var session = await stripe.checkout.sessions.retrieve(sessionId);
  var intent = session.payment_intent;
  if (!intent) return null;
  if (typeof intent === "object") intent = intent.id;
  return stripe.refunds.create({ payment_intent: intent });
}

function constructEvent(rawBody, signature) {
  var stripe = stripeClient();
  var secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!stripe || !secret) {
    var err = new Error("Stripe webhook is not configured yet.");
    err.status = 503;
    throw err;
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

module.exports = {
  stripeClient: stripeClient,
  stripeEnabled: stripeEnabled,
  siteUrl: siteUrl,
  createCollectionCheckout: createCollectionCheckout,
  refundCollection: refundCollection,
  constructEvent: constructEvent
};
