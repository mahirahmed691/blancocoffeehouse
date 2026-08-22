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

  window.blancoLoadStamps = loadStamps;
})();
