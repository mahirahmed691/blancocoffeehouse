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

  function line(order) {
    if (!order) return "";
    if (order.status === "hold") return "Waiting to pay";
    if (order.status === "in") return order.paid ? "Paid · in" : "In";
    if (order.status === "preparing") return order.paid ? "Paid · making it" : "Making it";
    if (order.status === "ready") return order.paid ? "Paid · ready for you" : "Ready for you";
    if (order.status === "collected") return "Collected";
    return "Let go";
  }

  function railHtml(order) {
    if (!order || stepIndex(order.status) < 0) return "";
    var idx = stepIndex(order.status);
    var steps = STEPS.map(function (step, i) {
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
      '<p class="cup-now">' +
      escapeHtml(headline(order)) +
      "</p>" +
      '<ol aria-label="' +
      escapeHtml(headline(order)) +
      '">' +
      steps +
      "</ol>" +
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
    railHtml: railHtml
  };
})(window);
