(function () {
  var form = document.getElementById("admin-form");
  if (!form) return;

  var denied = document.getElementById("admin-denied");
  var desk = document.getElementById("admin-desk");
  var statusEl = document.getElementById("admin-status");
  var drinksRoot = document.getElementById("admin-board-drinks");
  var sweetsRoot = document.getElementById("admin-board-sweets");
  var sectionList = document.getElementById("admin-sections");
  var saveBtn = document.getElementById("admin-save");
  var undoBtn = document.getElementById("admin-undo");
  var pickEl = document.getElementById("admin-pick");
  var metaEl = document.getElementById("admin-meta");
  var nameEl = document.querySelector("[data-admin-name]");

  var items = [];
  var deletedIds = [];
  var loaded = false;
  var dirty = false;
  var saving = false;
  var undo = null;
  var pickedKey = "";

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

  function firstName() {
    var user = window.Clerk && Clerk.user;
    if (!user) return "the house";
    return (
      user.firstName ||
      (user.fullName && String(user.fullName).split(" ")[0]) ||
      "the house"
    );
  }

  function countBoard(board) {
    return items.filter(function (item) {
      return item.board === board;
    }).length;
  }

  function countSold() {
    return items.filter(function (item) {
      return item.sold_out;
    }).length;
  }

  function prettyTime(value) {
    var raw = String(value || "").slice(0, 5);
    var parts = raw.split(":");
    var hour = parseInt(parts[0], 10);
    var minute = parts[1] || "00";
    if (!isFinite(hour)) return "";
    var suffix = hour >= 12 ? "pm" : "am";
    var hour12 = hour % 12 || 12;
    if (minute === "00") return hour12 + suffix;
    return hour12 + ":" + minute + suffix;
  }

  function syncHoursRange() {
    var opens = document.getElementById("hours-opens");
    var closes = document.getElementById("hours-closes");
    var range = document.getElementById("hours-range");
    var line = document.getElementById("hours-line");
    if (!opens || !closes || !range) return;
    var next = prettyTime(opens.value) + "–" + prettyTime(closes.value);
    if (!prettyTime(opens.value) || !prettyTime(closes.value)) return;
    var previous = range.value.trim();
    range.value = next;
    if (line && previous && line.value.indexOf(previous) !== -1) {
      line.value = line.value.split(previous).join(next);
    }
  }

  function updateChrome() {
    var drinksCount = document.querySelector("[data-count-drinks]");
    var sweetsCount = document.querySelector("[data-count-sweets]");
    if (drinksCount) drinksCount.textContent = String(countBoard("drinks"));
    if (sweetsCount) sweetsCount.textContent = String(countBoard("sweets"));
    if (nameEl) nameEl.textContent = firstName();
    if (metaEl) {
      var sold = countSold();
      metaEl.textContent = sold
        ? items.length + " lines · " + sold + " sold out"
        : items.length + " lines on the board";
    }
    if (saveBtn) {
      saveBtn.disabled = saving || !dirty || !loaded;
      saveBtn.textContent = saving
        ? "Saving…"
        : dirty
          ? "Save the board"
          : "Saved";
    }
    document.body.classList.toggle("admin-unsaved", dirty);
  }

  function markDirty() {
    dirty = true;
    updateChrome();
    if (!statusEl || statusEl.classList.contains("is-error")) return;
    if (!statusEl.textContent || statusEl.textContent.indexOf("Saved") === 0) {
      setStatus("Unsaved changes.");
    }
  }

  function markClean() {
    dirty = false;
    updateChrome();
  }

  function showPanels() {
    var inSession = isSignedIn();
    var admin = typeof window.blancoIsAdmin === "function" && window.blancoIsAdmin();
    if (denied) denied.hidden = !(inSession && !admin);
    if (desk) desk.hidden = !(inSession && admin);
    document.body.classList.toggle("admin-desk-open", inSession && admin);
    if (inSession && admin && !loaded) loadDesk();
    if (inSession && admin) updateChrome();
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

  function matchesFilter(item) {
    if (!pickedKey) return true;
    return item._key === pickedKey;
  }

  function formatPickPrice(value) {
    var n = Number(value);
    if (!isFinite(n)) return "";
    if (Math.round(n * 100) % 100 === 0) return "£" + String(Math.round(n));
    return "£" + n.toFixed(2);
  }

  function refreshPick() {
    if (!pickEl) return;
    if (document.activeElement === pickEl) return;
    var html = '<option value="">Whole board</option>';
    ["drinks", "sweets"].forEach(function (board) {
      group(board).forEach(function (section) {
        html +=
          '<optgroup label="' +
          escapeHtml((board === "sweets" ? "Sweets" : "Drinks") + " · " + section.title) +
          '">';
        section.items.forEach(function (item) {
          var label = (item.name || "Untitled") + " · " + formatPickPrice(item.price_gbp);
          if (item.sold_out) label += " · sold out";
          html +=
            '<option value="' +
            escapeHtml(item._key) +
            '">' +
            escapeHtml(label) +
            "</option>";
        });
        html += "</optgroup>";
      });
    });
    pickEl.innerHTML = html;
    pickEl.value = pickedKey && findItem(pickedKey) ? pickedKey : "";
    if (!findItem(pickedKey)) pickedKey = "";
  }

  function switchBoard(board) {
    document.querySelectorAll("[data-admin-board]").forEach(function (el) {
      var on = el.getAttribute("data-admin-board") === board;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
      el.tabIndex = on ? 0 : -1;
    });
    if (drinksRoot) drinksRoot.hidden = board !== "drinks";
    if (sweetsRoot) sweetsRoot.hidden = board !== "sweets";
    var addBoard = document.getElementById("add-board");
    if (addBoard) addBoard.value = board;
  }

  function focusPicked() {
    if (!pickedKey) return;
    var card = document.querySelector('.admin-item[data-id="' + pickedKey + '"]');
    if (!card) return;
    card.classList.add("is-picked");
    card.scrollIntoView({ block: "center", behavior: "smooth" });
    var sold = card.querySelector("[data-sold]");
    if (sold) sold.focus();
  }

  function renderBoard(root, board) {
    if (!root) return;
    var sections = group(board);
    var html = sections
      .map(function (section) {
        var visible = section.items.filter(matchesFilter);
        if (!visible.length) return "";
        var rows = visible
          .map(function (item) {
            return (
              '<article class="admin-item' +
              (item.sold_out ? " is-sold-out" : "") +
              (item._key === pickedKey ? " is-picked" : "") +
              '" data-id="' +
              item._key +
              '">' +
              '<div class="admin-item-row">' +
              '<label class="admin-item-name">Name<input data-field="name" type="text" maxlength="80" autocomplete="off" enterkeyhint="next"></label>' +
              '<label class="admin-item-price">Price<input data-field="price_gbp" type="number" min="0" step="0.01" inputmode="decimal"></label>' +
              "</div>" +
              '<div class="admin-item-bar">' +
              '<button type="button" class="admin-sold-btn" data-sold aria-pressed="false">On the board</button>' +
              '<div class="admin-item-tools">' +
              '<button type="button" class="admin-move" data-move="up" aria-label="Move up">Up</button>' +
              '<button type="button" class="admin-move" data-move="down" aria-label="Move down">Down</button>' +
              '<button type="button" class="admin-remove" data-remove>Remove</button>' +
              "</div>" +
              "</div>" +
              '<label class="admin-item-note">Note<textarea data-field="description" rows="2" maxlength="280"></textarea></label>' +
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
      .filter(Boolean)
      .join("");

    if (!html) {
      root.innerHTML =
        '<p class="admin-empty">' +
        (pickedKey
          ? "That line is not on this board."
          : "This board is empty. Add a line above.") +
        "</p>";
      return;
    }

    root.innerHTML = html;

    sections.forEach(function (section) {
      section.items.forEach(function (item) {
        var card = root.querySelector('[data-id="' + item._key + '"]');
        if (!card) return;
        var name = card.querySelector('[data-field="name"]');
        var price = card.querySelector('[data-field="price_gbp"]');
        var desc = card.querySelector('[data-field="description"]');
        var sold = card.querySelector("[data-sold]");
        if (name) name.value = item.name || "";
        if (price) price.value = item.price_gbp;
        if (desc) desc.value = item.description || "";
        if (sold) {
          sold.setAttribute("aria-pressed", item.sold_out ? "true" : "false");
          sold.textContent = item.sold_out ? "Sold out" : "On the board";
        }
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
    refreshPick();
    updateChrome();
  }

  function readItemCard(card) {
    var key = card.getAttribute("data-id");
    var item = items.filter(function (row) {
      return row._key === key;
    })[0];
    if (!item) return;
    var name = card.querySelector('[data-field="name"]');
    var price = card.querySelector('[data-field="price_gbp"]');
    var desc = card.querySelector('[data-field="description"]');
    if (name) item.name = name.value.trim();
    if (price) item.price_gbp = Number(price.value);
    if (desc) item.description = desc.value.trim();
  }

  function readAll() {
    document.querySelectorAll(".admin-item").forEach(readItemCard);
  }

  function findItem(key) {
    return items.filter(function (row) {
      return row._key === key;
    })[0];
  }

  function neighbors(item) {
    return items
      .filter(function (row) {
        return row.board === item.board && row.section === item.section;
      })
      .sort(function (a, b) {
        return (a.sort || 0) - (b.sort || 0);
      });
  }

  function moveItem(item, dir) {
    var list = neighbors(item);
    var index = -1;
    list.forEach(function (row, i) {
      if (row._key === item._key) index = i;
    });
    var swapWith = list[index + (dir === "up" ? -1 : 1)];
    if (!swapWith) return;
    var sort = item.sort;
    item.sort = swapWith.sort;
    swapWith.sort = sort;
    render();
    markDirty();
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
      undo = null;
      if (undoBtn) undoBtn.hidden = true;
      fillHours(data.settings);
      markClean();
      render();
      setStatus("The board is live. Change a line, then save.");
    } catch (err) {
      loaded = false;
      setStatus(err.message || "The desk could not open.", "error");
      updateChrome();
    }
  }

  form.addEventListener("input", function (event) {
    if (event.target.id === "admin-pick") return;
    var card = event.target.closest(".admin-item");
    if (card) readItemCard(card);
    if (event.target.id === "hours-opens" || event.target.id === "hours-closes") {
      syncHoursRange();
    }
    markDirty();
  });

  form.addEventListener("change", function (event) {
    if (event.target.id === "admin-pick") return;
    if (event.target.getAttribute("data-field") === "name") refreshPick();
    if (event.target.id === "hours-opens" || event.target.id === "hours-closes") {
      syncHoursRange();
      markDirty();
    }
  });

  form.addEventListener("click", function (event) {
    var soldBtn = event.target.closest("[data-sold]");
    if (soldBtn) {
      var soldCard = soldBtn.closest(".admin-item");
      var soldItem = soldCard && findItem(soldCard.getAttribute("data-id"));
      if (soldItem) {
        soldItem.sold_out = !soldItem.sold_out;
        soldCard.classList.toggle("is-sold-out", soldItem.sold_out);
        soldBtn.setAttribute("aria-pressed", soldItem.sold_out ? "true" : "false");
        soldBtn.textContent = soldItem.sold_out ? "Sold out" : "On the board";
        refreshPick();
        markDirty();
      }
      return;
    }

    var moveBtn = event.target.closest("[data-move]");
    if (moveBtn) {
      readAll();
      var moveCard = moveBtn.closest(".admin-item");
      var moveItemRow = moveCard && findItem(moveCard.getAttribute("data-id"));
      if (moveItemRow) moveItem(moveItemRow, moveBtn.getAttribute("data-move"));
      return;
    }

    var btn = event.target.closest("[data-remove]");
    if (!btn) return;
    var card = btn.closest(".admin-item");
    if (!card) return;
    readAll();
    var key = card.getAttribute("data-id");
    var index = -1;
    var item = null;
    items.forEach(function (row, i) {
      if (row._key === key) {
        item = row;
        index = i;
      }
    });
    if (!item) return;
    undo = { item: item, index: index };
    if (item.id) deletedIds.push(item.id);
    items = items.filter(function (row) {
      return row._key !== key;
    });
    if (pickedKey === key) pickedKey = "";
    if (undoBtn) undoBtn.hidden = false;
    render();
    markDirty();
    setStatus("Removed " + (item.name || "that line") + ".");
  });

  if (undoBtn) {
    undoBtn.addEventListener("click", function () {
      if (!undo) return;
      var restored = undo.item;
      items.splice(Math.min(undo.index, items.length), 0, restored);
      if (restored.id) {
        deletedIds = deletedIds.filter(function (id) {
          return id !== restored.id;
        });
      }
      undo = null;
      undoBtn.hidden = true;
      render();
      markDirty();
      setStatus("Put back on the board.");
    });
  }

  if (pickEl) {
    pickEl.addEventListener("change", function () {
      pickedKey = pickEl.value;
      var item = pickedKey ? findItem(pickedKey) : null;
      if (item) switchBoard(item.board);
      render();
      if (item) {
        setStatus("Editing " + (item.name || "that line") + ".");
        window.setTimeout(focusPicked, 60);
      } else {
        setStatus("The whole board.");
      }
    });
  }

  document.querySelectorAll("[data-admin-board]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      pickedKey = "";
      if (pickEl) pickEl.value = "";
      switchBoard(tab.getAttribute("data-admin-board"));
      render();
    });
  });

  function addLine() {
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
    var sort =
      same.reduce(function (max, item) {
        return Math.max(max, item.sort || 0);
      }, board === "sweets" ? 1000 : 0) + 10;
    var key = uid();
    items.push({
      _key: key,
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
    pickedKey = key;
    switchBoard(board);
    render();
    markDirty();
    setStatus("Added " + name + ". Save to put it live.");
    window.setTimeout(focusPicked, 60);
  }

  var addBtn = document.getElementById("admin-add");
  if (addBtn) addBtn.addEventListener("click", addLine);

  var addBox = document.querySelector(".admin-add");
  if (addBox) {
    addBox.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      if (event.target && event.target.tagName === "TEXTAREA") return;
      event.preventDefault();
      addLine();
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (saving || !dirty) return;
    readAll();
    saving = true;
    updateChrome();
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
        undo = null;
        if (undoBtn) undoBtn.hidden = true;
        fillHours(data.settings);
        saving = false;
        markClean();
        render();
        setStatus("Saved. The public menu will pick this up.");
      })
      .catch(function (err) {
        saving = false;
        updateChrome();
        setStatus(err.message || "The board could not save.", "error");
      });
  });

  window.addEventListener("beforeunload", function (event) {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
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
