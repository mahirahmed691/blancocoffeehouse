(function () {
  var card = document.getElementById("account-rank");
  var form = document.getElementById("rank-join");
  var codeEl = document.getElementById("rank-code");
  var statusEl = document.getElementById("rank-status");
  var listEl = document.getElementById("rank-items");
  var joinBtn = document.getElementById("rank-join-btn");

  function formatPrice(value) {
    var n = Number(value);
    if (!isFinite(n)) return "";
    if (Math.round(n * 100) % 100 === 0) return "£" + String(Math.round(n));
    return "£" + n.toFixed(2);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setDriver(on) {
    window.blancoIsDriver = !!on;
    document.body.classList.toggle("is-driver", !!on);
    if (typeof window.blancoPaintMenu === "function") {
      window.blancoPaintMenu();
    }
    if (typeof window.blancoRenderCollection === "function") {
      window.blancoRenderCollection();
    }
  }

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.classList.toggle("is-error", kind === "error");
  }

  function paint(data) {
    var on = !!(data && data.driver);
    setDriver(on);
    if (!card) return;
    card.classList.toggle("is-on", on);
    if (form) form.hidden = on;
    if (listEl) {
      if (on && data.items && data.items.length) {
        listEl.innerHTML = data.items
          .map(function (item) {
            return (
              "<li><span>" +
              escapeHtml(item.name) +
              "</span><span>" +
              formatPrice(item.price_gbp) +
              "</span></li>"
            );
          })
          .join("");
      } else {
        listEl.innerHTML = "";
      }
    }
    if (on) {
      setStatus("You're on the rank. Selected drinks sit at the concession.");
    } else if (data && data.paused) {
      setStatus("Ask the desk to put you back on the rank.", "error");
    } else if (statusEl && !statusEl.classList.contains("is-error")) {
      setStatus("Ask at the counter, or at the taxi office, for the house code.");
    }
  }

  async function clerkHeaders() {
    if (!window.Clerk || !Clerk.session) throw new Error("Sign in to join the rank.");
    var token = await Clerk.session.getToken();
    if (!token) throw new Error("Sign in again to join the rank.");
    return {
      Authorization: "Bearer " + token,
      "X-Clerk-Session": Clerk.session.id,
      "Content-Type": "application/json"
    };
  }

  async function loadRank() {
    if (!window.Clerk || !Clerk.session) {
      setDriver(false);
      return;
    }
    try {
      var headers = await clerkHeaders();
      var res = await fetch("/api/drivers", { headers: headers });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || "The rank could not open.");
      paint(data);
    } catch (err) {
      setDriver(false);
      if (card) setStatus(err.message || "The rank could not open.", "error");
    }
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!codeEl) return;
      if (joinBtn) joinBtn.disabled = true;
      setStatus("Joining the rank…");
      clerkHeaders()
        .then(function (headers) {
          return fetch("/api/drivers", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ action: "join", code: codeEl.value })
          });
        })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || "That code is not for the rank.");
            return data;
          });
        })
        .then(function (data) {
          if (joinBtn) joinBtn.disabled = false;
          if (codeEl) codeEl.value = "";
          paint(data);
        })
        .catch(function (err) {
          if (joinBtn) joinBtn.disabled = false;
          setStatus(err.message || "That code is not for the rank.", "error");
        });
    });
  }

  window.blancoLoadRank = loadRank;
})();
