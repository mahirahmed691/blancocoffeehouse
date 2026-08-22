(function () {
  function supabaseConfig() {
    var url = String(window.HOUSE_SUPABASE_URL || "").replace(/\/$/, "");
    var key = String(window.HOUSE_SUPABASE_ANON_KEY || "").trim();
    if (!url || !key) return null;
    return { url: url, key: key };
  }

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

  function groupBoard(items, board) {
    var sections = [];
    var map = {};
    items
      .filter(function (item) {
        return item.board === board;
      })
      .sort(function (a, b) {
        return (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name));
      })
      .forEach(function (item) {
        var title = item.section || "The board";
        if (!map[title]) {
          map[title] = { title: title, items: [] };
          sections.push(map[title]);
        }
        map[title].items.push(item);
      });
    return sections;
  }

  function renderBoard(root, sections) {
    if (!root) return;
    root.innerHTML = sections
      .map(function (section) {
        var rows = section.items
          .map(function (item) {
            var sold = item.sold_out
              ? '<span class="sold-mark">Sold out</span>'
              : "";
            var desc = item.description
              ? '<p class="menu-item-desc">' + escapeHtml(item.description) + "</p>"
              : "";
            return (
              '<div class="menu-item' +
              (item.sold_out ? " is-sold-out" : "") +
              '">' +
              '<span class="name">' +
              escapeHtml(item.name) +
              "</span>" +
              '<span class="leader" aria-hidden="true"></span>' +
              '<span class="price">' +
              formatPrice(item.price_gbp) +
              "</span>" +
              sold +
              "</div>" +
              desc
            );
          })
          .join("");
        return (
          '<div class="board-section"><h4>' +
          escapeHtml(section.title) +
          "</h4>" +
          rows +
          "</div>"
        );
      })
      .join("");
  }

  function applyHours(settings) {
    if (!settings) return;
    var line = settings.hours_line || "";
    var days = settings.hours_days || "";
    var range = settings.hours_range || "";
    document.querySelectorAll("[data-hours-line]").forEach(function (el) {
      if (line) el.textContent = line;
    });
    document.querySelectorAll("[data-hours-days]").forEach(function (el) {
      if (days) el.textContent = days;
    });
    document.querySelectorAll("[data-hours-range]").forEach(function (el) {
      if (range) el.textContent = range;
    });
    document.querySelectorAll("[data-hours-footer]").forEach(function (el) {
      if (days && range) el.textContent = days + ", " + range;
    });
    var notice = String(settings.notice || "").trim();
    document.querySelectorAll("[data-house-notice]").forEach(function (el) {
      el.textContent = notice;
      el.hidden = !notice;
    });
    var ld = document.querySelector('script[type="application/ld+json"]');
    if (!ld || !settings.opens || !settings.closes) return;
    try {
      var data = JSON.parse(ld.textContent);
      if (data.openingHoursSpecification) {
        (Array.isArray(data.openingHoursSpecification)
          ? data.openingHoursSpecification
          : [data.openingHoursSpecification]
        ).forEach(function (spec) {
          spec.opens = String(settings.opens).slice(0, 5);
          spec.closes = String(settings.closes).slice(0, 5);
        });
        ld.textContent = JSON.stringify(data);
      }
    } catch (err) {}
  }

  function restGet(cfg, path) {
    return fetch(cfg.url + path, {
      headers: {
        apikey: cfg.key,
        Authorization: "Bearer " + cfg.key
      }
    }).then(function (res) {
      if (!res.ok) throw new Error("House data could not load");
      return res.json();
    });
  }

  var cfg = supabaseConfig();
  if (!cfg) return;

  Promise.all([
    restGet(cfg, "/rest/v1/menu_items?select=*&order=sort.asc,name.asc"),
    restGet(cfg, "/rest/v1/house_settings?id=eq.1&select=*")
  ])
    .then(function (parts) {
      var items = parts[0] || [];
      var settings = (parts[1] && parts[1][0]) || null;
      applyHours(settings);
      if (!items.length) return;
      var drinksRoot = document.querySelector("#drinks-board .board-cols");
      var sweetsRoot = document.querySelector("#sweets-board .board-cols");
      if (drinksRoot) renderBoard(drinksRoot, groupBoard(items, "drinks"));
      if (sweetsRoot) renderBoard(sweetsRoot, groupBoard(items, "sweets"));
      if (typeof window.blancoBindMenuRows === "function") {
        window.blancoBindMenuRows();
      }
    })
    .catch(function () {
      /* Printed boards stay put. */
    });
})();
