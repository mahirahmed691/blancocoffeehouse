/* House handles. Assigned, or pick from suggestions. Real names stay in settings.
   Env: same as /api/orders */

var clerk = require("../lib/clerk-verify");
var handles = require("../lib/handle");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
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

function supabaseHeaders(key, extra) {
  return Object.assign(
    {
      apikey: key,
      Authorization: "Bearer " + key
    },
    extra || {}
  );
}

async function sb(path, opts) {
  var url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  var res = await fetch(
    url + path,
    Object.assign({}, opts, {
      headers: Object.assign(
        {},
        supabaseHeaders(key, {
          "Content-Type": "application/json",
          Prefer: "return=representation"
        }),
        (opts && opts.headers) || {}
      )
    })
  );
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

async function takenMap(list) {
  if (!list.length) return {};
  var filter = list
    .map(function (row) {
      return encodeURIComponent(row);
    })
    .join(",");
  var rows = await sb("/rest/v1/member_handles?handle=in.(" + filter + ")&select=handle");
  var map = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    if (row && row.handle) map[String(row.handle).toLowerCase()] = true;
  });
  return map;
}

async function ensureHandle(userId) {
  return handles.ensure(sb, userId);
}

async function suggestFor(userId, current) {
  var seeds = [];
  var i;
  for (i = 0; i < 48; i++) seeds.push(handles.fromIndex(userId + ":more:" + Date.now() + ":" + i, i));
  var taken = await takenMap(seeds.concat(current ? [current] : []));
  if (current) delete taken[current];
  return handles.suggestions(userId + ":pick:" + Date.now(), taken, 8);
}

async function renameLiveCups(userId, handle) {
  await sb("/rest/v1/cup_checkins?clerk_user_id=eq." + encodeURIComponent(userId), {
    method: "PATCH",
    body: JSON.stringify({ display_name: handle })
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Clerk-Session");
    res.end();
    return;
  }

  var secret = process.env.CLERK_SECRET_KEY;
  var supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  var service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !service) {
    json(res, 503, { error: "The house is not configured yet." });
    return;
  }

  var user;
  try {
    user = await clerk.userFromRequest(req);
  } catch (err) {
    json(res, err.status || 401, { error: err.message || "Sign in again." });
    return;
  }

  var userId = String(user.id || "");
  if (!userId) {
    json(res, 401, { error: "Sign in again." });
    return;
  }

  try {
    if (req.method === "GET") {
      var handle = await ensureHandle(userId);
      var suggested = await suggestFor(userId, handle);
      json(res, 200, { handle: handle, suggestions: suggested });
      return;
    }

    if (req.method !== "POST") {
      json(res, 405, { error: "Use GET or POST." });
      return;
    }

    var body = await readBody(req);
    if (body.more) {
      var current = await ensureHandle(userId);
      json(res, 200, { handle: current, suggestions: await suggestFor(userId, current) });
      return;
    }

    var next = String(body.handle || "").trim().toLowerCase();
    if (!handles.isValid(next)) {
      json(res, 400, { error: "Pick one of the house names." });
      return;
    }

    var held = await sb(
      "/rest/v1/member_handles?handle=eq." + encodeURIComponent(next) + "&select=clerk_user_id"
    );
    if (held && held[0] && held[0].clerk_user_id !== userId) {
      json(res, 409, { error: "That name is already in the house. Pick another." });
      return;
    }

    var mine = await sb(
      "/rest/v1/member_handles?clerk_user_id=eq." + encodeURIComponent(userId) + "&select=handle"
    );
    if (mine && mine[0]) {
      await sb("/rest/v1/member_handles?clerk_user_id=eq." + encodeURIComponent(userId), {
        method: "PATCH",
        body: JSON.stringify({ handle: next, updated_at: new Date().toISOString() })
      });
    } else {
      await sb("/rest/v1/member_handles", {
        method: "POST",
        body: JSON.stringify({ clerk_user_id: userId, handle: next })
      });
    }
    await renameLiveCups(userId, next);
    json(res, 200, { handle: next, suggestions: await suggestFor(userId, next) });
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "That name could not be kept." });
  }
};
