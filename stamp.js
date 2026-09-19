(function () {
  function tokenFromHref(href) {
    try {
      var url = new URL(href, window.location.href);
      var fromQuery = url.searchParams.get("t") || "";
      if (fromQuery) return fromQuery.trim();
      if (url.hash && url.hash.indexOf("t=") !== -1) {
        return new URLSearchParams(url.hash.replace(/^#/, "")).get("t") || "";
      }
    } catch (err) {}
    return "";
  }

  function paint(stamps, cardsDone) {
    var row = document.getElementById("account-stamps");
    var note = document.querySelector("[data-stamps-note]");
    var n = Number(stamps) || 0;
    if (row) {
      row.querySelectorAll("li").forEach(function (li, i) {
        li.classList.toggle("is-stamped", i < n);
      });
    }
    if (!note) return;
    if (n === 0 && cardsDone) {
      note.textContent =
        cardsDone === 1
          ? "A drink on the house, then a new card."
          : cardsDone + " drinks on the house so far.";
      return;
    }
    if (!n) {
      note.textContent = "Eight stamps. A drink on the house.";
      return;
    }
    note.textContent = n + " of 8. A drink on the house at eight.";
  }

  function setStatus(text, kind) {
    var el = document.getElementById("stamp-redeem-status");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-error", kind === "error");
  }

  function stripToken() {
    try {
      var url = new URL(window.location.href);
      if (!url.searchParams.has("t")) return;
      url.searchParams.delete("t");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (err) {}
  }

  async function redeem(token) {
    if (!window.Clerk || !Clerk.session) return;
    var jwt = await Clerk.session.getToken();
    if (!jwt) return;
    setStatus("taking the stamp…");
    var res = await fetch("/api/stamps", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + jwt,
        "X-Clerk-Session": Clerk.session.id,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token: token })
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      setStatus(data.error || "the stamp could not land.", "error");
      if (typeof window.blancoLoadStamps === "function") window.blancoLoadStamps();
      return;
    }
    paint(data.stamps, data.cards_done);
    setStatus(
      data.filled
        ? "a drink on the house. the card starts again."
        : "a stamp from the house."
    );
    stripToken();
    if (typeof window.blancoLoadStamps === "function") window.blancoLoadStamps();
  }

  async function loadAndMaybeRedeem() {
    var token = tokenFromHref(window.location.href);
    if (typeof window.blancoLoadStamps === "function") {
      await window.blancoLoadStamps();
    }
    if (!token) {
      if (window.Clerk && Clerk.session) setStatus("");
      return;
    }
    if (!window.Clerk || !Clerk.session) {
      setStatus("sign in to take the stamp.");
      return;
    }
    await redeem(token);
  }

  window.blancoLoadStampRedeem = loadAndMaybeRedeem;
  window.blancoStampTokenFromHref = tokenFromHref;
})();
