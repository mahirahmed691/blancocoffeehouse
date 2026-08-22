/* Taxi rank concession. Members join with the house code; the desk can add or pause.
   Env: same as /api/admin */

var crypto = require("crypto");
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

function firstName(user) {
  if (!user) return "";
  if (user.first_name) return user.first_name;
  var full = user.firstName || user.full_name || user.fullName || "";
  return String(full).split(" ")[0] || "";
}

function asPrice(value) {
  var n = Number(value);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function makeCode() {
  var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var bytes = crypto.randomBytes(4);
  var out = "RANK-";
  for (var i = 0; i < 4; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function cleanCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^RANK/, "RANK-")
    .replace(/-+/g, "-");
}

function asDriver(row) {
  return {
    id: row.id,
    email: row.email || "",
    name: row.name || "",
    status: row.status,
    created_at: row.created_at
  };
}

async function findClerkUserByEmail(email, secret) {
  var res = await fetch(
    "https://api.clerk.com/v1/users?limit=5&email_address=" + encodeURIComponent(email),
    { headers: { Authorization: "Bearer " + secret } }
  );
  if (!res.ok) return null;
  var list = await res.json();
  if (!Array.isArray(list) || !list.length) return null;
  return list[0];
}

async function rankSettings() {
  var rows = await sb("/rest/v1/rank_settings?id=eq.1&select=*");
  if (rows && rows[0] && rows[0].join_code) return rows[0];
  var created = await sb("/rest/v1/rank_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      id: 1,
      join_code: makeCode(),
      updated_at: new Date().toISOString()
    })
  });
  return (created && created[0]) || { join_code: "RANK-4W7K" };
}

async function concessionItems() {
  var rows = await sb(
    "/rest/v1/menu_items?driver_price_gbp=not.is.null&sold_out=eq.false&select=name,board,driver_price_gbp,sort&order=sort.asc,name.asc"
  );
  return (rows || [])
    .map(function (row) {
      var price = asPrice(row.driver_price_gbp);
      if (price === null) return null;
      return {
        name: row.name,
        board: row.board,
        price_gbp: price
      };
    })
    .filter(Boolean);
}

async function findDriver(userId, email) {
  if (userId) {
    var byUser = await sb(
      "/rest/v1/rank_drivers?clerk_user_id=eq." + encodeURIComponent(userId) + "&select=*"
    );
    if (byUser && byUser[0]) return byUser[0];
  }
  if (!email) return null;
  var byEmail = await sb(
    "/rest/v1/rank_drivers?email=eq." + encodeURIComponent(email) + "&select=*"
  );
  var row = byEmail && byEmail[0];
  if (row && userId && !row.clerk_user_id) {
    var patched = await sb(
      "/rest/v1/rank_drivers?id=eq." + encodeURIComponent(row.id),
      {
        method: "PATCH",
        body: JSON.stringify({
          clerk_user_id: userId,
          updated_at: new Date().toISOString()
        })
      }
    );
    return (patched && patched[0]) || row;
  }
  return row || null;
}

async function upsertDriver(fields) {
  var email = String(fields.email || "").trim().toLowerCase();
  var existing = await findDriver(fields.clerk_user_id || "", email);
  var payload = {
    email: email,
    name: fields.name || null,
    status: fields.status || "in",
    updated_at: new Date().toISOString()
  };
  if (fields.clerk_user_id) payload.clerk_user_id = fields.clerk_user_id;
  if (existing) {
    var patched = await sb(
      "/rest/v1/rank_drivers?id=eq." + encodeURIComponent(existing.id),
      { method: "PATCH", body: JSON.stringify(payload) }
    );
    return (patched && patched[0]) || existing;
  }
  var created = await sb("/rest/v1/rank_drivers", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return (created && created[0]) || payload;
}

function memberPayload(row, items) {
  var on = !!(row && row.status === "in");
  return {
    driver: on,
    paused: !!(row && row.status === "paused"),
    items: on ? items : []
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Clerk-Session");
    res.end();
    return;
  }

  var secret = process.env.CLERK_SECRET_KEY;
  var supabaseUrl = process.env.SUPABASE_URL;
  var service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !service) {
    json(res, 503, { error: "The rank is not configured yet." });
    return;
  }

  var user;
  try {
    user = await clerk.userFromRequest(req);
  } catch (err) {
    json(res, err.status || 401, { error: err.message || "Sign in again." });
    return;
  }

  var email = clerk.emailsOf(user)[0] || "";
  var name = firstName(user);
  var admin = clerk.isAdmin(user);

  try {
    if (req.method === "GET") {
      var desk = queryParam(req, "desk") === "1";
      if (desk) {
        if (!admin) {
          json(res, 403, { error: "This desk is for the house." });
          return;
        }
        var settings = await rankSettings();
        var drivers = await sb(
          "/rest/v1/rank_drivers?select=*&order=updated_at.desc&limit=80"
        );
        var onRank = (drivers || []).filter(function (row) {
          return row.status === "in";
        });
        json(res, 200, {
          code: settings.join_code,
          count: onRank.length,
          drivers: (drivers || []).map(asDriver),
          items: await concessionItems()
        });
        return;
      }
      var mine = await findDriver(user.id, email);
      json(res, 200, memberPayload(mine, await concessionItems()));
      return;
    }

    if (req.method !== "POST") {
      json(res, 405, { error: "Use GET or POST." });
      return;
    }

    var body = await readBody(req);
    var action = String(body.action || "join").trim();

    if (admin && action === "rotate") {
      var nextCode = makeCode();
      var rotated = await sb("/rest/v1/rank_settings?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify({
          join_code: nextCode,
          updated_at: new Date().toISOString()
        })
      });
      json(res, 200, {
        code: (rotated && rotated[0] && rotated[0].join_code) || nextCode
      });
      return;
    }

    if (admin && (action === "add" || action === "pause" || action === "in")) {
      var lookup = String(body.email || "").trim().toLowerCase();
      if (!lookup || lookup.indexOf("@") === -1) {
        json(res, 400, { error: "Type a driver email." });
        return;
      }
      var member = await findClerkUserByEmail(lookup, secret);
      var row = await upsertDriver({
        clerk_user_id: member ? member.id : "",
        email: lookup,
        name: member ? firstName(member) : "",
        status: action === "pause" ? "paused" : "in"
      });
      json(res, 200, {
        driver: asDriver(row),
        linked: !!member
      });
      return;
    }

    if (action !== "join") {
      json(res, 400, { error: "That could not go on the rank." });
      return;
    }

    var existing = await findDriver(user.id, email);
    if (existing && existing.status === "paused") {
      json(res, 403, { error: "Ask the desk to put you back on the rank." });
      return;
    }
    if (existing && existing.status === "in") {
      json(res, 200, memberPayload(existing, await concessionItems()));
      return;
    }

    if (!email) {
      json(res, 400, { error: "Add an email to the account first." });
      return;
    }

    var settingsNow = await rankSettings();
    var given = cleanCode(body.code);
    var expected = cleanCode(settingsNow.join_code);
    if (!given || given !== expected) {
      json(res, 400, { error: "That code is not for the rank." });
      return;
    }

    var joined = await upsertDriver({
      clerk_user_id: user.id,
      email: email,
      name: name,
      status: "in"
    });
    json(res, 200, memberPayload(joined, await concessionItems()));
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "The rank could not update." });
  }
};
