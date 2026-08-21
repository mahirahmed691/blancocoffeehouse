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
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (other) {
        other.classList.toggle(
          "is-active",
          other === tab
        );
      });
    });
  });
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
