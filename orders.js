(function () {
  var list = document.getElementById("orders-list");
  var sheet = document.getElementById("orders-receipt");
  var book = document.getElementById("orders-book");
  if (!list || !sheet) return;

  var cup = window.blancoCup;
  var last = [];

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

  function shortId(id) {
    return String(id || "")
      .replace(/-/g, "")
      .slice(0, 8);
  }

  function whenOf(order) {
    var raw = (order && order.created_at) || (order && order.for_at);
    if (!raw) return "";
    var at = new Date(raw);
    if (isNaN(at.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(at);
  }

  function itemsLine(items) {
    return (items || [])
      .map(function (row) {
        return escapeHtml(row.qty + " × " + row.name);
      })
      .join(" · ");
  }

  function past(orders) {
    return (orders || []).filter(function (order) {
      return order.status === "collected";
    });
  }

  function moving(orders) {
    return (orders || []).some(function (order) {
      return cup ? cup.watching(order.status) : false;
    });
  }

  function emptyHtml() {
    return (
      '<div class="empty-orders">' +
      '<p class="empty-orders-kicker">Not yet</p>' +
      "<p>Pay a collection from the board. When you take it, the receipt sits here.</p>" +
      '<p><a class="btn btn-ghost" href="index.html#menu">The board</a></p>' +
      "</div>"
    );
  }

  function wantedId() {
    try {
      var fromQuery = new URLSearchParams(location.search).get("id") || "";
      if (fromQuery) return fromQuery.trim();
    } catch (err) {}
    return String(location.hash || "")
      .replace(/^#/, "")
      .trim();
  }

  function setWanted(id) {
    var next = id
      ? location.pathname + "?id=" + encodeURIComponent(id)
      : location.pathname;
    if (location.pathname + location.search !== next) {
      try {
        history.replaceState(null, "", next);
      } catch (err) {}
    }
  }

  function paintList(orders) {
    var rows = past(orders);
    var note = document.getElementById("orders-live-note");
    if (note) note.hidden = !moving(orders);
    if (!rows.length) {
      list.innerHTML = emptyHtml();
      return;
    }
    list.innerHTML = rows
      .map(function (order) {
        var when = whenOf(order);
        return (
          '<button type="button" class="history-order" data-receipt="' +
          escapeHtml(order.id) +
          '">' +
          '<span class="history-order-when">' +
          escapeHtml(when || "collected.") +
          "</span>" +
          '<span class="history-order-items">' +
          itemsLine(order.items) +
          "</span>" +
          '<span class="history-order-total">' +
          escapeHtml(formatPrice(order.total_gbp)) +
          (order.paid ? " · paid" : "") +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function paintReceipt(order) {
    if (!order) {
      document.body.classList.remove("is-receipt");
      sheet.hidden = true;
      if (book) book.hidden = false;
      var welcome = document.querySelector(".account-welcome");
      if (welcome) welcome.hidden = false;
      setWanted("");
      return;
    }
    document.body.classList.add("is-receipt");
    if (book) book.hidden = true;
    var welcome = document.querySelector(".account-welcome");
    if (welcome) welcome.hidden = true;
    sheet.hidden = false;
    document.getElementById("receipt-when").textContent = whenOf(order);
    document.getElementById("receipt-total").textContent = formatPrice(order.total_gbp);
    document.getElementById("receipt-paid").textContent = order.paid
      ? order.status === "collected"
        ? "paid · collected."
        : "paid."
      : "collected.";
    document.getElementById("receipt-id").textContent = shortId(order.id);
    var note = document.getElementById("receipt-note");
    if (order.note) {
      note.hidden = false;
      note.textContent = order.note;
    } else {
      note.hidden = true;
      note.textContent = "";
    }
    document.getElementById("receipt-lines").innerHTML = (order.items || [])
      .map(function (row) {
        var qty = Number(row.qty) || 1;
        var price = formatPrice((Number(row.price_gbp) || 0) * qty);
        return (
          "<li class=\"receipt-line\">" +
          '<span class="name">' +
          escapeHtml(qty + " × " + row.name) +
          "</span>" +
          '<span class="leader" aria-hidden="true"></span>' +
          '<span class="price">' +
          escapeHtml(price) +
          "</span>" +
          "</li>"
        );
      })
      .join("");
    var card = document.getElementById("receipt-card");
    if (order.receipt_url) {
      card.hidden = false;
      card.href = order.receipt_url;
    } else {
      card.hidden = true;
      card.removeAttribute("href");
    }
    setWanted(order.id);
    try {
      sheet.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {}
  }

  function findOrder(id) {
    var i;
    for (i = 0; i < last.length; i++) {
      if (last[i].id === id) return last[i];
    }
    return null;
  }

  async function clerkHeaders() {
    if (!window.Clerk || !Clerk.session) throw new Error("Sign in to see receipts.");
    var token = await Clerk.session.getToken();
    if (!token) throw new Error("Sign in again.");
    return {
      Authorization: "Bearer " + token,
      "X-Clerk-Session": Clerk.session.id,
      "Content-Type": "application/json"
    };
  }

  function openReceipt(id) {
    var known = findOrder(id);
    if (known) paintReceipt(known);
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/orders?id=" + encodeURIComponent(id), { headers: headers });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "That receipt is gone.");
          return data.order;
        });
      })
      .then(function (order) {
        if (!order || order.status === "cancelled") throw new Error("gone");
        paintReceipt(order);
      })
      .catch(function () {
        if (!known) paintReceipt(null);
      });
  }

  function loadOrders() {
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/orders", { headers: headers });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Receipts could not load.");
          return data;
        });
      })
      .then(function (data) {
        last = data.orders || [];
        paintList(last);
        var id = wantedId();
        if (id) openReceipt(id);
      })
      .catch(function () {
        if (!list.querySelector(".history-order")) list.innerHTML = emptyHtml();
      });
  }

  list.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-receipt]");
    if (!btn || !list.contains(btn)) return;
    openReceipt(btn.getAttribute("data-receipt") || "");
  });

  var closeBtn = document.getElementById("receipt-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      paintReceipt(null);
    });
  }

  var printBtn = document.getElementById("receipt-print");
  if (printBtn) {
    printBtn.addEventListener("click", function () {
      window.print();
    });
  }

  window.blancoLoadOrders = loadOrders;
})();
