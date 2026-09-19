/* House-branded stamp QR for the counter. Server only. */
var QRCode = require("qrcode");

var TOKEN_TTL_MS = 60 * 1000;
var VISIT_MS = 4 * 60 * 60 * 1000;
var HOUSE_ORIGIN = "https://www.blancocoffeehouse.com";
var QR_COLOR = { dark: "#503931", light: "#efe9e2" };

function localOrigin(req) {
  var env = String(process.env.HOUSE_ORIGIN || process.env.STAMP_ORIGIN || "").replace(/\/$/, "");
  if (/^https?:\/\/.+/i.test(env)) return env;
  if (!req || !req.headers) return "";
  var host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  if (!host) return "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host) && !/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return "";
  }
  var proto = String(req.headers["x-forwarded-proto"] || "http")
    .split(",")[0]
    .trim();
  if (proto !== "https") proto = "http";
  return proto + "://" + host;
}

function stampUrl(token, origin) {
  var base = String(origin || HOUSE_ORIGIN).replace(/\/$/, "");
  if (!/^https?:\/\/.+/i.test(base)) base = HOUSE_ORIGIN;
  return base + "/stamp.html?t=" + encodeURIComponent(token);
}

async function stampSvg(url) {
  var svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 512,
    color: QR_COLOR
  });
  return String(svg || "")
    .replace(/width="[\d.]+"/, 'width="100%"')
    .replace(/height="[\d.]+"/, 'height="100%"');
}

async function stampPng(url) {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 512,
    color: QR_COLOR
  });
}

module.exports = {
  TOKEN_TTL_MS: TOKEN_TTL_MS,
  VISIT_MS: VISIT_MS,
  HOUSE_ORIGIN: HOUSE_ORIGIN,
  localOrigin: localOrigin,
  stampUrl: stampUrl,
  stampSvg: stampSvg,
  stampPng: stampPng
};
