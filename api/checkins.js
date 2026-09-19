/* Daily cup check-in. Members post; others see it in the app.
   Env: same as /api/orders
   Look gate (server, before the photo is public): OPENAI_API_KEY or GEMINI_API_KEY.
   A confident house shot goes live. NSFW / off-topic is refused. Uncertain waits on the desk. */

var crypto = require("crypto");
var clerk = require("../lib/clerk-verify");
var handles = require("../lib/handle");
var lookGate = require("../lib/look-gate");

var MAX_BYTES = 2 * 1024 * 1024;

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
  var res = await fetch(url + path, Object.assign({}, opts, {
    headers: Object.assign(
      {},
      supabaseHeaders(key, {
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }),
      (opts && opts.headers) || {}
    )
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

function decodeImage(raw) {
  var value = String(raw || "").trim();
  var match = value.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!match) return null;
  var mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  var buf;
  try {
    buf = Buffer.from(match[2], "base64");
  } catch (err) {
    return null;
  }
  if (!buf.length || buf.length > MAX_BYTES) return null;
  return { mime: mime, buf: buf, ext: mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg" };
}

function londonDay(at) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(at || new Date());
}

function liveSince() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function publicUri(supabaseUrl, path) {
  return supabaseUrl + "/storage/v1/object/public/checkins/" + path;
}

function queryParam(req, name) {
  if (req.query && req.query[name]) return String(req.query[name]);
  try {
    return new URL(req.url, "http://localhost").searchParams.get(name) || "";
  } catch (err) {
    return "";
  }
}

function asCup(row, userId, supabaseUrl) {
  return {
    id: row.id,
    uri: publicUri(supabaseUrl, row.path),
    name: row.display_name || "a member",
    day: row.day,
    status: row.status === "hold" ? "hold" : "live",
    mine: row.clerk_user_id === userId,
    created_at: row.created_at
  };
}

async function removeObject(supabaseUrl, service, path) {
  if (!path) return;
  await fetch(supabaseUrl + "/storage/v1/object/checkins/" + path, {
    method: "DELETE",
    headers: supabaseHeaders(service)
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Clerk-Session");
    res.end();
    return;
  }

  var secret = process.env.CLERK_SECRET_KEY;
  var supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  var service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !service) {
    json(res, 503, { error: "The board is not configured yet." });
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

  var today = londonDay();

  try {
    if (req.method === "GET") {
      var desk = queryParam(req, "desk") === "1";
      if (desk) {
        if (!clerk.isAdmin(user)) {
          json(res, 403, { error: "this desk is for the house." });
          return;
        }
        var deskRows = await sb(
          "/rest/v1/cup_checkins?select=id,clerk_user_id,display_name,path,day,status,created_at&created_at=gte." +
            encodeURIComponent(liveSince()) +
            "&order=created_at.desc&limit=80"
        );
        var deskList = Array.isArray(deskRows) ? deskRows : [];
        json(res, 200, {
          today: today,
          holds: deskList
            .filter(function (row) {
              return row.status === "hold";
            })
            .map(function (row) {
              return asCup(row, userId, supabaseUrl);
            }),
          cups: deskList
            .filter(function (row) {
              return row.status !== "hold";
            })
            .map(function (row) {
              return asCup(row, userId, supabaseUrl);
            })
        });
        return;
      }
      var rows = await sb(
        "/rest/v1/cup_checkins?select=id,clerk_user_id,display_name,path,day,status,created_at&created_at=gte." +
          encodeURIComponent(liveSince()) +
          "&order=created_at.desc&limit=80"
      );
      var list = Array.isArray(rows) ? rows : [];
      var mineRow =
        list.filter(function (row) {
          return row.clerk_user_id === userId;
        })[0] || null;
      var cups = list
        .filter(function (row) {
          return row.status !== "hold";
        })
        .map(function (row) {
          return asCup(row, userId, supabaseUrl);
        });
      var mine = mineRow ? asCup(mineRow, userId, supabaseUrl) : null;
      json(res, 200, {
        today: today,
        mine: mine,
        cups: cups,
        waiting: !!(mineRow && mineRow.status === "hold")
      });
      return;
    }

    if (req.method === "POST") {
      var body = await readBody(req);
      var image = decodeImage(body.image);
      if (!image) {
        json(res, 400, { error: "that picture could not go up. use the camera or a photo from the roll." });
        return;
      }

      var gate = await lookGate.judge(image);
      if (gate.verdict === "reject") {
        json(res, 400, { error: lookGate.message(gate) });
        return;
      }
      var status = gate.verdict === "hold" ? "hold" : "live";

      var existing = await sb(
        "/rest/v1/cup_checkins?clerk_user_id=eq." +
          encodeURIComponent(userId) +
          "&day=eq." +
          encodeURIComponent(today) +
          "&select=*"
      );
      var prior = existing && existing[0];
      var path =
        userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 36) +
        "/" +
        today +
        "-" +
        crypto.randomBytes(4).toString("hex") +
        "." +
        image.ext;

      var up = await fetch(supabaseUrl + "/storage/v1/object/checkins/" + path, {
        method: "POST",
        headers: supabaseHeaders(service, {
          "Content-Type": image.mime,
          "x-upsert": "false",
          "cache-control": "31536000"
        }),
        body: image.buf
      });
      if (!up.ok) {
        json(res, 502, { error: "The picture could not land." });
        return;
      }

      var name = await handles.ensure(sb, userId);
      var saved;
      if (prior) {
        saved = await sb("/rest/v1/cup_checkins?id=eq." + encodeURIComponent(prior.id), {
          method: "PATCH",
          body: JSON.stringify({
            display_name: name,
            path: path,
            status: status,
            created_at: new Date().toISOString()
          })
        });
        if (prior.path && prior.path !== path) await removeObject(supabaseUrl, service, prior.path);
      } else {
        saved = await sb("/rest/v1/cup_checkins", {
          method: "POST",
          body: JSON.stringify({
            clerk_user_id: userId,
            display_name: name,
            path: path,
            day: today,
            status: status
          })
        });
      }

      var row = (saved && saved[0]) || {
        id: prior && prior.id,
        clerk_user_id: userId,
        display_name: name,
        path: path,
        day: today,
        status: status,
        created_at: new Date().toISOString()
      };

      var extras = await sb(
        "/rest/v1/cup_checkins?clerk_user_id=eq." +
          encodeURIComponent(userId) +
          "&created_at=gte." +
          encodeURIComponent(liveSince()) +
          "&id=neq." +
          encodeURIComponent(row.id) +
          "&select=id,path"
      );
      var extraList = Array.isArray(extras) ? extras : [];
      for (var i = 0; i < extraList.length; i++) {
        await removeObject(supabaseUrl, service, extraList[i].path);
        await sb("/rest/v1/cup_checkins?id=eq." + encodeURIComponent(extraList[i].id), {
          method: "DELETE"
        });
      }

      json(res, 200, {
        today: today,
        cup: asCup(row, userId, supabaseUrl),
        hold: status === "hold"
      });
      return;
    }

    if (req.method === "PATCH") {
      if (!clerk.isAdmin(user)) {
        json(res, 403, { error: "this desk is for the house." });
        return;
      }
      var patchBody = await readBody(req);
      var deskId = String(patchBody.id || "").trim();
      var next = String(patchBody.status || "").trim();
      if (!deskId || (next !== "live" && next !== "drop")) {
        json(res, 400, { error: "that cup is gone." });
        return;
      }
      var deskFound = await sb(
        "/rest/v1/cup_checkins?id=eq." + encodeURIComponent(deskId) + "&select=*"
      );
      var deskRow = deskFound && deskFound[0];
      if (!deskRow) {
        json(res, 404, { error: "that cup is gone." });
        return;
      }
      if (next === "drop") {
        await removeObject(supabaseUrl, service, deskRow.path);
        await sb("/rest/v1/cup_checkins?id=eq." + encodeURIComponent(deskId), {
          method: "DELETE"
        });
        json(res, 200, { ok: true });
        return;
      }
      var opened = await sb("/rest/v1/cup_checkins?id=eq." + encodeURIComponent(deskId), {
        method: "PATCH",
        body: JSON.stringify({ status: "live" })
      });
      var openedRow = (opened && opened[0]) || deskRow;
      openedRow.status = "live";
      json(res, 200, { today: today, cup: asCup(openedRow, userId, supabaseUrl) });
      return;
    }

    if (req.method !== "DELETE") {
      json(res, 405, { error: "use GET, POST, PATCH, or DELETE." });
      return;
    }

    var patch = await readBody(req);
    var id = String(patch.id || "").trim();
    if (!id) {
      json(res, 400, { error: "That cup is gone." });
      return;
    }
    var found = await sb(
      "/rest/v1/cup_checkins?id=eq." + encodeURIComponent(id) + "&select=*"
    );
    var row = found && found[0];
    if (!row || row.clerk_user_id !== userId) {
      json(res, 404, { error: "That cup is gone." });
      return;
    }
    await removeObject(supabaseUrl, service, row.path);
    await sb("/rest/v1/cup_checkins?id=eq." + encodeURIComponent(id), { method: "DELETE" });
    json(res, 200, { ok: true });
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "The board could not update." });
  }
};
