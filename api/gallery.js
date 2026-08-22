/* Desk photo drop. Admin upload / remove. Public reads go through Supabase REST.
   Env: same as /api/admin */

var crypto = require("crypto");
var clerk = require("../lib/clerk-verify");

var KINDS = { cup: true, sweets: true, house: true };
var MAX_BYTES = 2 * 1024 * 1024;

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

function asShot(row) {
  return {
    id: row.id,
    path: row.path,
    alt: row.alt || "",
    kind: row.kind,
    caption: row.caption || "",
    created_at: row.created_at
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Clerk-Session");
    res.end();
    return;
  }

  var secret = process.env.CLERK_SECRET_KEY;
  var supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  var service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !service) {
    json(res, 503, { error: "The gallery drop is not configured yet." });
    return;
  }

  var user;
  try {
    user = await clerk.userFromRequest(req);
  } catch (err) {
    json(res, err.status || 401, { error: err.message || "Sign in again." });
    return;
  }

  if (!clerk.isAdmin(user)) {
    json(res, 403, { error: "This desk is for the house." });
    return;
  }

  try {
    if (req.method === "POST") {
      var body = await readBody(req);
      var image = decodeImage(body.image);
      if (!image) {
        json(res, 400, { error: "That picture could not go up. Use a photo from the camera roll." });
        return;
      }
      var kind = String(body.kind || "house").trim().toLowerCase();
      if (!KINDS[kind]) kind = "house";
      var alt = String(body.alt || body.caption || "From the house.").trim().slice(0, 180) || "From the house.";
      var caption = String(body.caption || "").trim().slice(0, 80);
      var path = "desk/" + Date.now() + "-" + crypto.randomBytes(4).toString("hex") + "." + image.ext;

      var up = await fetch(supabaseUrl + "/storage/v1/object/gallery/" + path, {
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

      var created = await sb("/rest/v1/gallery_shots", {
        method: "POST",
        body: JSON.stringify({
          path: path,
          alt: alt,
          kind: kind,
          caption: caption,
          sort: Date.now()
        })
      });
      json(res, 200, { shot: asShot((created && created[0]) || { path: path, alt: alt, kind: kind, caption: caption }) });
      return;
    }

    if (req.method !== "DELETE") {
      json(res, 405, { error: "Use POST or DELETE." });
      return;
    }

    var patch = await readBody(req);
    var id = String(patch.id || "").trim();
    if (!id) {
      json(res, 400, { error: "That picture is gone." });
      return;
    }
    var existing = await sb(
      "/rest/v1/gallery_shots?id=eq." + encodeURIComponent(id) + "&select=*"
    );
    var row = existing && existing[0];
    if (!row) {
      json(res, 404, { error: "That picture is gone." });
      return;
    }
    await fetch(supabaseUrl + "/storage/v1/object/gallery/" + row.path, {
      method: "DELETE",
      headers: supabaseHeaders(service)
    });
    await sb("/rest/v1/gallery_shots?id=eq." + encodeURIComponent(id), { method: "DELETE" });
    json(res, 200, { ok: true });
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "The gallery could not update." });
  }
};
