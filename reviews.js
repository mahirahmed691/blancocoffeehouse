(function () {
  var root = document.querySelector("[data-reviews]");
  if (!root) return;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatCount(n) {
    var num = Number(n);
    if (!isFinite(num) || num < 1) return "";
    return String(Math.round(num));
  }

  function formatRating(n) {
    var num = Number(n);
    if (!isFinite(num) || num <= 0) return "";
    return num % 1 === 0 ? String(num) + ".0" : String(num);
  }

  function renderList(list, reviews) {
    if (!list || !reviews || !reviews.length) return;
    list.innerHTML = reviews
      .slice(0, 3)
      .map(function (row, index) {
        var who = escapeHtml(row.author || "Guest");
        var when = escapeHtml(row.relativeTime || "");
        var text = escapeHtml(row.text || "");
        var meta = when ? who + ", " + when : who;
        return (
          '<li class="review-quote' +
          (index === 0 ? " is-featured" : "") +
          '">' +
          "<blockquote>" +
          "<p>" +
          text +
          "</p>" +
          "</blockquote>" +
          "<cite>" +
          meta +
          " · Google</cite>" +
          "</li>"
        );
      })
      .join("");
  }

  function apply(data) {
    if (!data) return;
    var ratingEl = root.querySelector("[data-reviews-rating]");
    var countEl = root.querySelector("[data-reviews-count]");
    var list = root.querySelector("[data-reviews-list]");
    var rating = formatRating(data.rating);
    var count = formatCount(data.count);
    if (ratingEl && rating) ratingEl.textContent = rating;
    if (countEl && count) countEl.textContent = count;
    renderList(list, data.reviews);
  }

  function load(url) {
    return fetch(url, { headers: { Accept: "application/json" } }).then(
      function (res) {
        if (!res.ok) throw new Error("bad status");
        return res.json();
      }
    );
  }

  load("/api/reviews")
    .catch(function () {
      return load("reviews.json");
    })
    .then(apply)
    .catch(function () {});
})();
