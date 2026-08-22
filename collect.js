(function () {
  var KEY = "blanco.house.held";
  var OLD_KEY = "blanco-collection";
  var QTY_MAX = 9;
  var LINES_MAX = 12;
  var dock = document.getElementById("collect-dock");
  if (!dock) return;

  var linesEl = document.getElementById("collect-lines");
  var totalEl = document.getElementById("collect-total");
  var noteEl = document.getElementById("collect-note");
  var placeBtn = document.getElementById("collect-place");
  var letGoBtn = document.getElementById("collect-let-go");
  var clearBtn = document.getElementById("collect-clear");
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

  function lineKey(row) {
    return String((row && (row.id || row.name)) || "")
      .trim()
      .toLowerCase();
  }

  function cleanLine(row) {
    if (!row || typeof row !== "object") return null;
    var name = String(row.name || "").trim();
    var id = String(row.id || name).trim();
    var price = Number(row.price_gbp);
    var qty = Math.min(QTY_MAX, Math.max(1, Math.round(Number(row.qty) || 0)));
    if (!id || !name || !isFinite(price) || price < 0 || qty < 1) return null;
    return { id: id, name: name, price_gbp: price, qty: qty, rank: row.rank === true };
  }

  function bagQty() {
    return basket.reduce(function (sum, row) {
      return sum + (Number(row.qty) || 0);
    }, 0);
  }

  function findLine(id, name) {
    var key = String(id || name || "")
      .trim()
      .toLowerCase();
    if (!key) return null;
    for (var i = 0; i < basket.length; i++) {
      if (lineKey(basket[i]) === key) return basket[i];
    }
    return null;
  }

  function loadBasket() {
    var raw = null;
    try {
      raw = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (err) {
      raw = null;
    }
    if (!raw) {
      try {
        raw = JSON.parse(sessionStorage.getItem(OLD_KEY) || "null");
      } catch (err) {
        raw = null;
      }
    }
    var lines = [];
    var note = "";
    if (raw && Array.isArray(raw.lines)) {
      lines = raw.lines;
      note = String(raw.note || "");
    } else if (Array.isArray(raw)) {
      lines = raw;
    }
    basket = [];
    lines.forEach(function (row) {
      var next = cleanLine(row);
      if (!next) return;
      if (basket.some(function (line) {
        return lineKey(line) === lineKey(next);
      })) return;
      if (basket.length >= LINES_MAX) return;
      basket.push(next);
    });
    if (noteEl && note && !noteEl.value) noteEl.value = note.slice(0, 140);
  }

  function saveBasket() {
    var payload = JSON.stringify({
      lines: basket,
      note: noteEl ? String(noteEl.value || "").trim().slice(0, 140) : ""
    });
    try {
      if (!basket.length && !(noteEl && noteEl.value.trim())) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, payload);
      sessionStorage.removeItem(OLD_KEY);
    } catch (err) {}
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
    return !!(liveOrder && cup && cup.watching(liveOrder.status));
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
    } else if (!liveOrder || liveOrder.status === "cancelled") {
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

  function qtyButtons(index, name, qty, where) {
    var maxed = qty >= QTY_MAX ? " is-dim" : "";
    return (
      '<span class="collect-qty collect-qty-' +
      where +
      '">' +
      '<button type="button" class="collect-qty-btn" data-qty="' +
      index +
      '" data-delta="-1" aria-label="Fewer ' +
      escapeHtml(name) +
      '">−</button>' +
      "<span>" +
      qty +
      "</span>" +
      '<button type="button" class="collect-qty-btn' +
      maxed +
      '" data-qty="' +
      index +
      '" data-delta="1" aria-label="More ' +
      escapeHtml(name) +
      '">+</button>' +
      "</span>"
    );
  }

  function renderDock() {
    var watchingNow = tracking();
    var collected =
      liveOrder && liveOrder.status === "collected" && !basket.length;
    var on =
      signedIn() &&
      (basket.length > 0 || holdOpen || watchingNow || collected);
    dock.hidden = !on;
    document.body.classList.toggle("has-collection", on);
    document.body.classList.toggle("is-watching-cup", watchingNow && !basket.length);
    if (countEl) {
      countEl.textContent = watchingNow
        ? cup.line(liveOrder)
        : basket.length
          ? bagQty() + " in the bag"
          : "";
    }
    if (placeBtn) {
      if (!basket.length) {
        placeBtn.hidden = true;
        placeBtn.disabled = false;
        placeBtn.textContent = "Pay now";
      } else if (stripeChecked && !stripeOn) {
        placeBtn.hidden = false;
        placeBtn.disabled = true;
        placeBtn.textContent = "The card is not on yet";
      } else {
        placeBtn.hidden = false;
        placeBtn.disabled = false;
        placeBtn.textContent = "Pay now";
      }
    }
    if (letGoBtn) {
      letGoBtn.hidden = !(watchingNow && cup && cup.canLetGo(liveOrder));
    }
    if (clearBtn) clearBtn.hidden = !basket.length;
    if (noteEl && noteEl.parentElement) noteEl.parentElement.hidden = !basket.length;
    if (trackEl) {
      if ((watchingNow || collected) && cup) {
        trackEl.hidden = false;
        trackEl.innerHTML = cup.railHtml(liveOrder);
      } else {
        trackEl.hidden = true;
        trackEl.innerHTML = "";
      }
    }
    paintSlots();
    if (!linesEl) return;
    if (!basket.length) {
      if (watchingNow || collected) {
        linesEl.innerHTML = (liveOrder.items || [])
          .map(function (row) {
            return (
              "<li><span>" +
              escapeHtml(row.qty + " × " + row.name) +
              "</span><span></span><span>" +
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
      linesEl.innerHTML = "";
      if (totalEl) {
        totalEl.innerHTML = holdOpen
          ? '<a href="account.html">See it in your account</a>'
          : "";
      }
      return;
    }
    linesEl.innerHTML = basket
      .map(function (row, i) {
        return (
          "<li>" +
          "<span>" +
          escapeHtml(row.name) +
          (row.rank ? '<em class="collect-rank"> rank</em>' : "") +
          "</span>" +
          qtyButtons(i, row.name, row.qty, "dock") +
          "<span>" +
          formatPrice(row.price_gbp * row.qty) +
          "</span>" +
          "</li>"
        );
      })
      .join("");
    if (totalEl) {
      var rankLine = basket.some(function (row) {
        return row.rank;
      })
        ? "On the rank · "
        : "";
      totalEl.textContent = stripeOn
        ? rankLine + "Pay now · " + formatPrice(total())
        : rankLine + formatPrice(total());
    }
  }

  function paintSlots() {
    document.querySelectorAll(".menu-row").forEach(function (row) {
      if (row.classList.contains("is-sold-out")) return;
      var item = row.querySelector(".menu-item");
      var nameEl = item && item.querySelector(".name");
      if (!nameEl) return;
      var name = nameEl.textContent.trim();
      var id = (item && item.getAttribute("data-id")) || name;
      var held = findLine(id, name);
      var slot = row.querySelector(".collect-slot");
      if (!slot) return;
      if (held) {
        var index = basket.indexOf(held);
        slot.innerHTML = qtyButtons(index, name, held.qty, "board");
        return;
      }
      if (slot.querySelector(".collect-add")) return;
      slot.innerHTML = "";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "collect-add";
      btn.textContent = "Add";
      btn.setAttribute("aria-label", "Add " + name + " to collection");
      slot.appendChild(btn);
    });
  }

  function addItem(name, price, rank, id) {
    if (!signedIn()) {
      window.location.href = "account.html";
      return;
    }
    holdOpen = false;
    var key = String(id || name).trim();
    var existing = findLine(key, name);
    if (existing && existing.qty >= QTY_MAX) {
      setStatus("That’s as many as the counter will take.");
      renderDock();
      return;
    }
    if (!existing && basket.length >= LINES_MAX) {
      setStatus("The bag is full.");
      renderDock();
      return;
    }
    setStatus("");
    if (existing) existing.qty += 1;
    else {
      basket.push({
        id: key,
        name: name,
        price_gbp: price,
        qty: 1,
        rank: !!rank
      });
    }
    saveBasket();
    renderDock();
  }

  function changeQty(index, delta) {
    var row = basket[index];
    if (!row) return;
    if (delta > 0 && row.qty >= QTY_MAX) {
      setStatus("That’s as many as the counter will take.");
      return;
    }
    setStatus("");
    row.qty = Math.min(QTY_MAX, Math.max(0, row.qty + delta));
    if (row.qty < 1) basket.splice(index, 1);
    saveBasket();
    renderDock();
  }

  function bindRows() {
    document.querySelectorAll(".menu-row").forEach(function (row) {
      if (row.classList.contains("is-sold-out")) return;
      if (row.querySelector(".collect-slot")) return;
      var item = row.querySelector(".menu-item");
      var nameEl = item && item.querySelector(".name");
      var priceEl = item && item.querySelector(".price");
      if (!nameEl || !priceEl) return;
      var slot = document.createElement("div");
      slot.className = "collect-slot";
      row.appendChild(slot);
    });
    paintSlots();
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

  function clearBag() {
    basket = [];
    if (noteEl) noteEl.value = "";
    saveBasket();
    setStatus("");
    renderDock();
  }

  function place() {
    if (!basket.length) return;
    if (!stripeOn) {
      setStatus("The card is not on yet.", "error");
      return;
    }
    if (placeBtn) placeBtn.disabled = true;
    setStatus("Opening the card…");
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/orders", {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            items: basket,
            note: noteEl ? noteEl.value.trim() : "",
            pay: "stripe"
          })
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "The card could not take that.");
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
        if (placeBtn) placeBtn.disabled = false;
        setStatus("The card did not open.", "error");
      })
      .catch(function (err) {
        if (placeBtn) placeBtn.disabled = false;
        setStatus(err.message || "The card could not take that.", "error");
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
        if (next) watchLive(next);
        else renderDock();
      })
      .catch(function () {
        renderDock();
      });
  }

  dock.addEventListener("click", function (event) {
    var qtyBtn = event.target.closest("[data-qty]");
    if (!qtyBtn || !dock.contains(qtyBtn)) return;
    event.preventDefault();
    changeQty(
      parseInt(qtyBtn.getAttribute("data-qty"), 10),
      parseInt(qtyBtn.getAttribute("data-delta"), 10) || 0
    );
  });

  document.addEventListener("click", function (event) {
    var qtyBtn = event.target.closest("[data-qty]");
    if (qtyBtn && qtyBtn.closest(".collect-slot")) {
      event.preventDefault();
      event.stopPropagation();
      changeQty(
        parseInt(qtyBtn.getAttribute("data-qty"), 10),
        parseInt(qtyBtn.getAttribute("data-delta"), 10) || 0
      );
      return;
    }
    var add = event.target.closest(".collect-add");
    if (!add) return;
    var row = add.closest(".menu-row");
    if (!row || row.classList.contains("is-sold-out")) return;
    event.preventDefault();
    event.stopPropagation();
    var item = row.querySelector(".menu-item");
    var nameEl = item && item.querySelector(".name");
    var priceEl = item && item.querySelector(".price");
    if (!nameEl || !priceEl) return;
    addItem(
      nameEl.textContent.trim(),
      parsePrice(priceEl.textContent),
      !!(item && item.classList.contains("is-rank")),
      item.getAttribute("data-id")
    );
  });

  if (placeBtn) {
    placeBtn.addEventListener("click", function () {
      place();
    });
  }
  if (letGoBtn) {
    letGoBtn.addEventListener("click", letGo);
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      clearBag();
    });
  }
  if (noteEl) {
    noteEl.addEventListener("input", saveBasket);
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
