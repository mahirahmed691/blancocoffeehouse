var blancoShowBoard = null;

(function () {
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var trigger = document.querySelector(".mega-trigger");
  var panel = document.getElementById("mega-panel");
  var closeTimer = 0;

  function desktopMega() {
    return window.matchMedia("(min-width: 901px) and (hover: hover)").matches;
  }

  function setOpen(open) {
    if (!panel) return;
    panel.hidden = !open;
    if (header) header.classList.toggle("is-mega-open", open);
    if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
  }

  function isOpen() {
    return panel && !panel.hidden;
  }

  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  if (!panel) return;

  if (trigger) {
    trigger.addEventListener("click", function () {
      setOpen(!isOpen());
    });
    trigger.addEventListener("pointerenter", function () {
      if (!desktopMega()) return;
      window.clearTimeout(closeTimer);
      setOpen(true);
    });
  }

  header.addEventListener("pointerleave", function () {
    if (!desktopMega()) return;
    closeTimer = window.setTimeout(function () {
      setOpen(false);
    }, 140);
  });

  header.addEventListener("pointerenter", function () {
    window.clearTimeout(closeTimer);
  });

  if (toggle) {
    toggle.addEventListener("click", function () {
      setOpen(!isOpen());
    });
  }

  panel.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setOpen(false);
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setOpen(false);
  });

  document.addEventListener("pointerdown", function (event) {
    if (!isOpen()) return;
    if (header.contains(event.target)) return;
    setOpen(false);
  });

  window.addEventListener("resize", function () {
    if (desktopMega()) return;
    if (window.innerWidth > 900) setOpen(false);
  });
})();

(function () {
  var triggers = Array.prototype.slice.call(
    document.querySelectorAll(".gallery-open")
  );
  var lightbox = document.getElementById("lightbox");
  if (!triggers.length || !lightbox) return;

  var img = lightbox.querySelector(".lightbox-image");
  var caption = lightbox.querySelector(".lightbox-caption");
  var btnClose = lightbox.querySelector(".lightbox-close");
  var btnPrev = lightbox.querySelector(".lightbox-prev");
  var btnNext = lightbox.querySelector(".lightbox-next");
  var index = 0;
  var lastFocus = null;

  function photos() {
    return triggers.map(function (button) {
      var photo = button.querySelector("img");
      return {
        src: photo.getAttribute("src"),
        alt: photo.getAttribute("alt") || ""
      };
    });
  }

  function focusables() {
    return [btnClose, btnPrev, btnNext].filter(function (node) {
      return node && !node.hidden;
    });
  }

  function show(i) {
    var items = photos();
    index = (i + items.length) % items.length;
    var photo = items[index];
    img.src = photo.src;
    img.alt = photo.alt;
    caption.textContent = photo.alt;
    var many = items.length > 1;
    btnPrev.hidden = !many;
    btnNext.hidden = !many;
  }

  function openAt(i) {
    lastFocus = document.activeElement;
    show(i);
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    btnClose.focus();
  }

  function close() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
    img.removeAttribute("src");
    img.alt = "";
    caption.textContent = "";
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  triggers.forEach(function (button, i) {
    button.addEventListener("click", function () {
      openAt(i);
    });
  });

  btnClose.addEventListener("click", close);
  btnPrev.addEventListener("click", function () {
    show(index - 1);
  });
  btnNext.addEventListener("click", function () {
    show(index + 1);
  });

  lightbox.addEventListener("click", function (event) {
    if (event.target.hasAttribute("data-lightbox-close")) close();
  });

  document.addEventListener("keydown", function (event) {
    if (lightbox.hidden) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(index - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      show(index + 1);
      return;
    }

    if (event.key !== "Tab") return;

    var nodes = focusables();
    if (!nodes.length) return;

    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else     if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();

(function () {
  document.querySelectorAll(".board-section").forEach(function (section) {
    var children = Array.prototype.slice.call(section.children);
    children.forEach(function (node) {
      if (!node.classList || !node.classList.contains("menu-item")) return;
      var row = document.createElement("div");
      row.className = "menu-row";
      row.tabIndex = 0;
      section.insertBefore(row, node);
      row.appendChild(node);
      var next = row.nextElementSibling;
      while (next && next.classList.contains("menu-item-desc")) {
        var desc = next;
        next = desc.nextElementSibling;
        row.appendChild(desc);
      }
      var steam = document.createElement("span");
      steam.className = "row-steam";
      steam.setAttribute("aria-hidden", "true");
      steam.innerHTML = "<span></span><span></span><span></span>";
      row.appendChild(steam);
    });
  });

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".menu-tab"));
  var drinksBoard = document.getElementById("drinks-board");
  var sweetsBoard = document.getElementById("sweets-board");

  function kindFromHash(hash) {
    hash = hash || "";
    if (hash.indexOf("sweets") !== -1) return "Sweets";
    if (hash.indexOf("drinks") !== -1) return "Drinks";
    return null;
  }

  function showBoard(kind) {
    if (!drinksBoard || !sweetsBoard) return;
    var sweetsOn = kind === "Sweets";
    drinksBoard.hidden = sweetsOn;
    sweetsBoard.hidden = !sweetsOn;
    drinksBoard.classList.toggle("is-active", !sweetsOn);
    sweetsBoard.classList.toggle("is-active", sweetsOn);
    tabs.forEach(function (tab) {
      var isSweets = (tab.getAttribute("href") || "").indexOf("sweets") !== -1;
      var on = sweetsOn ? isSweets : !isSweets;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
    });
  }

  blancoShowBoard = showBoard;

  tabs.forEach(function (tab, index) {
    tab.addEventListener("click", function (event) {
      event.preventDefault();
      var sweetsOn = (tab.getAttribute("href") || "").indexOf("sweets") !== -1;
      showBoard(sweetsOn ? "Sweets" : "Drinks");
    });
    tab.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      var next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      next.click();
    });
  });

  showBoard(kindFromHash(window.location.hash) || "Drinks");

  function revealFromHash() {
    var kind = kindFromHash(window.location.hash);
    if (!kind) return;
    showBoard(kind);
    var id = (window.location.hash || "").replace(/^#/, "");
    var target = (id && document.getElementById(id)) || document.getElementById("menu");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  window.addEventListener("hashchange", revealFromHash);
  if (kindFromHash(window.location.hash)) {
    window.setTimeout(revealFromHash, 0);
  }
})();

(function () {
  var shareBtn = document.querySelector("[data-share-house]");
  var fallback = document.querySelector("[data-share-fallback]");
  var statusEl = document.querySelector("[data-share-status]");
  var copyBtn = document.querySelector("[data-copy-link]");
  if (!shareBtn) return;

  var pageUrl = "https://blancocoffeehouse.com/";
  var shareTitle = "blanco. your way.";
  var shareText =
    "Blanco Coffee House, Hazel Grove — sit in, pick up, or get it delivered.";

  function setStatus(message) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
  }

  function showFallback() {
    if (fallback) fallback.hidden = false;
  }

  function copyLink() {
    var done = function () {
      setStatus("Link copied.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pageUrl).then(done).catch(showFallback);
      return;
    }
    var field = document.createElement("textarea");
    field.value = pageUrl;
    field.setAttribute("readonly", "");
    field.style.position = "absolute";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    try {
      document.execCommand("copy");
      done();
    } catch (err) {
      setStatus(pageUrl);
    }
    document.body.removeChild(field);
  }

  shareBtn.addEventListener("click", function () {
    setStatus("");
    if (typeof navigator.share === "function") {
      navigator
        .share({
          title: shareTitle,
          text: shareText,
          url: pageUrl
        })
        .catch(function (err) {
          if (err && err.name === "AbortError") return;
          showFallback();
        });
      return;
    }
    showFallback();
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", copyLink);
  }
})();

(function () {
  var input = document.getElementById("house-search");
  var list = document.getElementById("house-search-results");
  if (!input) return;

  var pages = [
    { label: "The menu", href: "#menu", hay: "menu board drinks sweets", kind: "The house" },
    { label: "In the cup", href: "#cup", hay: "coffee espresso latte cappuccino americano mocha iced matcha milk steamed hot choc", kind: "The house" },
    { label: "Sit in, pick up, delivery", href: "#ways", hay: "sit in pick up delivery your way", kind: "Your way" },
    { label: "In-store photographs", href: "#gallery", hay: "gallery photos house", kind: "The house" },
    { label: "Apparel, coming soon", href: "#wear", hay: "apparel merch merchandise tee hoodie tote wear drop clothing", kind: "The house" },
    { label: "Rewards & orders", href: "#app", hay: "rewards stamps loyalty account", kind: "Account" },
    { label: "Google reviews", href: "#reviews", hay: "google reviews share", kind: "The house" },
    { label: "Visit Fiveways Parade", href: "#visit", hay: "visit address hours map stockport hazel grove", kind: "Visit" },
    { label: "Your account", href: "account.html", hay: "sign in sign up account login", kind: "Account" }
  ];

  var onHousePage = !!document.getElementById("menu");

  function textOf(el) {
    return ((el && el.textContent) || "").replace(/\s+/g, " ").trim();
  }

  function menuIndex() {
    if (!onHousePage) return [];
    return Array.prototype.slice.call(document.querySelectorAll(".menu-item")).map(function (item) {
      var row = item.closest(".menu-row") || item;
      var board = item.closest(".board");
      var section = item.closest(".board-section");
      var heading = section && section.querySelector("h4");
      var desc = row.querySelector(".menu-item-desc");
      var price = item.querySelector(".price");
      var name = textOf(item.querySelector(".name"));
      var boardKind = board && board.getAttribute("aria-labelledby") === "sweets-board-title"
        ? "Sweets"
        : "Drinks";
      var sectionName = textOf(heading);
      return {
        label: name,
        href: boardKind === "Sweets" ? "#sweets-board-title" : "#drinks-board-title",
        hay: [name, textOf(desc), textOf(price), sectionName, boardKind].join(" ").toLowerCase(),
        kind: boardKind + (sectionName ? " · " + sectionName : ""),
        meta: textOf(price),
        row: row,
        boardKind: boardKind
      };
    });
  }

  function allItems() {
    return menuIndex().concat(pages);
  }

  function showList(items) {
    if (!list) return;
    list.innerHTML = "";
    if (!items.length) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      return;
    }
    items.slice(0, 8).forEach(function (item, i) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "option");
      btn.setAttribute("data-index", String(i));
      btn.innerHTML =
        "<span class=\"search-kind\">" +
        item.kind +
        "</span><span class=\"search-label\">" +
        item.label +
        (item.meta ? " <em>" + item.meta + "</em>" : "") +
        "</span>";
      btn.addEventListener("click", function () {
        go(item);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function queryItems(q) {
    var needle = q.toLowerCase().trim();
    if (needle.length < 1) return [];
    return allItems().filter(function (item) {
      return item.hay.indexOf(needle) !== -1 || item.label.toLowerCase().indexOf(needle) !== -1;
    });
  }

  function activateBoard(kind) {
    if (typeof blancoShowBoard === "function") {
      blancoShowBoard(kind);
      return;
    }
    var tabs = document.querySelectorAll(".menu-tab");
    tabs.forEach(function (tab) {
      var sweets = (tab.getAttribute("href") || "").indexOf("sweets") !== -1;
      tab.classList.toggle("is-active", kind === "Sweets" ? sweets : !sweets);
    });
  }

  function go(item) {
    document.querySelectorAll(".menu-row.is-search-hit").forEach(function (row) {
      row.classList.remove("is-search-hit");
    });
    if (!onHousePage) {
      window.location.href = "index.html?q=" + encodeURIComponent(input.value.trim() || item.label);
      return;
    }
    if (item.boardKind) activateBoard(item.boardKind);
    if (item.row) {
      item.row.classList.add("is-search-hit");
      item.row.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (item.href.charAt(0) === "#") {
      var target = document.querySelector(item.href);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.location.href = item.href;
    }
    showList([]);
    input.blur();
  }

  function render() {
    showList(queryItems(input.value));
  }

  input.addEventListener("input", render);
  input.addEventListener("focus", render);

  input.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      showList([]);
      input.blur();
      event.stopPropagation();
      return;
    }
    if (event.key !== "Enter") return;
    var matches = queryItems(input.value);
    if (!matches.length) return;
    event.preventDefault();
    go(matches[0]);
  });

  document.addEventListener("pointerdown", function (event) {
    var box = input.closest(".nav-search");
    if (box && box.contains(event.target)) return;
    showList([]);
  });

  var initial = new URLSearchParams(window.location.search).get("q");
  if (initial && onHousePage) {
    input.value = initial;
    var first = queryItems(initial)[0];
    if (first) {
      window.setTimeout(function () {
        go(first);
      }, 250);
    }
  }
})();
