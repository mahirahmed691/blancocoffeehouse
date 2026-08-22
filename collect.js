(function () {
  var KEY = "blanco-collection";
  var dock = document.getElementById("collect-dock");
  if (!dock) return;

  var linesEl = document.getElementById("collect-lines");
  var totalEl = document.getElementById("collect-total");
  var noteEl = document.getElementById("collect-note");
  var placeBtn = document.getElementById("collect-place");
  var counterBtn = document.getElementById("collect-counter");
  var letGoBtn = document.getElementById("collect-let-go");
  var statusEl = document.getElementById("collect-status");
  var countEl = document.getElementById("collect-count");
  var trackEl = document.getElementById("collect-track");
  var cup = window.blancoCup;
  var basket = [];
  var holdOpen = false;
  var holdTimer = 0;
  var liveOrder = null;
  var liveTimer = 0;
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

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.classList.toggle("is-error", kind === "error");
  }

  function tracking() {
    return !!(liveOrder && cup && cup.watching(liveOrder.status) && !basket.length);
  }

  function stopLive() {
    if (liveTimer) window.clearInterval(liveTimer);
    liveTimer = 0;
  }

  function watchLive(order) {
    liveOrder = order || null;
    stopLive();
    if (liveOrder && cup && cup.watching(liveOrder.status)) {
      liveTimer = window.setInterval(refreshLive, 8000);
      renderDock();
      return;
    }
    if (liveOrder && liveOrder.status === "collected") {
      holdOpen = true;
      if (holdTimer) window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(function () {
        liveOrder = null;
        holdOpen = false;
        renderDock();
      }, 6000);
    } else {
      liveOrder = null;
    }
    renderDock();
  }

  function refreshLive() {
    if (!signedIn()) return;
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/orders", { headers: headers });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error("skip");
          return data;
        });
      })
      .then(function (data) {
        stripeOn = !!data.stripe;
        stripeChecked = true;
        var orders = data.orders || [];
        var next =
          (liveOrder &&
            orders.filter(function (row) {
              return row.id === liveOrder.id;
            })[0]) ||
          orders.filter(function (row) {
            return cup && cup.watching(row.status);
          })[0] ||
          null;
        watchLive(next);
      })
      .catch(function () {});
  }

  function renderDock() {
    var on = signedIn() && (basket.length > 0 || holdOpen || tracking() || (liveOrder && liveOrder.status === "collected"));
    dock.hidden = !on;
    document.body.classList.toggle("has-collection", on);
    document.body.classList.toggle("is-watching-cup", tracking() || (liveOrder && liveOrder.status === "collected" && !basket.length));
    if (countEl) {
      countEl.textContent =
        tracking() || (liveOrder && liveOrder.status === "collected")
          ? cup.line(liveOrder)
          : "";
    }
    if (placeBtn) {
      placeBtn.hidden = !basket.length;
      placeBtn.textContent = stripeOn ? "Pay now" : "Place for collection";
    }
    if (counterBtn) counterBtn.hidden = !basket.length || !stripeOn;
    if (letGoBtn) {
      letGoBtn.hidden = !(tracking() && cup && cup.canLetGo(liveOrder) && !basket.length);
    }
    if (noteEl && noteEl.parentElement) noteEl.parentElement.hidden = !basket.length;
    if (trackEl) {
      if ((tracking() || (liveOrder && liveOrder.status === "collected")) && cup && !basket.length) {
        trackEl.hidden = false;
        trackEl.innerHTML = cup.railHtml(liveOrder);
      } else {
        trackEl.hidden = true;
        trackEl.innerHTML = "";
      }
    }
    if (!linesEl) return;
    if (tracking() || (liveOrder && liveOrder.status === "collected" && !basket.length)) {
      linesEl.innerHTML = (liveOrder.items || [])
        .map(function (row) {
          return (
            "<li><span>" +
            escapeHtml(row.qty + " × " + row.name) +
            "</span><span>" +
            formatPrice(row.price_gbp * row.qty) +
            "</span></li>"
          );
        })
        .join("");
      if (totalEl) {
        totalEl.innerHTML =
          liveOrder.status === "ready"
            ? "Come to the counter."
            : liveOrder.status === "collected"
              ? '<a href="account.html">See it in your account</a>'
              : liveOrder.paid
                ? "Paid."
                : "Pay when you collect.";
      }
      return;
    }
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
    liveOrder = null;
    stopLive();
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

  function letGo() {
    if (!liveOrder || !cup || !cup.canLetGo(liveOrder)) return;
    if (!window.confirm("Let this collection go? It comes off the counter.")) return;
    if (letGoBtn) letGoBtn.disabled = true;
    setStatus("Letting this go…");
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/orders", {
          method: "PATCH",
          headers: headers,
          body: JSON.stringify({
            id: liveOrder.id,
            status: "cancelled"
          })
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "That collection could not come off.");
          return data;
        });
      })
      .then(function () {
        if (letGoBtn) letGoBtn.disabled = false;
        liveOrder = null;
        stopLive();
        setStatus("Let go. Add another from the board if you like.");
        renderDock();
      })
      .catch(function (err) {
        if (letGoBtn) letGoBtn.disabled = false;
        setStatus(err.message || "That collection could not come off.", "error");
      });
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
        setStatus("");
        watchLive(data.order);
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
      liveOrder = null;
      stopLive();
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
          return data;
        });
      })
      .then(function (data) {
        stripeOn = !!data.stripe;
        stripeChecked = true;
        var next = (data.orders || []).filter(function (row) {
          return cup && cup.watching(row.status);
        })[0];
        if (next && !basket.length) watchLive(next);
        else renderDock();
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
  if (letGoBtn) {
    letGoBtn.addEventListener("click", letGo);
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
  window.blancoOpenCollect = function () {
    holdOpen = true;
    renderDock();
    if (dock && !dock.hidden) {
      dock.scrollIntoView({ block: "end" });
    }
  };
  if (location.hash === "#collect") {
    window.setTimeout(function () {
      window.blancoOpenCollect();
    }, 250);
  }
  window.addEventListener("hashchange", function () {
    if (location.hash === "#collect") window.blancoOpenCollect();
  });
  loadPayOptions();
})();
