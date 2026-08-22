/* Stripe webhooks for collections. No Clerk — verify Stripe-Signature.
   Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY */

var stripe = require("../lib/stripe");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readRaw(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
    });
    req.on("end", function () {
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function supabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
}

async function sb(path, opts) {
  var url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  var res = await fetch(url + path, Object.assign({}, opts, {
    headers: Object.assign({}, supabaseHeaders(key), (opts && opts.headers) || {})
  }));
  var text = await res.text();
  var data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    var err = new Error((data && (data.message || data.error)) || "Supabase error");
    err.status = 502;
    throw err;
  }
  return data;
}

async function loadOrder(id) {
  if (!id) return null;
  var rows = await sb(
    "/rest/v1/collection_orders?id=eq." + encodeURIComponent(id) + "&select=*"
  );
  return (rows && rows[0]) || null;
}

async function markPaid(order) {
  if (!order || order.paid) return;
  if (order.status !== "hold" && order.status !== "in") return;
  await sb("/rest/v1/collection_orders?id=eq." + encodeURIComponent(order.id), {
    method: "PATCH",
    body: JSON.stringify({
      paid: true,
      status: "in",
      updated_at: new Date().toISOString()
    })
  });
}

async function markExpired(order) {
  if (!order || order.paid) return;
  if (order.status !== "hold") return;
  await sb("/rest/v1/collection_orders?id=eq." + encodeURIComponent(order.id), {
    method: "PATCH",
    body: JSON.stringify({
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
  });
}

function orderIdOf(session) {
  if (!session) return "";
  if (session.metadata && session.metadata.order_id) return String(session.metadata.order_id);
  return String(session.client_reference_id || "");
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Stripe-Signature, Content-Type");
    res.end();
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { error: "Use POST." });
    return;
  }

  var raw;
  try {
    raw = await readRaw(req);
  } catch (err) {
    json(res, 400, { error: "The webhook could not be read." });
    return;
  }

  var signature = req.headers["stripe-signature"];
  var event;
  try {
    event = stripe.constructEvent(raw, signature);
  } catch (err) {
    json(res, err.status || 400, { error: "The webhook could not be verified." });
    return;
  }

  try {
    var session = event.data && event.data.object;
    var order = await loadOrder(orderIdOf(session));
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      if (session && session.payment_status === "paid") await markPaid(order);
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      await markExpired(order);
    }
    json(res, 200, { received: true });
  } catch (err) {
    json(res, err.status || 500, { error: "The collection could not update." });
  }
};
