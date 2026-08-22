/* The house after hours. Cream on espresso. */
(function () {
  try {
    var path = String(location.pathname || "");
    var search = String(location.search || "");
    if (
      /\/go(?:\.html)?\/?$/i.test(path) ||
      /(?:^|[?&])table=1(?:&|$)/.test(search)
    ) {
      document.documentElement.classList.add("is-table");
    }
  } catch (err) {}

  var KEY = "blanco.night";
  var on = false;
  try {
    on = localStorage.getItem(KEY) === "1";
  } catch (err) {
    on = false;
  }

  function apply(next) {
    on = !!next;
    document.documentElement.toggleAttribute("data-night", on);
    document.documentElement.style.colorScheme = on ? "dark" : "light";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", on ? "#1A1412" : "#E9E1D8");
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch (err) {
      /* the phone would not keep it */
    }
    document.querySelectorAll("[data-night-toggle]").forEach(function (el) {
      el.textContent = on ? "the day." : "the night.";
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  apply(on);
  document.addEventListener("DOMContentLoaded", function () {
    apply(on);
  });

  document.addEventListener("click", function (event) {
    var el = event.target;
    if (el && el.nodeType !== 1) el = el.parentElement;
    var btn = el && el.closest("[data-night-toggle]");
    if (!btn) return;
    event.preventDefault();
    apply(!on);
  });

  window.blancoNight = {
    on: function () {
      return on;
    },
    set: apply,
    toggle: function () {
      apply(!on);
    }
  };
})();
