/* Member stamp cards. GET own card. Admin lookup / stamp by email.
   Admin mint of a short-lived counter QR. Member redeem of that code.
   Env: same as /api/admin */

var crypto = require("crypto");
var clerk = require("../lib/clerk-verify");
var stampQr = require("../lib/stamp-qr");

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

function cardPayload(row) {
  return {
    stamps: row && row.stamps ? Number(row.stamps) : 0,
    cards_done: row && row.cards_done ? Number(row.cards_done) : 0,
    email: (row && row.email) || "",
    name: (row && row.name) || ""
  };
}

function firstName(user) {
  if (!user) return "";
  if (user.first_name) return user.first_name;
  var full = user.firstName || user.full_name || user.fullName || "";
  return String(full).split(" ")[0] || "";
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

async function getOrCreateCard(userId, email) {
  var rows = await sb(
    "/rest/v1/stamp_cards?clerk_user_id=eq." + encodeURIComponent(userId) + "&select=*"
  );
  if (rows && rows[0]) {
    if (email && rows[0].email !== email) {
      var patched = await sb(
        "/rest/v1/stamp_cards?clerk_user_id=eq." + encodeURIComponent(userId),
        {
          method: "PATCH",
          body: JSON.stringify({ email: email, updated_at: new Date().toISOString() })
        }
      );
      return (patched && patched[0]) || rows[0];
    }
    return rows[0];
  }
  var created = await sb("/rest/v1/stamp_cards", {
    method: "POST",
    body: JSON.stringify({
      clerk_user_id: userId,
      email: email || null,
      stamps: 0,
      cards_done: 0
    })
  });
  return (created && created[0]) || { stamps: 0, cards_done: 0, email: email || "" };
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function newToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function queryFlag(req, name) {
  if (req.query && req.query[name] != null) return String(req.query[name]);
  try {
    return new URL(req.url, "http://localhost").searchParams.get(name) || "";
  } catch (err) {
    return "";
  }
}

function stampErr(message, status) {
  var err = new Error(message);
  err.status = status || 400;
  return err;
}

async function stampCard(row, extra) {
  var stamps = Number(row.stamps || 0) + 1;
  var cardsDone = Number(row.cards_done || 0);
  var filled = false;
  if (stamps >= 8) {
    stamps = 0;
    cardsDone += 1;
    filled = true;
  }
  var body = {
    stamps: stamps,
    cards_done: cardsDone,
    updated_at: new Date().toISOString()
  };
  if (extra) Object.assign(body, extra);
  var updated = await sb(
    "/rest/v1/stamp_cards?id=eq." + encodeURIComponent(row.id),
    {
      method: "PATCH",
      body: JSON.stringify(body)
    }
  );
  var next = (updated && updated[0]) || row;
  next._filled = filled;
  return next;
}

async function mintShow(adminId, origin) {
  var now = new Date();
  await sb(
    "/rest/v1/stamp_tokens?minted_by=eq." +
      encodeURIComponent(adminId) +
      "&redeemed_at=is.null",
    {
      method: "PATCH",
      body: JSON.stringify({ expires_at: now.toISOString() })
    }
  );
  var token = newToken();
  var expires = new Date(now.getTime() + stampQr.TOKEN_TTL_MS);
  await sb("/rest/v1/stamp_tokens", {
    method: "POST",
    body: JSON.stringify({
      token_hash: tokenHash(token),
      minted_by: adminId,
      expires_at: expires.toISOString()
    })
  });
  var url = stampQr.stampUrl(token, origin);
  return {
    url: url,
    expires_at: expires.toISOString(),
    ttl_sec: Math.round(stampQr.TOKEN_TTL_MS / 1000),
    svg: await stampQr.stampSvg(url),
    png: await stampQr.stampPng(url)
  };
}

async function redeemShow(user, token) {
  var raw = String(token || "").trim();
  if (!raw || raw.length < 12 || raw.length > 80) {
    throw stampErr("this code is not from the house.", 400);
  }
  var hash = tokenHash(raw);
  var rows = await sb(
    "/rest/v1/stamp_tokens?token_hash=eq." + encodeURIComponent(hash) + "&select=*"
  );
  var row = rows && rows[0];
  if (!row) throw stampErr("this code is not from the house.", 404);
  if (row.redeemed_at) throw stampErr("this code has been used.", 409);
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw stampErr("this code has gone. ask the house for a new one.", 410);
  }

  var email = clerk.emailsOf(user)[0] || "";
  var card = await getOrCreateCard(user.id, email);
  if (card.last_qr_at && new Date(card.last_qr_at).getTime() > Date.now() - stampQr.VISIT_MS) {
    throw stampErr("already stamped this visit.", 429);
  }

  var claimed = await sb(
    "/rest/v1/stamp_tokens?id=eq." +
      encodeURIComponent(row.id) +
      "&redeemed_at=is.null",
    {
      method: "PATCH",
      body: JSON.stringify({
        redeemed_at: new Date().toISOString(),
        redeemed_by: user.id
      })
    }
  );
  if (!claimed || !claimed[0]) throw stampErr("this code has been used.", 409);

  var cas = card.last_qr_at
    ? "&last_qr_at=eq." + encodeURIComponent(card.last_qr_at)
    : "&last_qr_at=is.null";
  var stamped = await sb(
    "/rest/v1/stamp_cards?id=eq." + encodeURIComponent(card.id) + cas,
    {
      method: "PATCH",
      body: JSON.stringify({
        stamps: (function () {
          var n = Number(card.stamps || 0) + 1;
          return n >= 8 ? 0 : n;
        })(),
        cards_done:
          Number(card.stamps || 0) + 1 >= 8
            ? Number(card.cards_done || 0) + 1
            : Number(card.cards_done || 0),
        last_qr_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  );
  var next = stamped && stamped[0];
  if (!next) throw stampErr("already stamped this visit.", 429);
  next._filled = Number(card.stamps || 0) + 1 >= 8;
  return next;
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
    json(res, 503, { error: "Stamps are not configured yet." });
    return;
  }

  var user;
  try {
    user = await clerk.userFromRequest(req);
  } catch (err) {
    json(res, err.status || 401, { error: err.message || "Sign in again." });
    return;
  }

  var ownEmail = clerk.emailsOf(user)[0] || "";
  var admin = clerk.isAdmin(user);

  try {
    if (req.method === "GET") {
      var show = queryFlag(req, "show") || queryFlag(req, "mint");
      if (show) {
        if (!admin) {
          json(res, 403, { error: "This desk is for the house." });
          return;
        }
        json(res, 200, await mintShow(user.id, stampQr.localOrigin(req)));
        return;
      }
      var lookup = String(queryFlag(req, "email") || "").trim().toLowerCase();
      if (lookup) {
        if (!admin) {
          json(res, 403, { error: "This desk is for the house." });
          return;
        }
        var found = await findClerkUserByEmail(lookup, secret);
        if (!found) {
          json(res, 404, { error: "No account for that email." });
          return;
        }
        var looked = await getOrCreateCard(found.id, lookup);
        json(res, 200, Object.assign(cardPayload(looked), { name: firstName(found) }));
        return;
      }
      var mine = await getOrCreateCard(user.id, ownEmail);
      json(res, 200, cardPayload(mine));
      return;
    }

    if (req.method !== "POST") {
      json(res, 405, { error: "Use GET or POST." });
      return;
    }

    var body = await readBody(req);
    var action = String(body.action || "").trim().toLowerCase();
    var token = String(body.token || "").trim();

    if (action === "mint" || action === "show") {
      if (!admin) {
        json(res, 403, { error: "This desk is for the house." });
        return;
      }
      json(res, 200, await mintShow(user.id, stampQr.localOrigin(req)));
      return;
    }

    if (token) {
      var redeemed = await redeemShow(user, token);
      json(
        res,
        200,
        Object.assign(cardPayload(redeemed), {
          name: firstName(user),
          filled: !!redeemed._filled
        })
      );
      return;
    }

    if (!admin) {
      json(res, 403, { error: "This desk is for the house." });
      return;
    }

    var email = String(body.email || "").trim().toLowerCase();
    if (!email || email.indexOf("@") === -1) {
      json(res, 400, { error: "Type a member email." });
      return;
    }
    var member = await findClerkUserByEmail(email, secret);
    if (!member) {
      json(res, 404, { error: "No account for that email." });
      return;
    }
    var card = await getOrCreateCard(member.id, email);
    var next = await stampCard(card);
    json(
      res,
      200,
      Object.assign(cardPayload(next), {
        name: firstName(member),
        filled: !!next._filled
      })
    );
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "The card could not update." });
  }
};
