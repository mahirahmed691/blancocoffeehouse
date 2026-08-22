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

  function priceOf(item) {
    var rank = Number(item.driver_price_gbp);
    if (window.blancoIsDriver && isFinite(rank) && rank >= 0 && item.driver_price_gbp !== "" && item.driver_price_gbp != null) {
      return rank;
    }
    return Number(item.price_gbp);
  }

  function onRank(item) {
    return (
      window.blancoIsDriver &&
      item.driver_price_gbp !== "" &&
      item.driver_price_gbp != null &&
      isFinite(Number(item.driver_price_gbp))
    );
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
            var rank = onRank(item)
              ? '<span class="rank-mark">rank</span>'
              : "";
            var desc = item.description
              ? '<p class="menu-item-desc">' + escapeHtml(item.description) + "</p>"
              : "";
            return (
              '<div class="menu-item' +
              (item.sold_out ? " is-sold-out" : "") +
              (onRank(item) ? " is-rank" : "") +
              '">' +
              '<span class="name">' +
              escapeHtml(item.name) +
              "</span>" +
              '<span class="leader" aria-hidden="true"></span>' +
              '<span class="price">' +
              formatPrice(priceOf(item)) +
              "</span>" +
              rank +
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

  function londonMinutes() {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23"
    }).formatToParts(new Date());
    var hour = Number(
      (parts.filter(function (part) {
        return part.type === "hour";
      })[0] || {}).value
    );
    var minute = Number(
      (parts.filter(function (part) {
        return part.type === "minute";
      })[0] || {}).value
    );
    if (!isFinite(hour) || !isFinite(minute)) return 0;
    return hour * 60 + minute;
  }

  function parseMinutes(value) {
    var match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  var PACE = {
    quiet: "quiet. seats are easy.",
    easy: "a few in. the room is easy.",
    busy: "busy. a short wait for a seat.",
    packed: "packed. takeaway is quicker."
  };

  var WAIT = {
    flowing: "the counter is flowing.",
    short: "a short wait for a cup.",
    queue: "a queue at the counter."
  };

  function londonDay(at) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(at || new Date());
  }

  function paceStale(paceAt) {
    if (!paceAt) return true;
    var at = new Date(paceAt);
    if (isNaN(at.getTime())) return true;
    return londonDay(at) !== londonDay();
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
    var openAt = parseMinutes(settings.opens);
    var closeAt = parseMinutes(settings.closes);
    var now = londonMinutes();
    var closed =
      openAt != null && closeAt != null && (now < openAt || now >= closeAt);
    var closing =
      !closed && closeAt != null && closeAt - now <= 30;
    var stale = paceStale(settings.pace_at);
    var parts = [];
    if (closing) parts.push("closing soon. last cups.");
    if (!closed && !stale) {
      var room = PACE[String(settings.how_busy || "").trim()] || "";
      var wait = WAIT[String(settings.how_wait || "").trim()] || "";
      if (room) parts.push(room);
      if (wait) parts.push(wait);
    }
    var pace = closed ? "" : parts.join(" ");
    document.querySelectorAll("[data-house-pace]").forEach(function (el) {
      el.textContent = pace;
      el.hidden = !pace;
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

  var menuItems = [];

  function paintMenu() {
    if (!menuItems.length) return;
    var drinksRoot = document.querySelector("#drinks-board .board-cols");
    var sweetsRoot = document.querySelector("#sweets-board .board-cols");
    if (drinksRoot) renderBoard(drinksRoot, groupBoard(menuItems, "drinks"));
    if (sweetsRoot) renderBoard(sweetsRoot, groupBoard(menuItems, "sweets"));
    if (typeof window.blancoBindMenuRows === "function") {
      window.blancoBindMenuRows();
    }
  }

  var cfg = supabaseConfig();
  if (!cfg) return;

  Promise.all([
    restGet(cfg, "/rest/v1/menu_items?select=*&order=sort.asc,name.asc"),
    restGet(cfg, "/rest/v1/house_settings?id=eq.1&select=*")
  ])
    .then(function (parts) {
      menuItems = parts[0] || [];
      var settings = (parts[1] && parts[1][0]) || null;
      applyHours(settings);
      paintMenu();
    })
    .catch(function () {
      /* Printed boards stay put. */
    });

  window.blancoPaintMenu = paintMenu;
})();
