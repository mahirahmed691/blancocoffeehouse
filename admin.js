(function () {
  var form = document.getElementById("admin-form");
  if (!form) return;

  var denied = document.getElementById("admin-denied");
  var desk = document.getElementById("admin-desk");
  var statusEl = document.getElementById("admin-status");
  var drinksRoot = document.getElementById("admin-board-drinks");
  var sweetsRoot = document.getElementById("admin-board-sweets");
  var sectionList = document.getElementById("admin-sections");

  var items = [];
  var deletedIds = [];
  var loaded = false;

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.classList.toggle("is-error", kind === "error");
  }

  function uid() {
    return "new-" + Math.random().toString(36).slice(2, 10);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isSignedIn() {
    if (!window.Clerk) return false;
    if (typeof Clerk.isSignedIn === "boolean") return Clerk.isSignedIn;
    return !!(Clerk.user || Clerk.session);
  }

  function showPanels() {
    var inSession = isSignedIn();
    var admin = typeof window.blancoIsAdmin === "function" && window.blancoIsAdmin();
    if (denied) denied.hidden = !(inSession && !admin);
    if (desk) desk.hidden = !(inSession && admin);
    if (inSession && admin && !loaded) loadDesk();
  }

  async function clerkHeaders() {
    if (!window.Clerk || !Clerk.session) throw new Error("Sign in to use the house desk.");
    var token = await Clerk.session.getToken();
    return {
      Authorization: "Bearer " + token,
      "X-Clerk-Session": Clerk.session.id,
      "Content-Type": "application/json"
    };
  }

  function group(board) {
    var sections = [];
    var map = {};
    items
      .filter(function (item) {
        return item.board === board;
      })
      .sort(function (a, b) {
        return (a.sort || 0) - (b.sort || 0);
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

  function fillHours(settings) {
    if (!settings) return;
    var line = document.getElementById("hours-line");
    var days = document.getElementById("hours-days");
    var range = document.getElementById("hours-range");
    var opens = document.getElementById("hours-opens");
    var closes = document.getElementById("hours-closes");
    if (line) line.value = settings.hours_line || "";
    if (days) days.value = settings.hours_days || "";
    if (range) range.value = settings.hours_range || "";
    if (opens) opens.value = String(settings.opens || "11:00").slice(0, 5);
    if (closes) closes.value = String(settings.closes || "20:00").slice(0, 5);
  }

  function renderBoard(root, board) {
    if (!root) return;
    var sections = group(board);
    root.innerHTML = sections
      .map(function (section) {
        var rows = section.items
          .map(function (item) {
            return (
              '<article class="admin-item" data-id="' +
              item._key +
              '">' +
              '<div class="admin-item-top">' +
              '<label>Name<input data-field="name" type="text" maxlength="80" value=""></label>' +
              '<label>Price<input data-field="price_gbp" type="number" min="0" step="0.01"></label>' +
              '<label class="admin-sold"><input data-field="sold_out" type="checkbox"> Sold out</label>' +
              '<button type="button" class="admin-remove" data-remove>Remove</button>' +
              "</div>" +
              '<label>Description<textarea data-field="description" rows="2" maxlength="280"></textarea></label>' +
              "</article>"
            );
          })
          .join("");
        return (
          '<section class="account-card admin-section">' +
          "<h2>" +
          escapeHtml(section.title) +
          "</h2>" +
          rows +
          "</section>"
        );
      })
      .join("");

    sections.forEach(function (section) {
      section.items.forEach(function (item) {
        var card = root.querySelector('[data-id="' + item._key + '"]');
        if (!card) return;
        var name = card.querySelector('[data-field="name"]');
        var price = card.querySelector('[data-field="price_gbp"]');
        var sold = card.querySelector('[data-field="sold_out"]');
        var desc = card.querySelector('[data-field="description"]');
        if (name) name.value = item.name || "";
        if (price) price.value = item.price_gbp;
        if (sold) sold.checked = !!item.sold_out;
        if (desc) desc.value = item.description || "";
      });
    });
  }

  function refreshSections() {
    if (!sectionList) return;
    var names = {};
    items.forEach(function (item) {
      if (item.section) names[item.section] = true;
    });
    sectionList.innerHTML = Object.keys(names)
      .sort()
      .map(function (name) {
        return "<option value=\"" + name.replace(/"/g, "&quot;") + "\"></option>";
      })
      .join("");
  }

  function render() {
    renderBoard(drinksRoot, "drinks");
    renderBoard(sweetsRoot, "sweets");
    refreshSections();
  }

  function readItemCard(card) {
    var key = card.getAttribute("data-id");
    var item = items.filter(function (row) {
      return row._key === key;
    })[0];
    if (!item) return;
    var name = card.querySelector('[data-field="name"]');
    var price = card.querySelector('[data-field="price_gbp"]');
    var sold = card.querySelector('[data-field="sold_out"]');
    var desc = card.querySelector('[data-field="description"]');
    if (name) item.name = name.value.trim();
    if (price) item.price_gbp = Number(price.value);
    if (sold) item.sold_out = sold.checked;
    if (desc) item.description = desc.value.trim();
  }

  function readAll() {
    document.querySelectorAll(".admin-item").forEach(readItemCard);
  }

  function normalizeItems(list) {
    return (list || []).map(function (item) {
      return {
        id: item.id,
        _key: item.id || item._key || uid(),
        board: item.board === "sweets" ? "sweets" : "drinks",
        section: item.section || "The board",
        name: item.name || "",
        description: item.description || "",
        price_gbp: Number(item.price_gbp),
        sort: item.sort || 0,
        sold_out: !!item.sold_out
      };
    });
  }

  async function loadDesk() {
    loaded = true;
    setStatus("Opening the board…");
    try {
      var headers = await clerkHeaders();
      var res = await fetch("/api/admin", { headers: headers });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || "The desk could not open.");
      items = normalizeItems(data.items);
      deletedIds = [];
      fillHours(data.settings);
      render();
      setStatus("");
    } catch (err) {
      loaded = false;
      setStatus(err.message || "The desk could not open.", "error");
    }
  }

  form.addEventListener("input", function (event) {
    var card = event.target.closest(".admin-item");
    if (card) readItemCard(card);
  });

  form.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-remove]");
    if (!btn) return;
    var card = btn.closest(".admin-item");
    if (!card) return;
    var key = card.getAttribute("data-id");
    var item = items.filter(function (row) {
      return row._key === key;
    })[0];
    if (item && item.id) deletedIds.push(item.id);
    items = items.filter(function (row) {
      return row._key !== key;
    });
    render();
  });

  document.querySelectorAll("[data-admin-board]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var board = tab.getAttribute("data-admin-board");
      document.querySelectorAll("[data-admin-board]").forEach(function (el) {
        var on = el === tab;
        el.classList.toggle("is-active", on);
        el.setAttribute("aria-selected", on ? "true" : "false");
        el.tabIndex = on ? 0 : -1;
      });
      if (drinksRoot) drinksRoot.hidden = board !== "drinks";
      if (sweetsRoot) sweetsRoot.hidden = board !== "sweets";
      var addBoard = document.getElementById("add-board");
      if (addBoard) addBoard.value = board;
    });
  });

  var addBtn = document.getElementById("admin-add");
  if (addBtn) {
    addBtn.addEventListener("click", function () {
      var board = document.getElementById("add-board").value || "drinks";
      var section = document.getElementById("add-section").value.trim() || "The board";
      var name = document.getElementById("add-name").value.trim();
      var price = Number(document.getElementById("add-price").value);
      var description = document.getElementById("add-desc").value.trim();
      if (!name || !isFinite(price) || price < 0) {
        setStatus("Add a name and a price.", "error");
        return;
      }
      var same = items.filter(function (item) {
        return item.board === board && item.section === section;
      });
      var sort = same.reduce(function (max, item) {
        return Math.max(max, item.sort || 0);
      }, board === "sweets" ? 1000 : 0) + 10;
      items.push({
        _key: uid(),
        board: board,
        section: section,
        name: name,
        description: description,
        price_gbp: price,
        sort: sort,
        sold_out: false
      });
      document.getElementById("add-name").value = "";
      document.getElementById("add-price").value = "";
      document.getElementById("add-desc").value = "";
      render();
      setStatus("Added. Save the board to put it live.");
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    readAll();
    setStatus("Saving…");
    clerkHeaders()
      .then(function (headers) {
        var payload = {
          settings: {
            hours_line: document.getElementById("hours-line").value.trim(),
            hours_days: document.getElementById("hours-days").value.trim(),
            hours_range: document.getElementById("hours-range").value.trim(),
            opens: document.getElementById("hours-opens").value,
            closes: document.getElementById("hours-closes").value
          },
          deleted_ids: deletedIds,
          items: items.map(function (item) {
            var row = {
              board: item.board,
              section: item.section,
              name: item.name,
              description: item.description,
              price_gbp: item.price_gbp,
              sort: item.sort,
              sold_out: item.sold_out
            };
            if (item.id) row.id = item.id;
            return row;
          })
        };
        return fetch("/api/admin", {
          method: "PUT",
          headers: headers,
          body: JSON.stringify(payload)
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "The board could not save.");
          return data;
        });
      })
      .then(function (data) {
        items = normalizeItems(data.items);
        deletedIds = [];
        fillHours(data.settings);
        render();
        setStatus("Saved. The public menu will pick this up.");
      })
      .catch(function (err) {
        setStatus(err.message || "The board could not save.", "error");
      });
  });

  function bindClerk() {
    showPanels();
    if (window.Clerk && typeof Clerk.addListener === "function") {
      Clerk.addListener(showPanels);
    }
  }

  if (window.Clerk && Clerk.loaded) bindClerk();
  else {
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      if (window.Clerk || tries > 80) {
        window.clearInterval(timer);
        bindClerk();
      }
    }, 200);
  }
})();
