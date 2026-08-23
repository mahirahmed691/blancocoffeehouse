/* Pickup time for a collection. Null is when it's ready. London clock. */

var TZ = "Europe/London";
var SLOT = 15;

function pad(n) {
  return String(n).padStart(2, "0");
}

function londonDay(at) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(at || new Date());
}

function londonMinutes(at) {
  var parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23"
  }).formatToParts(at || new Date());
  var hour = Number(
    (
      parts.filter(function (part) {
        return part.type === "hour";
      })[0] || {}
    ).value
  );
  var minute = Number(
    (
      parts.filter(function (part) {
        return part.type === "minute";
      })[0] || {}
    ).value
  );
  if (!isFinite(hour) || !isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function parseMinutes(value) {
  var match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  var hour = Number(match[1]);
  var minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function hoursWindow(hours) {
  var openAt = parseMinutes(hours && hours.opens);
  var closeAt = parseMinutes(hours && hours.closes);
  return {
    openAt: openAt == null ? 11 * 60 : openAt,
    closeAt: closeAt == null ? 20 * 60 : closeAt
  };
}

function clockLabel(minutes) {
  var hour = Math.floor(minutes / 60) % 12;
  if (hour === 0) hour = 12;
  return hour + ":" + pad(minutes % 60);
}

function clockLine(minutes) {
  return "for " + clockLabel(minutes) + ".";
}

function londonIsoAt(day, minutes) {
  var hm = pad(Math.floor(minutes / 60)) + ":" + pad(minutes % 60);
  var utc = new Date(day + "T" + hm + ":00.000Z");
  for (var i = 0; i < 4; i++) {
    var gotDay = londonDay(utc);
    var gotMin = londonMinutes(utc);
    var dayDiff =
      Date.parse(day + "T00:00:00Z") - Date.parse(gotDay + "T00:00:00Z");
    var delta = minutes - gotMin + dayDiff / 60000;
    if (delta === 0) break;
    utc = new Date(utc.getTime() + delta * 60000);
  }
  return utc.toISOString();
}

function pickupWhen(forAt) {
  if (!forAt) return "";
  var at = new Date(forAt);
  if (isNaN(at.getTime())) return "";
  return "for " + clockLabel(londonMinutes(at));
}

function pickupLine(forAt) {
  var when = pickupWhen(forAt);
  return when ? when + "." : "when it's ready.";
}

function pickupSlots(hours, at) {
  var now = at || new Date();
  var win = hoursWindow(hours);
  var mins = londonMinutes(now);
  if (mins >= win.closeAt) return [];
  var start = mins < win.openAt ? win.openAt : Math.ceil((mins + 1) / SLOT) * SLOT;
  var out = [];
  for (var m = start; m < win.closeAt; m += SLOT) {
    out.push({
      minutes: m,
      hm: pad(Math.floor(m / 60)) + ":" + pad(m % 60),
      label: clockLabel(m),
      line: clockLine(m)
    });
  }
  return out;
}

function resolveForAt(raw, hours, at) {
  var now = at || new Date();
  var value = raw == null ? "" : String(raw).trim();
  if (!value || value === "ready" || value === "when") return null;

  var win = hoursWindow(hours);
  var nowMin = londonMinutes(now);
  var day = londonDay(now);
  var minutes = null;

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    var parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      var bad = new Error("that time is not for the house.");
      bad.status = 400;
      throw bad;
    }
    if (londonDay(parsed) !== day) {
      var other = new Error(
        "that time is for another day. pick a time today, or when it's ready."
      );
      other.status = 400;
      throw other;
    }
    minutes = londonMinutes(parsed);
  } else {
    minutes = parseMinutes(value);
  }

  if (minutes == null) {
    var unknown = new Error("that time is not for the house.");
    unknown.status = 400;
    throw unknown;
  }
  if (nowMin >= win.closeAt) {
    var shut = new Error("the house is closed now. we'll have it when we open.");
    shut.status = 400;
    throw shut;
  }
  if (minutes < win.openAt || minutes >= win.closeAt) {
    var closed = new Error(
      "the house is closed then. pick a time we are open, or when it's ready."
    );
    closed.status = 400;
    throw closed;
  }
  if (minutes <= nowMin) {
    var gone = new Error(
      "that time has already gone. pick another, or when it's ready."
    );
    gone.status = 400;
    throw gone;
  }
  return londonIsoAt(day, minutes);
}

module.exports = {
  pickupLine: pickupLine,
  pickupWhen: pickupWhen,
  pickupSlots: pickupSlots,
  resolveForAt: resolveForAt
};
