(function () {
  var root = document.getElementById("account-orders");
  if (!root) return;

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

  function statusLine(order) {
    if (order.status === "hold") return "Waiting to pay";
    if (order.status === "in") return order.paid ? "Paid · at the counter" : "At the counter";
    if (order.status === "ready") return order.paid ? "Paid · ready for you" : "Ready for you";
    if (order.status === "collected") return "Collected";
    return "Let go";
  }

  function emptyHtml() {
    return (
      '<div class="empty-orders">' +
      '<p class="empty-orders-kicker">Not yet</p>' +
      "<p>Build a collection from the board. Pay now, or at the counter. Delivery is still to come.</p>" +
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
    root.innerHTML = orders
      .map(function (order) {
        var cancel =
          (order.status === "in" || order.status === "hold") && !order.paid
            ? '<button type="button" class="btn btn-ghost" data-cancel="' +
              escapeHtml(order.id) +
              '">Let go</button>'
            : "";
        var note = order.note
          ? '<p class="account-order-note">' + escapeHtml(order.note) + "</p>"
          : "";
        var payLine = order.paid
          ? " · paid"
          : order.pay_at === "stripe"
            ? " · waiting on the card"
            : " · pay at the counter";
        return (
          '<article class="account-order is-' +
          escapeHtml(order.status) +
          '">' +
          '<p class="account-order-status">' +
          statusLine(order) +
          "</p>" +
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
        render(data.orders || []);
      })
      .catch(function () {
        if (!root.querySelector(".account-order")) root.innerHTML = emptyHtml();
      });
  }

  root.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-cancel]");
    if (!btn) return;
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
