(function () {
  var KEY = "blanco-collection";
  var dock = document.getElementById("collect-dock");
  if (!dock) return;

  var linesEl = document.getElementById("collect-lines");
  var totalEl = document.getElementById("collect-total");
  var noteEl = document.getElementById("collect-note");
  var placeBtn = document.getElementById("collect-place");
  var counterBtn = document.getElementById("collect-counter");
  var statusEl = document.getElementById("collect-status");
  var countEl = document.getElementById("collect-count");
  var basket = [];
  var holdOpen = false;
  var holdTimer = 0;
  var stripeOn = false;
  var stripeChecked = false;

  function signedIn() {
    if (!window.Clerk) return false;
    if (typeof Clerk.isSignedIn === "boolean") return Clerk.isSignedIn;
    return !!(Clerk.user || Clerk.session);
  }

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

  function parsePrice(text) {
    var n = Number(String(text || "").replace(/[^\d.]/g, ""));
    return isFinite(n) ? n : 0;
  }

  function loadBasket() {
    try {
      basket = JSON.parse(sessionStorage.getItem(KEY) || "[]");
      if (!Array.isArray(basket)) basket = [];
    } catch (err) {
      basket = [];
    }
    if (basket.length > 1) basket = [basket[basket.length - 1]];
    if (basket[0]) basket[0].qty = 1;
  }

  function saveBasket() {
    sessionStorage.setItem(KEY, JSON.stringify(basket));
  }

  function total() {
    return basket.reduce(function (sum, row) {
      return sum + row.price_gbp * row.qty;
    }, 0);
  }

  function count() {
    return basket.reduce(function (sum, row) {
      return sum + row.qty;
    }, 0);
  }

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.classList.toggle("is-error", kind === "error");
  }

  function renderDock() {
    var on = signedIn() && (basket.length > 0 || holdOpen);
    dock.hidden = !on;
    document.body.classList.toggle("has-collection", on);
    if (countEl) countEl.textContent = "";
    if (placeBtn) {
      placeBtn.hidden = !basket.length;
      placeBtn.textContent = stripeOn ? "Pay now" : "Place for collection";
    }
    if (counterBtn) counterBtn.hidden = !basket.length || !stripeOn;
    if (noteEl && noteEl.parentElement) noteEl.parentElement.hidden = !basket.length;
    if (!linesEl) return;
    if (!basket.length) {
      linesEl.innerHTML = "";
      if (totalEl) {
        totalEl.innerHTML = holdOpen
          ? '<a href="account.html">See it in your account</a>'
          : "";
      }
      return;
    }
    var row = basket[0];
    linesEl.innerHTML =
      "<li>" +
      "<span>" +
      escapeHtml(row.name) +
      "</span>" +
      "<span>" +
      formatPrice(row.price_gbp) +
      "</span>" +
      '<button type="button" class="collect-remove" data-remove="0">Remove</button>' +
      "</li>";
    if (totalEl) {
      var rankLine = basket[0] && basket[0].rank ? "On the rank · " : "";
      totalEl.textContent = stripeOn
        ? rankLine + "Pay now, or at the counter · " + formatPrice(total())
        : rankLine + "Pay at the counter · " + formatPrice(total());
    }
  }

  function addItem(name, price, rank) {
    if (!signedIn()) {
      window.location.href = "account.html";
      return;
    }
    holdOpen = false;
    if (holdTimer) window.clearTimeout(holdTimer);
    var current = basket[0];
    if (current && current.name === name && current.price_gbp === price) {
      setStatus(rank ? "That’s already on the rank." : "That’s already for collection.");
      renderDock();
      return;
    }
    basket = [{ name: name, price_gbp: price, qty: 1, rank: !!rank }];
    saveBasket();
    setStatus(
      current
        ? "That’s the one. Added " + name + (rank ? " on the rank." : ".")
        : "Added " + name + (rank ? " on the rank." : ".")
    );
    renderDock();
  }

  function bindRows() {
    document.querySelectorAll(".menu-row").forEach(function (row) {
      if (row.querySelector(".collect-add")) return;
      if (row.classList.contains("is-sold-out")) return;
      var item = row.querySelector(".menu-item");
      var nameEl = item && item.querySelector(".name");
      var priceEl = item && item.querySelector(".price");
      if (!nameEl || !priceEl) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "collect-add";
      btn.textContent = "Add";
      btn.setAttribute("aria-label", "Add " + nameEl.textContent.trim() + " to collection");
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        addItem(
          nameEl.textContent.trim(),
          parsePrice(priceEl.textContent),
          !!(item && item.classList.contains("is-rank"))
        );
      });
      row.appendChild(btn);
    });
  }

  async function clerkHeaders() {
    if (!window.Clerk || !Clerk.session) throw new Error("Sign in to collect.");
    var token = await Clerk.session.getToken();
    if (!token) throw new Error("Sign in again to collect.");
    return {
      Authorization: "Bearer " + token,
      "X-Clerk-Session": Clerk.session.id,
      "Content-Type": "application/json"
    };
  }

  function place(pay) {
    if (!basket.length) return;
    if (placeBtn) placeBtn.disabled = true;
    if (counterBtn) counterBtn.disabled = true;
    setStatus(pay === "stripe" ? "Opening the card…" : "Sending to the counter…");
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/orders", {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            items: basket,
            note: noteEl ? noteEl.value.trim() : "",
            pay: pay === "stripe" ? "stripe" : "counter"
          })
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "The counter could not take that.");
          return data;
        });
      })
      .then(function (data) {
        if (data.url) {
          basket = [];
          saveBasket();
          window.location.href = data.url;
          return;
        }
        basket = [];
        saveBasket();
        if (noteEl) noteEl.value = "";
        if (placeBtn) placeBtn.disabled = false;
        if (counterBtn) counterBtn.disabled = false;
        holdOpen = true;
        if (holdTimer) window.clearTimeout(holdTimer);
        holdTimer = window.setTimeout(function () {
          holdOpen = false;
          renderDock();
        }, 8000);
        setStatus("At the counter. Pay when you collect.");
        renderDock();
      })
      .catch(function (err) {
        if (placeBtn) placeBtn.disabled = false;
        if (counterBtn) counterBtn.disabled = false;
        setStatus(err.message || "The counter could not take that.", "error");
      });
  }

  function loadPayOptions() {
    if (!signedIn()) {
      stripeOn = false;
      stripeChecked = false;
      renderDock();
      return;
    }
    if (stripeChecked) {
      renderDock();
      return;
    }
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/orders", { headers: headers });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error("skip");
          stripeOn = !!data.stripe;
          stripeChecked = true;
          renderDock();
        });
      })
      .catch(function () {
        renderDock();
      });
  }

  if (linesEl) {
    linesEl.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-remove]");
      if (!btn) return;
      var index = parseInt(btn.getAttribute("data-remove"), 10);
      basket.splice(index, 1);
      saveBasket();
      renderDock();
    });
  }
  if (placeBtn) {
    placeBtn.addEventListener("click", function () {
      place(stripeOn ? "stripe" : "counter");
    });
  }
  if (counterBtn) {
    counterBtn.addEventListener("click", function () {
      place("counter");
    });
  }

  var prevBind = window.blancoBindMenuRows;
  window.blancoBindMenuRows = function () {
    if (typeof prevBind === "function") prevBind();
    bindRows();
  };

  loadBasket();
  bindRows();
  renderDock();
  window.blancoRenderCollection = function () {
    renderDock();
    loadPayOptions();
  };
  loadPayOptions();
})();
