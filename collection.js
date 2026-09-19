(function (root) {
  var STEPS = [
    { id: "in", label: "in" },
    { id: "preparing", label: "making it" },
    { id: "ready", label: "ready" }
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function live(status) {
    return status === "in" || status === "preparing" || status === "ready";
  }

  function watching(status) {
    return status === "hold" || live(status);
  }

  function canLetGo(order) {
    return order && (order.status === "hold" || order.status === "in") && !order.paid;
  }

  function stepIndex(status) {
    if (status === "ready" || status === "collected") return 2;
    if (status === "preparing") return 1;
    if (status === "in") return 0;
    return -1;
  }

  function headline(order) {
    if (!order) return "";
    if (order.status === "hold") return "waiting to pay.";
    if (order.status === "in") return "the house has it.";
    if (order.status === "preparing") return "the house is making it.";
    if (order.status === "ready") return "ready for you.";
    if (order.status === "collected") return "collected.";
    return "let go.";
  }

  function padClock(n) {
    return String(n).padStart(2, "0");
  }

  function londonMinutes(at) {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23"
    }).formatToParts(at || new Date());
    var hour = Number(
      (parts.filter(function (part) {
        return part.type === "hour";
      })[0] || {}).value
    );
    var minute = Number(
      (parts.filter(function (part) {
        return part.type === "minute";
      })[0] || {}).value
    );
    if (!isFinite(hour) || !isFinite(minute)) return 0;
    return hour * 60 + minute;
  }

  function parseMinutes(value) {
    var match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function clockLabel(minutes) {
    var hour = Math.floor(minutes / 60) % 12;
    if (hour === 0) hour = 12;
    return hour + ":" + padClock(minutes % 60);
  }

  function pickupWhen(order) {
    if (!order || !order.for_at) return "";
    var at = new Date(order.for_at);
    if (isNaN(at.getTime())) return "";
    return "for " + clockLabel(londonMinutes(at));
  }

  function forLine(order) {
    var when = pickupWhen(order);
    return when ? when + "." : "when it's ready.";
  }

  function pickupSlots(hours, at) {
    var openAt = parseMinutes(hours && hours.opens);
    var closeAt = parseMinutes(hours && hours.closes);
    if (openAt == null) openAt = 11 * 60;
    if (closeAt == null) closeAt = 20 * 60;
    var now = londonMinutes(at || new Date());
    if (now >= closeAt) return [];
    var start = now < openAt ? openAt : Math.ceil((now + 1) / 15) * 15;
    var out = [];
    for (var m = start; m < closeAt; m += 15) {
      out.push({
        minutes: m,
        hm: padClock(Math.floor(m / 60)) + ":" + padClock(m % 60),
        label: clockLabel(m),
        line: "for " + clockLabel(m) + "."
      });
    }
    return out;
  }

  function line(order) {
    if (!order) return "";
    var when = pickupWhen(order);
    var tail = when ? " · " + when : "";
    if (order.status === "hold") return "Waiting to pay" + tail;
    if (order.status === "in") return (order.paid ? "Paid · in" : "In") + tail;
    if (order.status === "preparing") return (order.paid ? "Paid · making it" : "Making it") + tail;
    if (order.status === "ready") return (order.paid ? "Paid · ready for you" : "Ready for you") + tail;
    if (order.status === "collected") return "Collected" + tail;
    return "Let go";
  }

  function brewKind(status) {
    if (status === "preparing") return "preparing";
    if (status === "ready" || status === "collected") return "ready";
    if (status === "in") return "in";
    return "hold";
  }

  function brewHtml(status) {
    var kind = brewKind(status);
    var still = status === "hold" || status === "collected" ? " is-still" : "";
    return (
      '<div class="cup-brew is-' +
      kind +
      still +
      '" aria-hidden="true">' +
      '<div class="cup-brew-steam"><span></span><span></span><span></span></div>' +
      '<div class="cup-brew-spout"></div>' +
      '<div class="cup-brew-pour"><i></i><i></i></div>' +
      '<div class="cup-brew-body">' +
      '<div class="cup-brew-bowl"><div class="cup-brew-fill"><span class="cup-brew-crema"></span></div></div>' +
      '<div class="cup-brew-handle"></div>' +
      "</div>" +
      '<div class="cup-brew-saucer"></div>' +
      "</div>"
    );
  }

  function railHtml(order) {
    if (!order) return "";
    if (!watching(order.status) && order.status !== "collected") return "";
    var idx = stepIndex(order.status);
    var steps =
      idx < 0
        ? ""
        : STEPS.map(function (step, i) {
            var state = i < idx ? "is-done" : i === idx ? "is-now" : "";
            return (
              '<li class="' +
              state +
              '">' +
              '<span class="cup-dot" aria-hidden="true"></span>' +
              '<span class="cup-step">' +
              escapeHtml(step.label) +
              "</span>" +
              "</li>"
            );
          }).join("");
    return (
      '<div class="cup-rail is-' +
      escapeHtml(order.status) +
      '">' +
      '<div class="cup-head">' +
      brewHtml(order.status) +
      '<div class="cup-copy">' +
      '<p class="cup-now">' +
      escapeHtml(headline(order)) +
      "</p>" +
      '<p class="cup-for">' +
      escapeHtml(forLine(order)) +
      "</p>" +
      "</div></div>" +
      (steps
        ? '<ol aria-label="' +
          escapeHtml(headline(order)) +
          '">' +
          steps +
          "</ol>"
        : "") +
      "</div>"
    );
  }

  root.blancoCup = {
    STEPS: STEPS,
    live: live,
    watching: watching,
    canLetGo: canLetGo,
    headline: headline,
    line: line,
    forLine: forLine,
    pickupSlots: pickupSlots,
    railHtml: railHtml
  };
})(window);
