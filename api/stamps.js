/* Member stamp cards. GET own card. Admin lookup / stamp by email.
   Env: same as /api/admin */

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

async function stampCard(row) {
  var stamps = Number(row.stamps || 0) + 1;
  var cardsDone = Number(row.cards_done || 0);
  var filled = false;
  if (stamps >= 8) {
    stamps = 0;
    cardsDone += 1;
    filled = true;
  }
  var updated = await sb(
    "/rest/v1/stamp_cards?id=eq." + encodeURIComponent(row.id),
    {
      method: "PATCH",
      body: JSON.stringify({
        stamps: stamps,
        cards_done: cardsDone,
        updated_at: new Date().toISOString()
      })
    }
  );
  var next = (updated && updated[0]) || row;
  next._filled = filled;
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
      var lookup = "";
      if (req.query && req.query.email) lookup = String(req.query.email);
      else {
        try {
          lookup = new URL(req.url, "http://localhost").searchParams.get("email") || "";
        } catch (err) {}
      }
      lookup = lookup.trim().toLowerCase();
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

    if (!admin) {
      json(res, 403, { error: "This desk is for the house." });
      return;
    }

    var body = await readBody(req);
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
