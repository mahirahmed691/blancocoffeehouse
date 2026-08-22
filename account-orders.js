(function () {
  var root = document.getElementById("account-orders");
  if (!root) return;

  var cup = window.blancoCup;
  var poll = 0;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatPrice(value) {
    var n = Number(value);
    if (!isFinite(n)) return "";
    if (Math.round(n * 100) % 100 === 0) return "£" + String(Math.round(n));
    return "£" + n.toFixed(2);
  }

  function emptyHtml() {
    return (
      '<div class="empty-orders">' +
      '<p class="empty-orders-kicker">Not yet</p>' +
      "<p>Build a collection from the board. Watch it move from in, to making it, to ready.</p>" +
      '<p><a class="btn btn-ghost" href="index.html#menu">The board</a></p>' +
      "</div>"
    );
  }

  function itemsLine(items) {
    return (items || [])
      .map(function (row) {
        return escapeHtml(row.qty + " × " + row.name);
      })
      .join(" · ");
  }

  function render(orders) {
    if (!orders || !orders.length) {
      root.innerHTML = emptyHtml();
      return;
    }
    var sorted = orders.slice().sort(function (a, b) {
      var aw = cup && cup.watching(a.status) ? 0 : 1;
      var bw = cup && cup.watching(b.status) ? 0 : 1;
      return aw - bw;
    });
    root.innerHTML = sorted
      .map(function (order) {
        var live = cup && cup.live(order.status);
        var cancel =
          (cup && cup.canLetGo
            ? cup.canLetGo(order)
            : (order.status === "in" || order.status === "hold") && !order.paid)
            ? '<button type="button" class="btn btn-ghost" data-cancel="' +
              escapeHtml(order.id) +
              '">Let go</button>'
            : order.status === "preparing" || order.status === "ready" || order.paid
              ? '<p class="account-order-note">Ask the counter if this should come off.</p>'
              : "";
        var note = order.note
          ? '<p class="account-order-note">' + escapeHtml(order.note) + "</p>"
          : "";
        var payLine = order.paid
          ? " · paid"
          : order.pay_at === "stripe"
            ? " · waiting on the card"
            : " · pay at the counter";
        var rail = live && cup ? cup.railHtml(order) : "";
        return (
          '<article class="account-order is-' +
          escapeHtml(order.status) +
          (live ? " is-live" : "") +
          '">' +
          (rail ||
            '<p class="account-order-status">' +
              escapeHtml(cup ? cup.line(order) : order.status) +
              "</p>") +
          '<p class="account-order-items">' +
          itemsLine(order.items) +
          "</p>" +
          note +
          '<p class="account-order-total">' +
          formatPrice(order.total_gbp) +
          payLine +
          "</p>" +
          cancel +
          "</article>"
        );
      })
      .join("");
  }

  async function clerkHeaders() {
    if (!window.Clerk || !Clerk.session) throw new Error("Sign in to see collections.");
    var token = await Clerk.session.getToken();
    if (!token) throw new Error("Sign in again.");
    return {
      Authorization: "Bearer " + token,
      "X-Clerk-Session": Clerk.session.id,
      "Content-Type": "application/json"
    };
  }

  function watching(orders) {
    return (orders || []).some(function (order) {
      return cup ? cup.watching(order.status) : false;
    });
  }

  function loadOrders() {
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/orders", { headers: headers });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Collections could not load.");
          return data;
        });
      })
      .then(function (data) {
        var orders = data.orders || [];
        render(orders);
        if (watching(orders) && !poll) {
          poll = window.setInterval(loadOrders, 8000);
        }
        if (!watching(orders) && poll) {
          window.clearInterval(poll);
          poll = 0;
        }
      })
      .catch(function () {
        if (!root.querySelector(".account-order")) root.innerHTML = emptyHtml();
      });
  }

  root.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-cancel]");
    if (!btn) return;
    if (!window.confirm("Let this collection go? It comes off the counter.")) return;
    btn.disabled = true;
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/orders", {
          method: "PATCH",
          headers: headers,
          body: JSON.stringify({
            id: btn.getAttribute("data-cancel"),
            status: "cancelled"
          })
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "That collection could not update.");
          return data;
        });
      })
      .then(loadOrders)
      .catch(function () {
        btn.disabled = false;
      });
  });

  window.blancoLoadOrders = loadOrders;

  if (/[?&]paid=1(?:&|$)/.test(location.search)) {
    window.setTimeout(loadOrders, 1600);
  }
})();
