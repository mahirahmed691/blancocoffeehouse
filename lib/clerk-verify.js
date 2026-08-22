/* Shared Clerk JWT verification for Vercel functions.
   Env: CLERK_SECRET_KEY */

var crypto = require("crypto");
var jwksCache = { keys: null, at: 0 };

function authError(message, status) {
  var err = new Error(message);
  err.status = status || 401;
  return err;
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
  if (parts.length !== 3) throw authError("Sign in again.");
  var header;
  var payload;
  try {
    header = decodeJwtPart(parts[0]);
    payload = decodeJwtPart(parts[1]);
  } catch (err) {
    throw authError("Sign in again.");
  }
  if (header.alg !== "RS256" && header.alg !== "ES256") {
    throw authError("Sign in again.");
  }
  var now = Math.floor(Date.now() / 1000);
  if (payload.nbf && now < payload.nbf - 5) throw authError("Sign in again.");
  if (payload.exp && now > payload.exp + 5) throw authError("Sign in again.");
  if (!payload.sub) throw authError("Sign in again.");
  if (!allowedParty(payload.azp)) throw authError("Sign in again.");

  var keys = await clerkJwks(secret);
  var jwk =
    keys.filter(function (k) {
      return k.kid === header.kid;
    })[0] || keys[0];
  if (!jwk) throw authError("Sign in again.");

  var keyObject = crypto.createPublicKey({ key: jwk, format: "jwk" });
  var ok = verifyJwtSig(
    header.alg,
    Buffer.from(parts[0] + "." + parts[1]),
    keyObject,
    Buffer.from(parts[2], "base64url")
  );
  if (!ok) throw authError("Sign in again.");
  return payload;
}

async function clerkUser(sessionId, token, secret) {
  var claims = await verifySessionJwt(token, secret);
  var userId = claims.sub;
  if (sessionId && claims.sid && sessionId !== claims.sid) {
    throw authError("Sign in again.");
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

async function userFromRequest(req) {
  var secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw authError("House desk is not configured yet.", 503);
  var token = bearer(req);
  var sessionId = String(req.headers["x-clerk-session"] || "").trim();
  if (!token) throw authError("Sign in again.");
  return clerkUser(sessionId, token, secret);
}

module.exports = {
  authError: authError,
  bearer: bearer,
  emailsOf: emailsOf,
  isAdmin: isAdmin,
  clerkUser: clerkUser,
  userFromRequest: userFromRequest
};
