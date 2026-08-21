/* Vercel serverless: Clerk-gated writes to the live menu + hours.
   Env: CLERK_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS
   Optional: SUPABASE_ANON_KEY is not used here. */

var crypto = require("crypto");
var jwksCache = { keys: null, at: 0 };

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

function bearer(req) {
  var h = req.headers.authorization || req.headers.Authorization || "";
  var m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function emailsOf(user) {
  var list = (user && user.email_addresses) || [];
  return list
    .map(function (row) {
      return String((row && row.email_address) || "").trim().toLowerCase();
    })
    .filter(Boolean);
}

function isAdmin(user) {
  var meta = (user && (user.public_metadata || user.publicMetadata)) || {};
  if (String(meta.role || "").toLowerCase() === "admin") return true;
  var allowed = String(process.env.ADMIN_EMAILS || "")
    .split(/[,;\s]+/)
    .map(function (e) {
      return e.trim().toLowerCase();
    })
    .filter(Boolean);
  if (!allowed.length) return false;
  return emailsOf(user).some(function (e) {
    return allowed.indexOf(e) !== -1;
  });
}

function authError(message, status) {
  var err = new Error(message);
  err.status = status || 401;
  return err;
}

function decodeJwtPart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function allowedParty(azp) {
  if (!azp) return true;
  var origin = String(azp).replace(/\/$/, "").toLowerCase();
  if (
    origin === "https://blancocoffeehouse.com" ||
    origin === "https://www.blancocoffeehouse.com" ||
    origin === "https://blancocoffeehouse.vercel.app" ||
    origin === "http://localhost" ||
    origin.indexOf("http://localhost:") === 0 ||
    origin.indexOf("http://127.0.0.1") === 0
  ) {
    return true;
  }
  if (/^https:\/\/blancocoffeehouse-[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  return false;
}

async function clerkJwks(secret) {
  if (jwksCache.keys && Date.now() - jwksCache.at < 60 * 60 * 1000) {
    return jwksCache.keys;
  }
  var res = await fetch("https://api.clerk.com/v1/jwks", {
    headers: { Authorization: "Bearer " + secret }
  });
  if (!res.ok) {
    throw authError("House desk Clerk key does not match this sign-in.", 503);
  }
  var data = await res.json();
  jwksCache = { keys: data.keys || [], at: Date.now() };
  return jwksCache.keys;
}

function verifyJwtSig(alg, data, key, sig) {
  if (alg === "RS256") return crypto.verify("RSA-SHA256", data, key, sig);
  if (alg === "ES256") {
    return crypto.verify("SHA256", data, { key: key, dsaEncoding: "ieee-p1363" }, sig);
  }
  return false;
}

async function verifySessionJwt(token, secret) {
  var parts = String(token || "").split(".");
  if (parts.length !== 3) throw authError("Sign in again to use the house desk.");
  var header;
  var payload;
  try {
    header = decodeJwtPart(parts[0]);
    payload = decodeJwtPart(parts[1]);
  } catch (err) {
    throw authError("Sign in again to use the house desk.");
  }
  if (header.alg !== "RS256" && header.alg !== "ES256") {
    throw authError("Sign in again to use the house desk.");
  }
  var now = Math.floor(Date.now() / 1000);
  if (payload.nbf && now < payload.nbf - 5) throw authError("Sign in again to use the house desk.");
  if (payload.exp && now > payload.exp + 5) throw authError("Sign in again to use the house desk.");
  if (!payload.sub) throw authError("Sign in again to use the house desk.");
  if (!allowedParty(payload.azp)) throw authError("Sign in again to use the house desk.");

  var keys = await clerkJwks(secret);
  var jwk =
    keys.filter(function (k) {
      return k.kid === header.kid;
    })[0] || keys[0];
  if (!jwk) throw authError("Sign in again to use the house desk.");

  var keyObject = crypto.createPublicKey({ key: jwk, format: "jwk" });
  var ok = verifyJwtSig(
    header.alg,
    Buffer.from(parts[0] + "." + parts[1]),
    keyObject,
    Buffer.from(parts[2], "base64url")
  );
  if (!ok) throw authError("Sign in again to use the house desk.");
  return payload;
}

async function clerkUser(sessionId, token, secret) {
  var claims = await verifySessionJwt(token, secret);
  var userId = claims.sub;
  if (sessionId && claims.sid && sessionId !== claims.sid) {
    throw authError("Sign in again to use the house desk.");
  }
  var userRes = await fetch(
    "https://api.clerk.com/v1/users/" + encodeURIComponent(userId),
    { headers: { Authorization: "Bearer " + secret } }
  );
  if (!userRes.ok) {
    throw authError("Clerk user could not be loaded");
  }
  return userRes.json();
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
    sold_out: !!row.sold_out
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

  var token = bearer(req);
  var sessionId = String(req.headers["x-clerk-session"] || "").trim();
  if (!token || !sessionId) {
    json(res, 401, { error: "Sign in to use the house desk." });
    return;
  }

  var user;
  try {
    user = await clerkUser(sessionId, token, secret);
  } catch (err) {
    json(res, err.status || 401, { error: err.message || "Not signed in." });
    return;
  }

  if (!isAdmin(user)) {
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
