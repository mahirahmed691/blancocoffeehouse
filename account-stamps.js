(function () {
  var row = document.getElementById("account-stamps");
  var note = document.querySelector("[data-stamps-note]");
  if (!row) return;

  function paint(stamps, cardsDone) {
    var n = Number(stamps) || 0;
    row.querySelectorAll("li").forEach(function (li, i) {
      li.classList.toggle("is-stamped", i < n);
    });
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

  async function loadStamps() {
    if (!window.Clerk || !Clerk.session) return;
    var token = await Clerk.session.getToken();
    if (!token) return;
    var res = await fetch("/api/stamps", {
      headers: {
        Authorization: "Bearer " + token,
        "X-Clerk-Session": Clerk.session.id
      }
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) return;
    paint(data.stamps, data.cards_done);
  }

  async function redeemFromQuery() {
    var token = "";
    try {
      token = new URL(window.location.href).searchParams.get("t") || "";
    } catch (err) {}
    token = token.trim();
    if (!token || !window.Clerk || !Clerk.session) return;
    var jwt = await Clerk.session.getToken();
    if (!jwt) return;
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
    if (res.ok) paint(data.stamps, data.cards_done);
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete("t");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (err) {}
    if (note && !res.ok && data.error) note.textContent = data.error;
  }

  window.blancoLoadStamps = function () {
    return loadStamps().then(function () {
      if (typeof window.blancoLoadStampRedeem === "function") return;
      return redeemFromQuery();
    });
  };
})();
