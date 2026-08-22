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
  var pickBtn = document.getElementById("admin-pick-btn");
  var pickList = document.getElementById("admin-pick-list");
  var pickCurrent = document.getElementById("admin-pick-current");
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

  var HOUSE_PHOTOS = [
    { src: "assets/photos/oreo-cookie.jpg", label: "Oreo cookie", match: /oreo/i },
    { src: "assets/photos/pistachio-cookie.jpg", label: "Pistachio cookie", match: /pistachio/i },
    { src: "assets/photos/biscoff-cookie.jpg", label: "Biscoff cookie", match: /biscoff|lotus/i },
    { src: "assets/photos/heart-cookie.jpg", label: "Heart cookie", match: /jammie|heart/i },
    { src: "assets/photos/caramel-cookie.jpg", label: "Caramel cookie", match: /caramel/i },
    { src: "assets/photos/chocolate-cookie.jpg", label: "Chocolate cookie", match: /chocolate cookie/i },
    { src: "assets/photos/brownies.jpg", label: "Brownies", match: /brownie/i },
    { src: "assets/photos/loaf.jpg", label: "Loaf", match: /loaf/i },
    { src: "assets/photos/matcha.jpg", label: "Iced matcha", match: /matcha/i },
    { src: "assets/photos/latte-case.jpg", label: "Latte and the case", match: /iced latte|iced blanco/i },
    { src: "assets/photos/espresso-bar.jpg", label: "Espresso bar", match: /espresso|americano/i },
    { src: "assets/photos/latte-cookies.jpg", label: "Latte and cookies", match: /latte|cappuccino|mocha|hot choc/i },
    { src: "assets/photos/house-jars.jpg", label: "House jars", match: /tea|chai|peppermint|chamomile|earl grey|english/i },
    { src: "assets/photos/sit-in.jpg", label: "The window", match: /smoothie/i },
    { src: "assets/photos/cookie-gelato.jpg", label: "Cookie and gelato", match: /gelato|sundae|scoop|ice cream|loaded|waffle/i },
    { src: "assets/photos/gelato-counter.jpg", label: "Gelato counter", match: /shake|milkshake/i },
    { src: "assets/photos/cookie-case.jpg", label: "The cookie case", match: /cookie/i },
    { src: "assets/photos/interior.jpg", label: "The house", match: /soft drink|water|house drink/i },
    { src: "assets/photos/lights.jpg", label: "Under the lights" },
    { src: "assets/photos/mascot-counter.jpg", label: "The mascot" },
    { src: "assets/photos/coffee-club-tee.jpg", label: "Coffee club tee" },
    { src: "assets/photos/coffee-club.jpg", label: "Coffee club" },
    { src: "assets/photos/soft-life.jpg", label: "Soft life" },
    { src: "assets/photos/matcha-lover.jpg", label: "Matcha lover" },
    { src: "assets/photos/matcha-jars.jpg", label: "Matcha jars" },
    { src: "assets/photos/table-ten.jpg", label: "Table ten" },
    { src: "assets/photos/storefront.jpg", label: "The shopfront" }
  ];

  var BOARD_PHOTO = {
    drinks: "assets/photos/latte-case.jpg",
    sweets: "assets/photos/cookie-case.jpg"
  };

  var liveShots = [];
  var photoPickKey = "";
  var photoPickEl = document.getElementById("photo-pick");
  var photoPickGrid = document.getElementById("photo-pick-grid");
  var photoPickClear = document.getElementById("photo-pick-clear");

  function shotPublicUrl(path) {
    var url = String(window.HOUSE_SUPABASE_URL || "").replace(/\/$/, "");
    if (!url || !path) return "";
    if (/^https?:\/\//i.test(path) || path.indexOf("assets/") === 0) return path;
    return url + "/storage/v1/object/public/gallery/" + path;
  }

  function guessPhoto(item) {
    var blob = String((item && item.name) || "") + " " + String((item && item.section) || "");
    var i;
    for (i = 0; i < HOUSE_PHOTOS.length; i++) {
      if (HOUSE_PHOTOS[i].match && HOUSE_PHOTOS[i].match.test(blob)) {
        return HOUSE_PHOTOS[i].src;
      }
    }
    return BOARD_PHOTO[(item && item.board) || "drinks"] || BOARD_PHOTO.drinks;
  }

  function itemPhoto(item) {
    if (item && item.photo) return shotPublicUrl(item.photo);
    return guessPhoto(item);
  }

  function galleryChoices() {
    var printed = HOUSE_PHOTOS.map(function (photo) {
      return { src: photo.src, label: photo.label };
    });
    var live = liveShots.map(function (shot) {
      return {
        src: shotPublicUrl(shot.path),
        label: shot.caption || shot.alt || "From the desk"
      };
    });
    return live.concat(printed);
  }

  function paintPhotoPick() {
    if (!photoPickGrid) return;
    var item = findItem(photoPickKey);
    var current = itemPhoto(item);
    photoPickGrid.innerHTML = galleryChoices()
      .map(function (photo) {
        var on = photo.src === current ? " is-on" : "";
        return (
          "<li>" +
          '<button type="button" class="' +
          on.trim() +
          '" data-photo-src="' +
          escapeHtml(photo.src) +
          '" aria-label="' +
          escapeHtml(photo.label) +
          '">' +
          '<img src="' +
          escapeHtml(photo.src) +
          '" alt="" width="160" height="160" loading="lazy" decoding="async" />' +
          "</button>" +
          "</li>"
        );
      })
      .join("");
  }

  function closePhotoPick() {
    photoPickKey = "";
    if (photoPickEl) photoPickEl.hidden = true;
  }

  function openPhotoPick(key) {
    var item = findItem(key);
    if (!item || !photoPickEl) return;
    photoPickKey = key;
    paintPhotoPick();
    photoPickEl.hidden = false;
  }

  function applyItemPhoto(src) {
    var item = findItem(photoPickKey);
    if (!item) return;
    item.photo = src || "";
    var card = document.querySelector('.admin-item[data-id="' + item._key + '"]');
    var img = card && card.querySelector(".admin-item-photo img");
    if (img) img.src = itemPhoto(item);
    markDirty();
    setStatus(src ? "Picture set. Save to put it live." : "Back to the house default. Save to put it live.");
    closePhotoPick();
  }

  function photoForName(name) {
    var hit = items.filter(function (row) {
      return row.name === name;
    })[0];
    if (hit) return itemPhoto(hit);
    return guessPhoto({ name: name || "", board: "sweets" });
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
    if (inSession && admin) {
      updateChrome();
      startDeskOrdersPoll();
      if (!rankDeskOnce) {
        rankDeskOnce = true;
        loadDeskRank();
      }
      if (deskShotsEl && deskShotsEl.getAttribute("data-loaded") !== "1") {
        deskShotsEl.setAttribute("data-loaded", "1");
        loadDeskShots();
      }
    }
  }

  async function clerkHeaders() {
    if (!window.Clerk || !Clerk.session) throw new Error("Sign in to use the house desk.");
    var token = await Clerk.session.getToken();
    if (!token && typeof Clerk.session.getToken === "function") {
      token = await Clerk.session.getToken({ skipCache: true });
    }
    if (!token) throw new Error("Sign in again to use the house desk.");
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
    var notice = document.getElementById("hours-notice");
    if (notice) notice.value = settings.notice || "";
    paintPace(settings);
  }

  function paintPace(settings) {
    var stale = !settings || !settings.pace_at;
    if (settings && settings.pace_at) {
      try {
        var at = new Date(settings.pace_at);
        var day = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/London",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        });
        stale = Number.isNaN(at.getTime()) || day.format(at) !== day.format(new Date());
      } catch (err) {
        stale = true;
      }
    }
    var room = stale ? "" : String((settings && settings.how_busy) || "");
    var wait = stale ? "" : String((settings && settings.how_wait) || "");
    document.querySelectorAll("[data-pace]").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-pace") === room);
    });
    document.querySelectorAll("[data-wait]").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-wait") === wait);
    });
  }

  var paceSaving = false;
  var paceStatus = document.getElementById("pace-status");

  function saveLive(patch) {
    if (paceSaving) return;
    paceSaving = true;
    if (paceStatus) paceStatus.textContent = "Saving…";
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/pace", {
          method: "POST",
          headers: headers,
          body: JSON.stringify(patch)
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error((data && data.error) || "The room could not update.");
          paintPace(data);
          if (paceStatus) {
            paceStatus.textContent = data.line
              ? "On the house: " + data.line
              : "Cleared. Customers will not see a line until you set today.";
          }
        });
      })
      .catch(function (err) {
        if (paceStatus) paceStatus.textContent = err.message || "The room could not update.";
      })
      .then(function () {
        paceSaving = false;
      });
  }

  var paceRow = document.getElementById("pace-row");
  if (paceRow) {
    paceRow.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-pace]");
      if (!btn || paceSaving) return;
      saveLive({ how_busy: btn.getAttribute("data-pace") || "" });
    });
  }
  var waitRow = document.getElementById("wait-row");
  if (waitRow) {
    waitRow.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-wait]");
      if (!btn || paceSaving) return;
      saveLive({ how_wait: btn.getAttribute("data-wait") || "" });
    });
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

  function pickLabel(item) {
    if (!item) return "Whole board";
    var label = item.name || "Untitled";
    var price = formatPickPrice(item.price_gbp);
    if (price) label += " · " + price;
    if (item.sold_out) label += " · sold out";
    return label;
  }

  function isPickOpen() {
    return pickList && !pickList.hidden;
  }

  function setPickOpen(open) {
    if (!pickEl || !pickBtn || !pickList) return;
    pickList.hidden = !open;
    pickBtn.setAttribute("aria-expanded", open ? "true" : "false");
    pickEl.classList.toggle("is-open", open);
  }

  function choosePick(key) {
    pickedKey = key || "";
    var item = pickedKey ? findItem(pickedKey) : null;
    setPickOpen(false);
    if (item) switchBoard(item.board);
    render();
    if (item) {
      setStatus("Editing " + (item.name || "that line") + ".");
      window.setTimeout(focusPicked, 60);
    } else {
      setStatus("The whole board.");
    }
  }

  function refreshPick() {
    if (!pickList || !pickCurrent) return;
    var selected = pickedKey ? findItem(pickedKey) : null;
    if (!selected) pickedKey = "";
    pickCurrent.textContent = pickLabel(selected);

    var html =
      '<button type="button" class="admin-pick-option' +
      (!pickedKey ? " is-active" : "") +
      '" role="option" data-pick="" aria-selected="' +
      (!pickedKey ? "true" : "false") +
      '">Whole board</button>';
    ["drinks", "sweets"].forEach(function (board) {
      var sections = group(board);
      if (!sections.length) return;
      html +=
        '<p class="admin-pick-group">' +
        escapeHtml(board === "sweets" ? "Sweets" : "Drinks") +
        "</p>";
      sections.forEach(function (section) {
        html +=
          '<p class="admin-pick-section">' +
          escapeHtml(section.title) +
          "</p>";
        section.items.forEach(function (item) {
          var active = item._key === pickedKey;
          html +=
            '<button type="button" class="admin-pick-option' +
            (active ? " is-active" : "") +
            (item.sold_out ? " is-sold" : "") +
            '" role="option" data-pick="' +
            escapeHtml(item._key) +
            '" aria-selected="' +
            (active ? "true" : "false") +
            '"><span class="admin-pick-name">' +
            escapeHtml(item.name || "Untitled") +
            '</span><span class="admin-pick-meta">' +
            escapeHtml(formatPickPrice(item.price_gbp)) +
            (item.sold_out ? " · sold out" : "") +
            "</span></button>";
        });
      });
    });
    pickList.innerHTML = html;
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
              '<button type="button" class="admin-item-photo" data-photo aria-label="Picture for ' +
              escapeHtml(item.name || "this line") +
              '">' +
              '<img src="' +
              escapeHtml(itemPhoto(item)) +
              '" alt="" width="92" height="92" loading="lazy" decoding="async" />' +
              "</button>" +
              '<div class="admin-item-body">' +
              '<div class="admin-item-row">' +
              '<label class="admin-item-name">Name<input data-field="name" type="text" maxlength="80" autocomplete="off" enterkeyhint="next"></label>' +
              '<label class="admin-item-price">Price<input data-field="price_gbp" type="number" min="0" step="0.01" inputmode="decimal"></label>' +
              '<label class="admin-item-rank">Rank<input data-field="driver_price_gbp" type="number" min="0" step="0.01" inputmode="decimal" placeholder="—"></label>' +
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
              "</div>" +
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
        var rank = card.querySelector('[data-field="driver_price_gbp"]');
        var desc = card.querySelector('[data-field="description"]');
        var sold = card.querySelector("[data-sold]");
        if (name) name.value = item.name || "";
        if (price) price.value = item.price_gbp;
        if (rank) {
          rank.value =
            item.driver_price_gbp === 0 || item.driver_price_gbp
              ? item.driver_price_gbp
              : "";
        }
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
    var rank = card.querySelector('[data-field="driver_price_gbp"]');
    var desc = card.querySelector('[data-field="description"]');
    if (name) item.name = name.value.trim();
    if (price) item.price_gbp = Number(price.value);
    if (rank) {
      var rankVal = rank.value.trim();
      item.driver_price_gbp = rankVal === "" ? null : Number(rankVal);
    }
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
        sold_out: !!item.sold_out,
        photo: item.photo || "",
        driver_price_gbp:
          item.driver_price_gbp === 0 || item.driver_price_gbp
            ? Number(item.driver_price_gbp)
            : null
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
    if (event.target.closest("#admin-pick")) return;
    if (event.target.id === "stamp-email") return;
    if (event.target.id === "rank-email") return;
    var card = event.target.closest(".admin-item");
    if (card) {
      readItemCard(card);
      var live = findItem(card.getAttribute("data-id"));
      var img = card.querySelector(".admin-item-photo img");
      if (live && img && !live.photo) img.src = guessPhoto(live);
    }
    if (event.target.id === "hours-opens" || event.target.id === "hours-closes") {
      syncHoursRange();
    }
    markDirty();
  });

  form.addEventListener("change", function (event) {
    if (event.target.closest("#admin-pick")) return;
    if (event.target.id === "stamp-email") return;
    if (event.target.id === "rank-email") return;
    if (event.target.getAttribute("data-field") === "name") refreshPick();
    if (event.target.id === "hours-opens" || event.target.id === "hours-closes") {
      syncHoursRange();
      markDirty();
    }
  });

  form.addEventListener("click", function (event) {
    var photoBtn = event.target.closest("[data-photo]");
    if (photoBtn) {
      var photoCard = photoBtn.closest(".admin-item");
      if (photoCard) openPhotoPick(photoCard.getAttribute("data-id"));
      return;
    }

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

  if (pickBtn) {
    pickBtn.addEventListener("click", function () {
      setPickOpen(!isPickOpen());
    });
  }

  if (pickList) {
    pickList.addEventListener("click", function (event) {
      var option = event.target.closest("[data-pick]");
      if (!option) return;
      choosePick(option.getAttribute("data-pick") || "");
    });
  }

  if (photoPickEl) {
    photoPickEl.addEventListener("click", function (event) {
      if (event.target.closest("[data-photo-close]")) {
        closePhotoPick();
        return;
      }
      var choice = event.target.closest("[data-photo-src]");
      if (choice) applyItemPhoto(choice.getAttribute("data-photo-src") || "");
    });
  }

  if (photoPickClear) {
    photoPickClear.addEventListener("click", function () {
      applyItemPhoto("");
    });
  }

  document.addEventListener("pointerdown", function (event) {
    if (!isPickOpen()) return;
    if (pickEl && pickEl.contains(event.target)) return;
    setPickOpen(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (photoPickEl && !photoPickEl.hidden) {
      closePhotoPick();
      return;
    }
    setPickOpen(false);
  });

  document.querySelectorAll("[data-admin-board]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      pickedKey = "";
      setPickOpen(false);
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
      sold_out: false,
      photo: "",
      driver_price_gbp: null
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
            closes: document.getElementById("hours-closes").value,
            notice: document.getElementById("hours-notice")
              ? document.getElementById("hours-notice").value.trim()
              : ""
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
              sold_out: item.sold_out,
              photo: item.photo || "",
              driver_price_gbp:
                item.driver_price_gbp === 0 || item.driver_price_gbp
                  ? item.driver_price_gbp
                  : null
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

  var stampEmail = document.getElementById("stamp-email");
  var stampFind = document.getElementById("stamp-find");
  var stampGive = document.getElementById("stamp-give");
  var stampStatus = document.getElementById("stamp-status");
  var stampPreview = document.getElementById("stamp-preview");
  var stampLoadedEmail = "";

  function paintStamps(count) {
    if (!stampPreview) return;
    var n = Number(count) || 0;
    stampPreview.querySelectorAll("li").forEach(function (li, i) {
      li.classList.toggle("is-stamped", i < n);
    });
  }

  function setStampStatus(text, kind) {
    if (!stampStatus) return;
    stampStatus.textContent = text || "";
    stampStatus.classList.toggle("is-error", kind === "error");
  }

  function stampNote(data) {
    var name = data.name || "that member";
    if (data.filled) {
      return "A drink on the house for " + name + ". The card starts again.";
    }
    if (!data.stamps) {
      return name + " has an empty card." + (data.cards_done ? " " + data.cards_done + " already on the house." : "");
    }
    return name + " · " + data.stamps + " of 8.";
  }

  function loadStampCard() {
    var email = stampEmail ? stampEmail.value.trim().toLowerCase() : "";
    if (!email || email.indexOf("@") === -1) {
      setStampStatus("Type a member email.", "error");
      if (stampGive) stampGive.disabled = true;
      return;
    }
    setStampStatus("Opening the card…");
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/stamps?email=" + encodeURIComponent(email), { headers: headers });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "No account for that email.");
          return data;
        });
      })
      .then(function (data) {
        stampLoadedEmail = email;
        paintStamps(data.stamps);
        if (stampGive) stampGive.disabled = false;
        setStampStatus(stampNote(data));
      })
      .catch(function (err) {
        stampLoadedEmail = "";
        paintStamps(0);
        if (stampGive) stampGive.disabled = true;
        setStampStatus(err.message || "No account for that email.", "error");
      });
  }

  function giveStamp() {
    var email = stampLoadedEmail || (stampEmail && stampEmail.value.trim().toLowerCase()) || "";
    if (!email) return;
    if (stampGive) stampGive.disabled = true;
    setStampStatus("Stamping…");
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/stamps", {
          method: "POST",
          headers: headers,
          body: JSON.stringify({ email: email })
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "The card could not update.");
          return data;
        });
      })
      .then(function (data) {
        stampLoadedEmail = email;
        paintStamps(data.stamps);
        if (stampGive) stampGive.disabled = false;
        setStampStatus(stampNote(data));
      })
      .catch(function (err) {
        if (stampGive) stampGive.disabled = false;
        setStampStatus(err.message || "The card could not update.", "error");
      });
  }

  if (stampFind) stampFind.addEventListener("click", loadStampCard);
  if (stampGive) stampGive.addEventListener("click", giveStamp);
  if (stampEmail) {
    stampEmail.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      loadStampCard();
    });
  }

  var rankCodeValue = document.getElementById("rank-code-value");
  var rankRotate = document.getElementById("rank-rotate");
  var rankEmail = document.getElementById("rank-email");
  var rankAdd = document.getElementById("rank-add");
  var rankDeskStatus = document.getElementById("rank-desk-status");
  var deskRankEl = document.getElementById("desk-rank");
  var rankLoaded = false;
  var rankDeskOnce = false;

  function setRankDeskStatus(text, kind) {
    if (!rankDeskStatus) return;
    rankDeskStatus.textContent = text || "";
    rankDeskStatus.classList.toggle("is-error", kind === "error");
  }

  function paintDeskRank(data) {
    if (rankCodeValue && data.code) rankCodeValue.textContent = data.code;
    var list = data.drivers || [];
    var on = Number(data.count) || 0;
    setRankDeskStatus(
      on === 1 ? "One driver on the rank." : on ? on + " drivers on the rank." : "No drivers on the rank yet."
    );
    if (!deskRankEl) return;
    deskRankEl.innerHTML = list
      .map(function (row) {
        var paused = row.status === "paused";
        return (
          '<li class="desk-rank-row' +
          (paused ? " is-paused" : "") +
          '">' +
          "<div>" +
          '<p class="desk-rank-who">' +
          escapeHtml(row.name || row.email || "a driver") +
          (paused ? " · paused" : "") +
          "</p>" +
          '<p class="desk-rank-email">' +
          escapeHtml(row.email || "") +
          "</p>" +
          "</div>" +
          '<button class="btn btn-ghost" type="button" data-rank-email="' +
          escapeHtml(row.email || "") +
          '" data-rank-action="' +
          (paused ? "in" : "pause") +
          '">' +
          (paused ? "Put back" : "Pause") +
          "</button>" +
          "</li>"
        );
      })
      .join("");
  }

  function loadDeskRank() {
    if (!deskRankEl && !rankCodeValue) return;
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/drivers?desk=1", { headers: headers });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "The rank could not open.");
          return data;
        });
      })
      .then(function (data) {
        rankLoaded = true;
        paintDeskRank(data);
      })
      .catch(function (err) {
        if (!rankLoaded) setRankDeskStatus(err.message || "The rank could not open.", "error");
      });
  }

  function postRank(payload) {
    return clerkHeaders().then(function (headers) {
      return fetch("/api/drivers", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "The rank could not update.");
          return data;
        });
      });
    });
  }

  if (rankRotate) {
    rankRotate.addEventListener("click", function () {
      setRankDeskStatus("Making a new code…");
      postRank({ action: "rotate" })
        .then(function () {
          return loadDeskRank();
        })
        .then(function () {
          setRankDeskStatus("New house code. Share it with the office.");
        })
        .catch(function (err) {
          setRankDeskStatus(err.message || "The code could not rotate.", "error");
        });
    });
  }

  function addToRank() {
    var email = rankEmail ? rankEmail.value.trim().toLowerCase() : "";
    if (!email) {
      setRankDeskStatus("Type a driver email.", "error");
      return;
    }
    setRankDeskStatus("Putting them on the rank…");
    postRank({ action: "add", email: email })
      .then(function (data) {
        if (rankEmail) rankEmail.value = "";
        loadDeskRank();
        setRankDeskStatus(
          data.linked
            ? "On the rank."
            : "On the rank. They join when they sign in."
        );
      })
      .catch(function (err) {
        setRankDeskStatus(err.message || "They could not go on the rank.", "error");
      });
  }

  if (rankAdd) rankAdd.addEventListener("click", addToRank);
  if (rankEmail) {
    rankEmail.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addToRank();
    });
  }
  if (deskRankEl) {
    deskRankEl.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-rank-action]");
      if (!btn) return;
      var email = btn.getAttribute("data-rank-email") || "";
      var action = btn.getAttribute("data-rank-action") || "pause";
      if (!email) return;
      postRank({ action: action, email: email })
        .then(function () {
          loadDeskRank();
        })
        .catch(function (err) {
          setRankDeskStatus(err.message || "The rank could not update.", "error");
        });
    });
  }

  var deskOrdersEl = document.getElementById("desk-orders");
  var deskOrdersStatus = document.getElementById("desk-orders-status");
  var deskOrdersTimer = 0;
  var deskOrdersBound = false;

  function money(value) {
    var n = Number(value);
    if (!isFinite(n)) return "";
    if (Math.round(n * 100) % 100 === 0) return "£" + String(Math.round(n));
    return "£" + n.toFixed(2);
  }

  function ago(iso) {
    var min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!isFinite(min) || min < 1) return "just in";
    if (min === 1) return "1 min";
    if (min < 60) return min + " min";
    var hr = Math.floor(min / 60);
    return hr === 1 ? "1 hr" : hr + " hr";
  }

  function setDeskOrdersStatus(text, kind) {
    if (!deskOrdersStatus) return;
    deskOrdersStatus.textContent = text || "";
    deskOrdersStatus.classList.toggle("is-error", kind === "error");
  }

  function deskAdvance(status) {
    if (status === "in") return { status: "preparing", label: "Making it" };
    if (status === "preparing") return { status: "ready", label: "Ready" };
    if (status === "ready") return { status: "collected", label: "Collected" };
    return null;
  }

  function deskLane(status) {
    if (status === "ready") return 0;
    if (status === "preparing") return 1;
    return 2;
  }

  function deskStage(status) {
    if (status === "preparing") return "making it";
    if (status === "ready") return "ready";
    return "in";
  }

  function paintDeskOrders(orders) {
    if (!deskOrdersEl) return;
    if (!orders.length) {
      deskOrdersEl.innerHTML = "";
      setDeskOrdersStatus("No collections waiting.");
      return;
    }
    var readyCount = orders.filter(function (order) {
      return order.status === "ready";
    }).length;
    var makingCount = orders.filter(function (order) {
      return order.status === "preparing";
    }).length;
    var bits = [];
    if (readyCount) bits.push(readyCount === 1 ? "one ready" : readyCount + " ready");
    if (makingCount) bits.push(makingCount === 1 ? "one making" : makingCount + " making");
    bits.push(orders.length === 1 ? "one collection." : orders.length + " collections.");
    setDeskOrdersStatus(bits.join(" · "));
    deskOrdersEl.innerHTML = orders
      .slice()
      .sort(function (a, b) {
        var lane = deskLane(a.status) - deskLane(b.status);
        if (lane) return lane;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      })
      .map(function (order) {
        var who = escapeHtml(order.name || order.email || "a member");
        var items = (order.items || [])
          .map(function (row) {
            return escapeHtml(row.qty + " × " + row.name);
          })
          .join(" · ");
        var note = order.note
          ? '<p class="desk-order-note">' + escapeHtml(order.note) + "</p>"
          : "";
        var next = deskAdvance(order.status);
        var nextBtn = next
          ? '<button class="btn" type="button" data-order-id="' +
            escapeHtml(order.id) +
            '" data-order-status="' +
            escapeHtml(next.status) +
            '">' +
            escapeHtml(next.label) +
            "</button>"
          : "";
        var first = (order.items && order.items[0]) || null;
        var photo = first
          ? '<img class="desk-order-photo" src="' +
            escapeHtml(photoForName(first.name)) +
            '" alt="" width="72" height="72" loading="lazy" decoding="async" />'
          : "";
        return (
          '<li class="desk-order is-' +
          escapeHtml(order.status) +
          '">' +
          photo +
          "<div>" +
          '<p class="desk-order-who">' +
          who +
          " · " +
          ago(order.created_at) +
          " · " +
          deskStage(order.status) +
          (order.rank ? " · rank" : "") +
          (order.paid ? " · paid" : " · pay at the counter") +
          "</p>" +
          '<p class="desk-order-items">' +
          items +
          "</p>" +
          note +
          '<p class="desk-order-total">' +
          money(order.total_gbp) +
          "</p>" +
          "</div>" +
          '<div class="desk-order-tools">' +
          nextBtn +
          '<button class="btn btn-ghost" type="button" data-order-id="' +
          escapeHtml(order.id) +
          '" data-order-status="cancelled">Let go</button>' +
          "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  function loadDeskOrders() {
    if (!deskOrdersEl) return;
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/orders?desk=1", { headers: headers });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Collections could not load.");
          return data;
        });
      })
      .then(function (data) {
        paintDeskOrders(data.orders || []);
      })
      .catch(function (err) {
        setDeskOrdersStatus(err.message || "Collections could not load.", "error");
      });
  }

  function startDeskOrdersPoll() {
    if (deskOrdersTimer) return;
    loadDeskOrders();
    deskOrdersTimer = window.setInterval(loadDeskOrders, 8000);
  }

  function setDeskOrderStatus(id, status, btn) {
    if (btn) btn.disabled = true;
    clerkHeaders()
      .then(function (headers) {
        return fetch("/api/orders", {
          method: "PATCH",
          headers: headers,
          body: JSON.stringify({ id: id, status: status })
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "That collection could not update.");
          return data;
        });
      })
      .then(function () {
        loadDeskOrders();
      })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        setDeskOrdersStatus(err.message || "That collection could not update.", "error");
      });
  }

  if (deskOrdersEl && !deskOrdersBound) {
    deskOrdersBound = true;
    deskOrdersEl.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-order-id]");
      if (!btn) return;
      event.preventDefault();
      setDeskOrderStatus(
        btn.getAttribute("data-order-id"),
        btn.getAttribute("data-order-status"),
        btn
      );
    });
  }

  var shotFile = document.getElementById("shot-file");
  var shotKind = document.getElementById("shot-kind");
  var shotCaption = document.getElementById("shot-caption");
  var shotStatus = document.getElementById("shot-status");
  var deskShotsEl = document.getElementById("desk-shots");

  function setShotStatus(text, kind) {
    if (!shotStatus) return;
    shotStatus.textContent = text || "";
    shotStatus.classList.toggle("is-error", kind === "error");
  }

  function shotUrl(path) {
    var url = String(window.HOUSE_SUPABASE_URL || "").replace(/\/$/, "");
    return url + "/storage/v1/object/public/gallery/" + path;
  }

  function addedLine(iso) {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return "";
    if (d.toDateString() === new Date().toDateString()) return "Added today";
    return (
      "Added " +
      d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    );
  }

  function paintDeskShots(shots) {
    if (!deskShotsEl) return;
    if (!shots.length) {
      deskShotsEl.innerHTML = "";
      return;
    }
    deskShotsEl.innerHTML = shots
      .map(function (shot) {
        return (
          '<li class="desk-shot">' +
          '<img src="' +
          escapeHtml(shotUrl(shot.path)) +
          '" alt="' +
          escapeHtml(shot.alt || "From the house.") +
          '" />' +
          "<div>" +
          '<p class="desk-shot-kind">' +
          escapeHtml(shot.kind) +
          (shot.created_at ? " · " + escapeHtml(addedLine(shot.created_at)) : "") +
          "</p>" +
          '<p class="desk-shot-caption">' +
          escapeHtml(shot.caption || shot.alt || "From the house.") +
          "</p>" +
          '<button class="btn btn-ghost" type="button" data-shot-id="' +
          escapeHtml(shot.id) +
          '">Take it down</button>' +
          "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  function loadDeskShots() {
    var url = String(window.HOUSE_SUPABASE_URL || "").replace(/\/$/, "");
    var key = String(window.HOUSE_SUPABASE_ANON_KEY || "").trim();
    if (!url || !key || !deskShotsEl) return;
    fetch(url + "/rest/v1/gallery_shots?select=*&order=created_at.desc", {
      headers: { apikey: key, Authorization: "Bearer " + key }
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Pictures could not load.");
        return res.json();
      })
      .then(function (rows) {
        liveShots = rows || [];
        paintDeskShots(liveShots);
        if (photoPickKey) paintPhotoPick();
        if (!liveShots.length && shotStatus && !shotStatus.classList.contains("is-error")) {
          setShotStatus("No new pictures yet.");
        }
      })
      .catch(function (err) {
        setShotStatus(err.message || "Pictures could not load.", "error");
      });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function compressFile(file) {
    var decode = window.createImageBitmap
      ? createImageBitmap(file)
      : Promise.reject(new Error("no bitmap"));
    return decode
      .catch(function () {
        return new Promise(function (resolve, reject) {
          var img = new Image();
          var href = URL.createObjectURL(file);
          img.onload = function () {
            URL.revokeObjectURL(href);
            resolve(img);
          };
          img.onerror = function () {
            URL.revokeObjectURL(href);
            reject(new Error("That picture could not open."));
          };
          img.src = href;
        });
      })
      .then(function (src) {
        var max = 1600;
        var scale = Math.min(1, max / Math.max(src.width, src.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(src.width * scale));
        canvas.height = Math.max(1, Math.round(src.height * scale));
        canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
        if (typeof src.close === "function") src.close();
        return new Promise(function (resolve, reject) {
          canvas.toBlob(
            function (blob) {
              if (!blob) reject(new Error("That picture could not go up."));
              else resolve(blob);
            },
            "image/jpeg",
            0.82
          );
        });
      });
  }

  function uploadShot(file) {
    var kind = shotKind ? shotKind.value : "house";
    var caption = shotCaption ? shotCaption.value.trim() : "";
    return compressFile(file)
      .then(blobToDataUrl)
      .then(function (image) {
        return clerkHeaders().then(function (headers) {
          return fetch("/api/gallery", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
              image: image,
              kind: kind,
              caption: caption,
              alt: caption || "From the house."
            })
          });
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "That picture could not go up.");
          return data;
        });
      });
  }

  function uploadShotFiles(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    setShotStatus("Sending to the gallery…");
    if (shotFile) shotFile.disabled = true;
    var chain = Promise.resolve();
    var ok = 0;
    list.forEach(function (file) {
      chain = chain.then(function () {
        return uploadShot(file).then(function () {
          ok += 1;
        });
      });
    });
    chain
      .then(function () {
        if (shotFile) {
          shotFile.disabled = false;
          shotFile.value = "";
        }
        loadDeskShots();
        setShotStatus(
          ok === 1 ? "On the gallery." : ok + " on the gallery."
        );
      })
      .catch(function (err) {
        if (shotFile) shotFile.disabled = false;
        loadDeskShots();
        setShotStatus(err.message || "That picture could not go up.", "error");
      });
  }

  if (shotFile) {
    shotFile.addEventListener("change", function () {
      uploadShotFiles(shotFile.files);
    });
  }
  if (shotCaption) {
    shotCaption.addEventListener("keydown", function (event) {
      if (event.key === "Enter") event.preventDefault();
    });
  }
  if (deskShotsEl) {
    deskShotsEl.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-shot-id]");
      if (!btn) return;
      btn.disabled = true;
      clerkHeaders()
        .then(function (headers) {
          return fetch("/api/gallery", {
            method: "DELETE",
            headers: headers,
            body: JSON.stringify({ id: btn.getAttribute("data-shot-id") })
          });
        })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || "That picture could not come down.");
            return data;
          });
        })
        .then(function () {
          loadDeskShots();
          setShotStatus("Taken down.");
        })
        .catch(function (err) {
          btn.disabled = false;
          setShotStatus(err.message || "That picture could not come down.", "error");
        });
    });
  }

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
