(function () {
  var root = document.getElementById("account-orders");
  if (!root) return;

  var cup = window.blancoCup;
  var poll = 0;
  var lastOrders = [];

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

  function emptyHtml(hasPast) {
    if (hasPast) {
      return (
        '<div class="empty-orders">' +
        '<p class="empty-orders-kicker">Nothing moving</p>' +
        "<p>The counter is clear. Receipts from the house sit in the book.</p>" +
        '<p><a class="btn btn-ghost" href="orders.html">Your receipts</a></p>' +
        "</div>"
      );
    }
    return (
      '<div class="empty-orders">' +
      '<p class="empty-orders-kicker">Not yet</p>' +
      "<p>Build a collection from the board. Watch it move from in, to making it, to ready.</p>" +
      '<p><a class="btn btn-ghost" href="index.html#menu">The board</a></p>' +
      '<p class="note"><a href="orders.html">receipts from the house.</a></p>' +
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

  function readyCups(orders) {
    var cups = window.blancoLastCups ? window.blancoLastCups(orders) : [];
    if (
      window.blancoLastCupsOnBoard &&
      window.blancoMenuItems &&
      window.blancoMenuItems().length
    ) {
      return window.blancoLastCupsOnBoard(cups);
    }
    return cups;
  }

  function paintLastCups(orders) {
    var wrap = document.getElementById("account-last-cups");
    var list = document.getElementById("account-last-cups-list");
    if (!wrap || !list) return;
    var cups = readyCups(orders);
    if (!cups.length) {
      wrap.hidden = true;
      list.innerHTML = "";
      return;
    }
    list.innerHTML = cups
      .map(function (cup) {
        return (
          '<button type="button" class="last-cup" data-cup="' +
          escapeHtml(cup.name) +
          '">' +
          '<span class="last-cup-name">' +
          escapeHtml(cup.name) +
          "</span>" +
          '<span class="last-cup-cue">add</span>' +
          "</button>"
        );
      })
      .join("");
    wrap.hidden = false;
  }

  function render(orders) {
    lastOrders = orders || [];
    paintLastCups(lastOrders);
    var live = (orders || []).filter(function (order) {
      return cup ? cup.watching(order.status) : false;
    });
    if (!live.length) {
      root.innerHTML = emptyHtml(
        (orders || []).some(function (order) {
          return order.status === "collected";
        })
      );
      return;
    }
    var sorted = live.slice().sort(function (a, b) {
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
        var rail =
          cup && (cup.watching(order.status) || order.status === "collected")
            ? cup.railHtml(order)
            : "";
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
        if (!root.querySelector(".account-order")) root.innerHTML = emptyHtml(false);
      });
  }

  var lastCupsList = document.getElementById("account-last-cups-list");
  if (lastCupsList) {
    lastCupsList.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-cup]");
      if (!btn || !lastCupsList.contains(btn)) return;
      event.preventDefault();
      try {
        sessionStorage.setItem(
          "blanco.house.cup",
          JSON.stringify({ name: btn.getAttribute("data-cup") || "" })
        );
      } catch (err) {}
      window.location.href = "index.html#collect";
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

  window.blancoPaintLastCups = function () {
    paintLastCups(lastOrders);
  };
  window.blancoLoadOrders = loadOrders;

  if (/[?&]paid=1(?:&|$)/.test(location.search)) {
    window.setTimeout(loadOrders, 1600);
  }
})();
