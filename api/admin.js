/* Vercel serverless: Clerk-gated writes to the live menu + hours.
   Env: CLERK_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS
   Optional: SUPABASE_ANON_KEY is not used here. */

var clerk = require("../lib/clerk-verify");

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

function asPhoto(value) {
  var raw = String(value || "").trim();
  if (!raw) return "";
  if (/^assets\/photos\/[a-z0-9][a-z0-9._-]*\.(jpg|jpeg|png|webp)$/i.test(raw)) return raw;
  if (
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/gallery\/[a-z0-9._/-]+\.(jpg|jpeg|png|webp)$/i.test(
      raw
    )
  ) {
    return raw.slice(0, 400);
  }
  return "";
}

function asItem(row) {
  var price = asPrice(row.price_gbp);
  var board = row.board === "sweets" ? "sweets" : "drinks";
  var name = String(row.name || "").trim();
  if (!name || price === null) return null;
  var item = {
    board: board,
    section: String(row.section || "The board").trim() || "The board",
    name: name,
    description: String(row.description || "").trim(),
    price_gbp: price,
    sort: parseInt(row.sort, 10) || 0,
    sold_out: !!row.sold_out,
    photo: asPhoto(row.photo),
    driver_price_gbp: asDriverPrice(row.driver_price_gbp)
  };
  if (row.id) item.id = String(row.id);
  return item;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Clerk-Session");
    res.end();
    return;
  }

  var secret = process.env.CLERK_SECRET_KEY;
  var supabaseUrl = process.env.SUPABASE_URL;
  var service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !service) {
    json(res, 503, { error: "House desk is not configured yet." });
    return;
  }

  var token = clerk.bearer(req);
  var sessionId = String(req.headers["x-clerk-session"] || "").trim();
  if (!token) {
    json(res, 401, { error: "Sign in to use the house desk." });
    return;
  }

  var user;
  try {
    user = await clerk.clerkUser(sessionId, token, secret);
  } catch (err) {
    json(res, err.status || 401, { error: err.message || "Not signed in." });
    return;
  }

  if (!clerk.isAdmin(user)) {
    json(res, 403, { error: "This desk is for the house." });
    return;
  }

  try {
    if (req.method === "GET") {
      var settingsRows = await sb("/rest/v1/house_settings?id=eq.1&select=*");
      var items = await sb("/rest/v1/menu_items?select=*&order=sort.asc,name.asc");
      json(res, 200, {
        settings: settingsRows[0] || null,
        items: items || []
      });
      return;
    }

    if (req.method !== "PUT") {
      json(res, 405, { error: "Use GET or PUT." });
      return;
    }

    var body = await readBody(req);
    var settings = body.settings || {};
    var incoming = Array.isArray(body.items) ? body.items : [];
    var deleted = Array.isArray(body.deleted_ids) ? body.deleted_ids : [];

    if (settings && typeof settings === "object") {
      var patch = {
        hours_line: String(settings.hours_line || "").trim() || "Open every day · 11am–8pm",
        hours_days: String(settings.hours_days || "").trim() || "Monday–Sunday",
        hours_range: String(settings.hours_range || "").trim() || "11am–8pm",
        opens: String(settings.opens || "11:00").trim() || "11:00",
        closes: String(settings.closes || "20:00").trim() || "20:00",
        notice: String(settings.notice || "").trim(),
        updated_at: new Date().toISOString()
      };
      await sb("/rest/v1/house_settings", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(Object.assign({ id: 1 }, patch))
      });
    }

    for (var i = 0; i < deleted.length; i++) {
      var delId = String(deleted[i] || "").trim();
      if (!delId) continue;
      await sb("/rest/v1/menu_items?id=eq." + encodeURIComponent(delId), {
        method: "DELETE"
      });
    }

    for (var j = 0; j < incoming.length; j++) {
      var next = asItem(incoming[j]);
      if (!next) continue;
      next.updated_at = new Date().toISOString();
      if (next.id) {
        var id = next.id;
        delete next.id;
        await sb("/rest/v1/menu_items?id=eq." + encodeURIComponent(id), {
          method: "PATCH",
          body: JSON.stringify(next)
        });
      } else {
        await sb("/rest/v1/menu_items", {
          method: "POST",
          body: JSON.stringify(next)
        });
      }
    }

    var settingsOut = await sb("/rest/v1/house_settings?id=eq.1&select=*");
    var itemsOut = await sb("/rest/v1/menu_items?select=*&order=sort.asc,name.asc");
    json(res, 200, {
      ok: true,
      settings: settingsOut[0] || null,
      items: itemsOut || []
    });
  } catch (err) {
    json(res, err.status || 500, {
      error: err.message || "The desk could not save.",
      detail: err.detail || null
    });
  }
};
