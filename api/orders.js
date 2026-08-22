/* Click-and-collect. Members place; the desk marks ready / collected.
   Env: same as /api/admin */

var clerk = require("../lib/clerk-verify");
var stripe = require("../lib/stripe");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
    });
    req.on("end", function () {
      var raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function queryParam(req, name) {
  if (req.query && req.query[name]) return String(req.query[name]);
  try {
    return new URL(req.url, "http://localhost").searchParams.get(name) || "";
  } catch (err) {
    return "";
  }
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
    err.detail = data;
    throw err;
  }
  return data;
}

function asPrice(value) {
  var n = Number(value);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function asDriverPrice(value) {
  if (value === "" || value === undefined || value === null) return null;
  return asPrice(value);
}

function firstName(user) {
  if (!user) return "";
  if (user.first_name) return user.first_name;
  var full = user.firstName || user.full_name || user.fullName || "";
  return String(full).split(" ")[0] || "";
}

function cleanItems(raw) {
  if (!Array.isArray(raw)) return [];
  var out = [];
  raw.forEach(function (row) {
    var name = String((row && row.name) || "").trim();
    var qty = parseInt(row && row.qty, 10) || 1;
    if (!name) return;
    if (qty < 1) qty = 1;
    if (qty > 9) qty = 9;
    out.push({ name: name.slice(0, 80), qty: qty });
  });
  return out.slice(0, 12);
}

function totalOf(items) {
  return items.reduce(function (sum, row) {
    return sum + row.price_gbp * row.qty;
  }, 0);
}

async function priceItems(raw, isDriver) {
  var names = cleanItems(raw);
  if (!names.length) return [];
  var menu = await sb(
    "/rest/v1/menu_items?select=name,price_gbp,driver_price_gbp&order=sort.asc"
  );
  var map = {};
  (menu || []).forEach(function (row) {
    map[String(row.name || "").trim().toLowerCase()] = row;
  });
  var out = [];
  names.forEach(function (row) {
    var found = map[row.name.toLowerCase()];
    if (!found) return;
    var price = asPrice(found.price_gbp);
    var rankPrice = asDriverPrice(found.driver_price_gbp);
    var rank = false;
    if (isDriver && rankPrice !== null) {
      price = rankPrice;
      rank = true;
    }
    if (price === null) return;
    out.push({
      name: String(found.name).slice(0, 80),
      price_gbp: price,
      qty: row.qty,
      rank: rank
    });
  });
  return out;
}

function asOrder(row) {
  return {
    id: row.id,
    name: row.name || "",
    email: row.email || "",
    status: row.status,
    items: row.items || [],
    note: row.note || "",
    total_gbp: Number(row.total_gbp) || 0,
    paid: !!row.paid,
    pay_at: row.pay_at || "counter",
    rank: !!row.rank,
    created_at: row.created_at
  };
}

async function isRankDriver(userId, email) {
  if (userId) {
    var byUser = await sb(
      "/rest/v1/rank_drivers?clerk_user_id=eq." +
        encodeURIComponent(userId) +
        "&status=eq.in&select=id"
    );
    if (byUser && byUser[0]) return true;
  }
  if (!email) return false;
  var byEmail = await sb(
    "/rest/v1/rank_drivers?email=eq." +
      encodeURIComponent(email) +
      "&status=eq.in&select=id"
  );
  return !!(byEmail && byEmail[0]);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Clerk-Session");
    res.end();
    return;
  }

  var secret = process.env.CLERK_SECRET_KEY;
  var supabaseUrl = process.env.SUPABASE_URL;
  var service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !service) {
    json(res, 503, { error: "Collections are not configured yet." });
    return;
  }

  var user;
  try {
    user = await clerk.userFromRequest(req);
  } catch (err) {
    json(res, err.status || 401, { error: err.message || "Sign in again." });
    return;
  }

  var admin = clerk.isAdmin(user);
  var email = clerk.emailsOf(user)[0] || "";
  var name = firstName(user);

  try {
    if (req.method === "GET") {
      var desk = queryParam(req, "desk") === "1";
      var rows;
      if (desk) {
        if (!admin) {
          json(res, 403, { error: "This desk is for the house." });
          return;
        }
        rows = await sb(
          "/rest/v1/collection_orders?status=neq.hold&status=neq.collected&status=neq.cancelled&order=created_at.asc&select=*"
        );
      } else {
        rows = await sb(
          "/rest/v1/collection_orders?clerk_user_id=eq." +
            encodeURIComponent(user.id) +
            "&order=created_at.desc&limit=12&select=*"
        );
      }
      json(res, 200, {
        stripe: stripe.stripeEnabled(),
        orders: (rows || []).map(asOrder)
      });
      return;
    }

    if (req.method === "POST") {
      var body = await readBody(req);
      var driver = await isRankDriver(user.id, email);
      var items = await priceItems(body.items, driver);
      if (!items.length) {
        json(res, 400, { error: "Add a drink or a sweet first." });
        return;
      }
      var payAt = String(body.pay || "counter").trim() === "stripe" ? "stripe" : "counter";
      if (payAt === "stripe" && !stripe.stripeEnabled()) {
        json(res, 503, { error: "Card is not on yet. Pay at the counter." });
        return;
      }
      var created = await sb("/rest/v1/collection_orders", {
        method: "POST",
        body: JSON.stringify({
          clerk_user_id: user.id,
          email: email || null,
          name: name || null,
          status: payAt === "stripe" ? "hold" : "in",
          items: items,
          note: String(body.note || "").trim().slice(0, 140),
          total_gbp: Math.round(totalOf(items) * 100) / 100,
          paid: false,
          pay_at: payAt,
          rank: driver && items.some(function (row) {
            return row.rank;
          })
        })
      });
      var orderRow = (created && created[0]) || {};
      if (payAt !== "stripe") {
        json(res, 200, { order: asOrder(orderRow) });
        return;
      }
      try {
        var session = await stripe.createCollectionCheckout(req, {
          id: orderRow.id,
          email: email,
          items: items
        });
        var updated = await sb(
          "/rest/v1/collection_orders?id=eq." + encodeURIComponent(orderRow.id),
          {
            method: "PATCH",
            body: JSON.stringify({
              stripe_session_id: session.id,
              updated_at: new Date().toISOString()
            })
          }
        );
        json(res, 200, {
          order: asOrder((updated && updated[0]) || orderRow),
          url: session.url
        });
      } catch (err) {
        await sb("/rest/v1/collection_orders?id=eq." + encodeURIComponent(orderRow.id), {
          method: "PATCH",
          body: JSON.stringify({
            status: "cancelled",
            updated_at: new Date().toISOString()
          })
        });
        json(res, 502, { error: "The card could not open." });
      }
      return;
    }

    if (req.method !== "PATCH") {
      json(res, 405, { error: "Use GET, POST, or PATCH." });
      return;
    }

    var patch = await readBody(req);
    var id = String(patch.id || "").trim();
    var status = String(patch.status || "").trim();
    if (!id || ["ready", "collected", "cancelled"].indexOf(status) === -1) {
      json(res, 400, { error: "That collection could not update." });
      return;
    }

    var existing = await sb(
      "/rest/v1/collection_orders?id=eq." + encodeURIComponent(id) + "&select=*"
    );
    var row = existing && existing[0];
    if (!row) {
      json(res, 404, { error: "That collection is gone." });
      return;
    }

    if (!admin && row.clerk_user_id !== user.id) {
      json(res, 403, { error: "That collection is not yours." });
      return;
    }
    if (!admin && status !== "cancelled") {
      json(res, 403, { error: "This desk is for the house." });
      return;
    }
    if (!admin && row.status !== "in" && row.status !== "hold") {
      json(res, 400, { error: "That collection is already moving." });
      return;
    }
    if (!admin && row.paid) {
      json(res, 400, { error: "That collection is already paid. Ask the desk." });
      return;
    }

    if (admin && status === "cancelled" && row.paid && row.pay_at === "stripe" && row.stripe_session_id) {
      try {
        await stripe.refundCollection(row.stripe_session_id);
      } catch (err) {
        json(res, 502, { error: "Paid on card — refund in Stripe, then try again." });
        return;
      }
    }

    var updated = await sb(
      "/rest/v1/collection_orders?id=eq." + encodeURIComponent(id),
      {
        method: "PATCH",
        body: JSON.stringify({
          status: status,
          updated_at: new Date().toISOString()
        })
      }
    );
    json(res, 200, { order: asOrder((updated && updated[0]) || row) });
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "The collection could not update." });
  }
};
