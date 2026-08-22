/* How the house feels right now. The desk sets it; members see it in the app and on the site.
   Env: same as /api/admin */

var clerk = require("../lib/clerk-verify");

var ROOM = {
  quiet: "quiet. seats are easy.",
  easy: "a few in. the room is easy.",
  busy: "busy. a short wait for a seat.",
  packed: "packed. takeaway is quicker."
};

var WAIT = {
  flowing: "the counter is flowing.",
  short: "a short wait for a cup.",
  queue: "a queue at the counter."
};

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

function cleanRoom(raw) {
  var value = String(raw || "").trim().toLowerCase();
  if (!value) return "";
  return ROOM[value] ? value : null;
}

function cleanWait(raw) {
  var value = String(raw || "").trim().toLowerCase();
  if (!value) return "";
  return WAIT[value] ? value : null;
}

function londonDay(at) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(at || new Date());
}

function isStale(paceAt) {
  if (!paceAt) return true;
  var at = new Date(paceAt);
  if (isNaN(at.getTime())) return true;
  return londonDay(at) !== londonDay();
}

function payload(row, admin) {
  var stale = isStale(row && row.pace_at);
  var how = stale ? "" : cleanRoom(row && row.how_busy) || "";
  var wait = stale ? "" : cleanWait(row && row.how_wait) || "";
  var parts = [];
  if (ROOM[how]) parts.push(ROOM[how]);
  if (WAIT[wait]) parts.push(WAIT[wait]);
  return {
    how_busy: how,
    how_wait: wait,
    pace_at: stale ? "" : (row && row.pace_at) || "",
    stale: stale,
    line: parts.join(" "),
    admin: !!admin
  };
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
    json(res, 503, { error: "The desk is not configured yet." });
    return;
  }

  try {
    var rows = await sb("/rest/v1/house_settings?id=eq.1&select=how_busy,how_wait,pace_at");
    var row = (rows && rows[0]) || {};

    if (req.method === "GET") {
      var admin = false;
      try {
        if (clerk.bearer(req)) {
          var user = await clerk.userFromRequest(req);
          admin = clerk.isAdmin(user);
        }
      } catch (err) {
        admin = false;
      }
      json(res, 200, payload(row, admin));
      return;
    }

    if (req.method !== "POST") {
      json(res, 405, { error: "Use GET or POST." });
      return;
    }

    var desk;
    try {
      desk = await clerk.userFromRequest(req);
    } catch (err) {
      json(res, err.status || 401, { error: err.message || "Sign in again." });
      return;
    }
    if (!clerk.isAdmin(desk)) {
      json(res, 403, { error: "This desk is for the house." });
      return;
    }

    var body = await readBody(req);
    var hasRoom = Object.prototype.hasOwnProperty.call(body, "how_busy");
    var hasWait = Object.prototype.hasOwnProperty.call(body, "how_wait");
    if (!hasRoom && !hasWait) {
      json(res, 400, { error: "Set the room or the counter." });
      return;
    }

    var patch = { pace_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (hasRoom) {
      var nextRoom = cleanRoom(body.how_busy);
      if (nextRoom === null) {
        json(res, 400, { error: "Pick quiet, easy, busy, packed, or clear." });
        return;
      }
      patch.how_busy = nextRoom;
    }
    if (hasWait) {
      var nextWait = cleanWait(body.how_wait);
      if (nextWait === null) {
        json(res, 400, { error: "Pick flowing, short, queue, or clear." });
        return;
      }
      patch.how_wait = nextWait;
    }

    var saved = await sb("/rest/v1/house_settings?id=eq.1", {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    json(res, 200, payload((saved && saved[0]) || Object.assign({}, row, patch), true));
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "The room could not update." });
  }
};
