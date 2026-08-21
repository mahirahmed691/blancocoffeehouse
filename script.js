(function () {
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");

  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  if (!toggle || !links) return;

  function setOpen(open) {
    links.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  toggle.addEventListener("click", function () {
    setOpen(!links.classList.contains("is-open"));
  });

  links.querySelectorAll("a, button").forEach(function (anchor) {
    anchor.addEventListener("click", function () {
      setOpen(false);
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setOpen(false);
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 760) setOpen(false);
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
  var panels = Array.prototype.slice.call(document.querySelectorAll(".board"));

  function showBoard(id) {
    panels.forEach(function (panel) {
      var on = panel.id === id;
      panel.classList.toggle("is-active", on);
      panel.hidden = !on;
    });
    tabs.forEach(function (tab) {
      var on = tab.getAttribute("aria-controls") === id;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      showBoard(tab.getAttribute("aria-controls"));
    });
  });

  var tablist = document.querySelector(".menu-tabs");
  if (tablist) {
    tablist.addEventListener("keydown", function (event) {
      var current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      var next = current;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = (current + 1) % tabs.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = (current - 1 + tabs.length) % tabs.length;
      } else {
        return;
      }
      event.preventDefault();
      tabs[next].focus();
      showBoard(tabs[next].getAttribute("aria-controls"));
    });
  }

  if (location.hash === "#sweets-board-title" || location.hash === "#board-sweets") {
    showBoard("board-sweets");
  }
})();

(function () {
  var MEMBERS_KEY = "blanco.v1.members";
  var SESSION_KEY = "blanco.v1.session";
  var layer = document.getElementById("auth-layer");
  var accountLayer = document.getElementById("account-layer");
  var form = document.getElementById("auth-form");
  if (!layer || !accountLayer || !form) return;

  var title = document.getElementById("auth-title");
  var lede = layer.querySelector("[data-auth-lede]");
  var nameField = layer.querySelector("[data-auth-name-field]");
  var nameInput = form.elements.namedItem("name");
  var emailInput = form.elements.namedItem("email");
  var passwordInput = form.elements.namedItem("password");
  var errorEl = layer.querySelector("[data-auth-error]");
  var submitBtn = form.querySelector(".auth-submit");
  var toggleBtn = layer.querySelector("[data-auth-toggle]");
  var loginNav = document.querySelector(".nav-login");
  var accountChip = document.querySelector(".nav-account");
  var nameLabels = document.querySelectorAll("[data-auth-name], [data-account-name]");
  var creating = false;
  var lastFocus = null;

  function members() {
    try {
      return JSON.parse(localStorage.getItem(MEMBERS_KEY) || "{}");
    } catch (err) {
      return {};
    }
  }

  function saveMembers(map) {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(map));
  }

  function session() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (err) {
      return null;
    }
  }

  function setSession(value) {
    if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else localStorage.removeItem(SESSION_KEY);
    renderSession();
  }

  function bytesToHex(buffer) {
    return Array.prototype.map
      .call(new Uint8Array(buffer), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      })
      .join("");
  }

  function randomSalt() {
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }

  function hashPassword(password, salt) {
    var encoded = new TextEncoder().encode(salt + ":" + password);
    return crypto.subtle.digest("SHA-256", encoded).then(bytesToHex);
  }

  function showError(message) {
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = "";
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function setMode(create) {
    creating = !!create;
    title.textContent = creating ? "Create account" : "Log in";
    lede.textContent = creating
      ? "Join blanco for collection, delivery, and rewards."
      : "Use your email to collect, order, and pick up rewards.";
    nameField.hidden = !creating;
    nameInput.required = creating;
    passwordInput.autocomplete = creating ? "new-password" : "current-password";
    submitBtn.textContent = creating ? "Create account" : "Log in";
    toggleBtn.textContent = creating
      ? "Already a member? Log in"
      : "New here? Create an account";
    showError("");
  }

  function renderSession() {
    var current = session();
    var signedIn = !!(current && current.email);
    if (loginNav) loginNav.hidden = signedIn;
    if (accountChip) accountChip.hidden = !signedIn;
    document.querySelectorAll(".app-actions").forEach(function (wrap) {
      wrap.hidden = signedIn;
    });
    nameLabels.forEach(function (node) {
      node.textContent = signedIn ? current.name || "member" : "Account";
    });
  }

  function openLayer(el) {
    lastFocus = document.activeElement;
    el.hidden = false;
    document.body.classList.add("auth-open");
  }

  function closeLayer(el) {
    if (el.hidden) return;
    el.hidden = true;
    if (layer.hidden && accountLayer.hidden) {
      document.body.classList.remove("auth-open");
    }
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function openAuth(create) {
    closeLayer(accountLayer);
    setMode(create);
    form.reset();
    showError("");
    openLayer(layer);
    var focusEl = creating ? nameInput : emailInput;
    if (focusEl) focusEl.focus();
  }

  function openAccount() {
    if (!session()) {
      openAuth(false);
      return;
    }
    closeLayer(layer);
    openLayer(accountLayer);
  }

  document.querySelectorAll("[data-auth-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openAuth(btn.getAttribute("data-auth-mode") === "create");
    });
  });

  document.querySelectorAll("[data-auth-account]").forEach(function (btn) {
    btn.addEventListener("click", openAccount);
  });

  document.querySelectorAll("[data-auth-close]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      closeLayer(layer);
    });
  });

  document.querySelectorAll("[data-account-close]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      closeLayer(accountLayer);
    });
  });

  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      setMode(!creating);
      (creating ? nameInput : emailInput).focus();
    });
  }

  var logout = document.querySelector("[data-auth-logout]");
  if (logout) {
    logout.addEventListener("click", function () {
      setSession(null);
      closeLayer(accountLayer);
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var email = String(emailInput.value || "")
      .trim()
      .toLowerCase();
    var password = String(passwordInput.value || "");
    var name = String(nameInput.value || "").trim();

    if (!email || email.indexOf("@") < 1) {
      showError("Enter a valid email.");
      emailInput.focus();
      return;
    }
    if (password.length < 8) {
      showError("Password needs at least 8 characters.");
      passwordInput.focus();
      return;
    }
    if (creating && !name) {
      showError("Add your name.");
      nameInput.focus();
      return;
    }

    var store = members();
    submitBtn.disabled = true;

    if (creating) {
      if (store[email]) {
        submitBtn.disabled = false;
        showError("That email already has an account. Log in.");
        return;
      }
      var salt = randomSalt();
      hashPassword(password, salt)
        .then(function (hash) {
          store[email] = { name: name, salt: salt, hash: hash };
          saveMembers(store);
          setSession({ email: email, name: name });
          closeLayer(layer);
          openAccount();
        })
        .catch(function () {
          showError("Couldn’t create the account. Try again.");
        })
        .then(function () {
          submitBtn.disabled = false;
        });
      return;
    }

    var record = store[email];
    if (!record) {
      submitBtn.disabled = false;
      showError("No account for that email. Create one.");
      return;
    }

    hashPassword(password, record.salt)
      .then(function (hash) {
        if (hash !== record.hash) {
          showError("Email or password doesn’t match.");
          return;
        }
        setSession({ email: email, name: record.name || "member" });
        closeLayer(layer);
        openAccount();
      })
      .catch(function () {
        showError("Couldn’t sign in. Try again.");
      })
      .then(function () {
        submitBtn.disabled = false;
      });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (!layer.hidden) {
      event.preventDefault();
      closeLayer(layer);
      return;
    }
    if (!accountLayer.hidden) {
      event.preventDefault();
      closeLayer(accountLayer);
    }
  });

  renderSession();
})();
