/* Clerk JS (CDN) for this static site.
   App: app_3ICtW3IyvsokSBEB7HVoxDweHCq
   Quickstart: https://clerk.com/docs/js-frontend/getting-started/quickstart */
(function () {
  var key = String(window.CLERK_PUBLISHABLE_KEY || "").trim();
  if (!key || key.indexOf("pk_") !== 0) {
    key = "pk_test_cHJlY2lzZS1jaXZldC0zMzguY2xlcmsuYWNjb3VudHMuZGV2JA";
  }
  var accountUrl = new URL("account.html", window.location.href).href;
  var homeUrl = new URL("index.html", window.location.href).href;
  var adminUrl = new URL("admin.html", window.location.href).href;
  var onAdminPage = /admin\.html(?:$|\?|#)/.test(location.pathname + location.search);
  var onOrdersPage = /orders\.html(?:$|\?|#)/.test(location.pathname + location.search);
  var afterAuthUrl = onAdminPage ? adminUrl : onOrdersPage ? location.href : accountUrl;
  function houseAppearance() {
    var night = document.documentElement.hasAttribute("data-night");
    var brown = night ? "#e9e1d8" : "#503931";
    var beige = night ? "#1a1412" : "#E9E1D8";
    var paper = night ? "#251c18" : "#F3ECE4";
    return {
      variables: {
        colorPrimary: brown,
        colorBackground: paper,
        colorInputBackground: night ? "#251c18" : "#E9E1D8",
        colorText: brown,
        colorTextOnPrimaryBackground: beige,
        colorNeutral: brown,
        borderRadius: "2px",
        fontFamily: "Work Sans, system-ui, sans-serif"
      },
      elements: {
        cardBox: { boxShadow: "none" },
        card: {
          background: "transparent",
          boxShadow: "none",
          borderRadius: "2px"
        },
        headerTitle: {
          fontFamily: "Fraunces, Times New Roman, serif",
          fontWeight: "500"
        },
        formButtonPrimary: {
          backgroundColor: brown,
          color: beige,
          borderRadius: "1px",
          fontSize: "0.92rem",
          fontWeight: "500"
        },
        userButtonAvatarBox: { width: "2.15rem", height: "2.15rem" }
      }
    };
  }

  function setReady() {
    document.body.classList.add("clerk-ready");
  }

  function setSignedIn(inSession) {
    document.body.classList.toggle("is-member", !!inSession);
    document.querySelectorAll(".clerk-signed-out").forEach(function (el) {
      el.hidden = !!inSession;
    });
    document.querySelectorAll(".clerk-signed-in").forEach(function (el) {
      el.hidden = !inSession;
    });
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: "blanco-auth", signedIn: !!inSession })
        );
      }
    } catch (err) {}
  }

  function isSignedIn() {
    if (!window.Clerk) return false;
    if (typeof Clerk.isSignedIn === "boolean") return Clerk.isSignedIn;
    return !!(Clerk.user || Clerk.session);
  }

  function showSetupNote() {
    var note = document.getElementById("clerk-setup-note");
    if (note) note.hidden = false;
  }

  function roleAdmin() {
    var user = window.Clerk && Clerk.user;
    if (!user) return false;
    var meta = user.publicMetadata || user.public_metadata || {};
    return String(meta.role || "").toLowerCase() === "admin";
  }

  var adminTick = 0;
  var adminKnown = false;

  function paintAdmin(admin, known) {
    adminKnown = !!known;
    document.body.classList.toggle("is-house-admin", !!admin);
    document.querySelectorAll("[data-house-desk]").forEach(function (el) {
      el.hidden = !admin;
    });
    var denied = document.getElementById("admin-denied");
    var desk = document.getElementById("admin-desk");
    var inSession = isSignedIn();
    if (denied) denied.hidden = !(inSession && known && !admin);
    if (desk) desk.hidden = !(inSession && admin);
    document.dispatchEvent(
      new CustomEvent("blanco-admin", { detail: { admin: !!admin, known: !!known } })
    );
  }

  function isHouseAdmin() {
    return document.body.classList.contains("is-house-admin");
  }

  window.blancoIsAdmin = isHouseAdmin;

  function setAdminUi() {
    if (!isSignedIn()) {
      adminTick += 1;
      paintAdmin(false, true);
      return;
    }
    paintAdmin(roleAdmin(), roleAdmin() || adminKnown);
    confirmAdmin();
  }

  function confirmAdmin() {
    var tick = ++adminTick;
    if (!window.Clerk || !Clerk.session) {
      paintAdmin(roleAdmin(), true);
      return;
    }
    Clerk.session
      .getToken()
      .then(function (jwt) {
        if (tick !== adminTick) return null;
        if (!jwt) {
          paintAdmin(false, true);
          return null;
        }
        return fetch("/api/pace", {
          headers: {
            Authorization: "Bearer " + jwt,
            "X-Clerk-Session": Clerk.session.id
          }
        }).then(function (res) {
          return res.json().catch(function () {
            return {};
          }).then(function (data) {
            return { ok: res.ok, admin: !!(data && data.admin) };
          });
        });
      })
      .then(function (result) {
        if (tick !== adminTick || !result) return;
        paintAdmin(!!result.admin, true);
      })
      .catch(function () {
        if (tick !== adminTick) return;
        paintAdmin(roleAdmin(), true);
      });
  }

  function fillProfile() {
    var user = window.Clerk && Clerk.user;
    if (!user) return;
    var emailObj = user.primaryEmailAddress || (user.emailAddresses && user.emailAddresses[0]);
    var name = user.fullName || user.firstName || "member";
    var first =
      user.firstName ||
      (user.fullName && String(user.fullName).split(" ")[0]) ||
      "member";
    var email = (emailObj && emailObj.emailAddress) || "—";
    document.querySelectorAll("[data-account-first]").forEach(function (el) {
      el.textContent = first;
    });
    document.querySelectorAll("[data-account-name]").forEach(function (el) {
      el.textContent = name;
    });
    document.querySelectorAll("[data-account-email]").forEach(function (el) {
      el.textContent = email;
    });
  }

  function fapiHost(pk) {
    try {
      var payload = pk.split("_")[2] || "";
      var decoded = atob(payload);
      return decoded.replace(/\$$/, "").replace(/\u0000/g, "").replace(/\/$/, "");
    } catch (err) {
      return "";
    }
  }

  function loadScript(src, attrs) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.crossOrigin = "anonymous";
      Object.keys(attrs || {}).forEach(function (name) {
        script.setAttribute(name, attrs[name]);
      });
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("Failed to load " + src));
      };
      document.head.appendChild(script);
    });
  }

  function mountUserButtons() {
    if (!isSignedIn()) return;
    document
      .querySelectorAll("#clerk-user-button, [data-clerk-user-button], .clerk-user-button")
      .forEach(function (el) {
        if (el.getAttribute("data-mounted") === "true") return;
        Clerk.mountUserButton(el, {
          appearance: houseAppearance(),
          userProfileMode: "modal",
          afterSignOutUrl: homeUrl
        });
        el.setAttribute("data-mounted", "true");
      });
  }

  function wantsSignUp() {
    return location.hash === "#sign-up";
  }

  function setAuthCopy(signUp) {
    var title = document.getElementById("auth-panel-title");
    var lede = document.getElementById("auth-panel-lede");
    if (title) title.textContent = signUp ? "Join the house." : "Welcome back.";
    if (lede) {
      lede.textContent = signUp
        ? "A quiet account for when orders and stamps are ready."
        : "The same email you’ll keep for collection, delivery, and rewards.";
    }
    document.querySelectorAll("[data-auth-mode]").forEach(function (tab) {
      var active = tab.getAttribute("data-auth-mode") === (signUp ? "sign-up" : "sign-in");
      tab.classList.toggle("is-active", active);
      if (tab.getAttribute("role") === "tab") {
        tab.setAttribute("aria-selected", active ? "true" : "false");
      }
    });
  }

  function setMountLoading(mount, on) {
    if (!mount) return;
    if (on) {
      mount.setAttribute("data-clerk-loading", "");
      if (!mount.querySelector(".clerk-loading")) {
        var p = document.createElement("p");
        p.className = "clerk-loading";
        p.textContent = "Opening the book…";
        mount.appendChild(p);
      }
    } else {
      mount.removeAttribute("data-clerk-loading");
      var loading = mount.querySelector(".clerk-loading");
      if (loading) loading.remove();
    }
  }

  function unmountAuth() {
    var mount = document.getElementById("clerk-sign-in");
    if (!mount || !window.Clerk) return;
    try {
      Clerk.unmountSignIn(mount);
    } catch (err) {}
    try {
      Clerk.unmountSignUp(mount);
    } catch (err) {}
    mount.removeAttribute("data-mounted");
    mount.innerHTML = "";
  }

  function mountAuthForm(force) {
    var mount = document.getElementById("clerk-sign-in");
    if (!mount || isSignedIn() || !window.Clerk) return;
    var mode = wantsSignUp() ? "sign-up" : "sign-in";
    if (!force && mount.getAttribute("data-mounted") === mode) return;
    unmountAuth();
    setAuthCopy(mode === "sign-up");
    setMountLoading(mount, true);
    var opts = {
      appearance: houseAppearance(),
      forceRedirectUrl: afterAuthUrl,
      signInForceRedirectUrl: afterAuthUrl,
      signUpForceRedirectUrl: afterAuthUrl
    };
    if (mode === "sign-up") {
      Clerk.mountSignUp(mount, opts);
    } else {
      Clerk.mountSignIn(mount, opts);
    }
    mount.setAttribute("data-mounted", mode);
    setMountLoading(mount, false);
  }

  function switchAuthMode(mode) {
    var next = mode === "sign-up" ? "#sign-up" : onAdminPage ? "#admin-auth" : "#account-auth";
    if (location.hash !== next) {
      history.replaceState(null, "", next);
    }
    mountAuthForm(true);
  }

  function render() {
    var inSession = isSignedIn();
    setSignedIn(inSession);
    setReady();
    if (inSession) fillProfile();
    setAdminUi();
    mountUserButtons();
    mountAuthForm(false);
    if (typeof window.blancoLoadRank === "function") {
      window.blancoLoadRank();
    }
    if (inSession && typeof window.blancoLoadStamps === "function") {
      window.blancoLoadStamps();
    }
    if (inSession && typeof window.blancoLoadOrders === "function") {
      window.blancoLoadOrders();
    }
    if (typeof window.blancoRenderCollection === "function") {
      window.blancoRenderCollection();
    }
  }

  function bind() {
    document.querySelectorAll("[data-auth-mode]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        var mode = btn.getAttribute("data-auth-mode");
        if (btn.tagName === "A" && btn.getAttribute("href") && btn.getAttribute("href").charAt(0) !== "#") {
          return;
        }
        if (document.getElementById("clerk-sign-in")) {
          event.preventDefault();
          switchAuthMode(mode);
        }
      });
    });
    window.addEventListener("hashchange", function () {
      if (document.getElementById("clerk-sign-in") && !isSignedIn()) {
        mountAuthForm(true);
      }
    });
    document.querySelectorAll("[data-clerk-profile]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.location.href = accountUrl;
      });
    });
    document.querySelectorAll("[data-clerk-signout]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!window.Clerk) return;
        Clerk.signOut({ redirectUrl: homeUrl });
      });
    });
  }

  if (!key || key.indexOf("pk_") !== 0) {
    setSignedIn(false);
    setReady();
    showSetupNote();
    bind();
    return;
  }

  var host = fapiHost(key);
  if (!host) {
    setSignedIn(false);
    setReady();
    showSetupNote();
    console.warn("Clerk publishable key did not contain a Frontend API host.");
    return;
  }

  var loadOpts = {
    appearance: houseAppearance(),
    signInForceRedirectUrl: afterAuthUrl,
    signUpForceRedirectUrl: afterAuthUrl,
    afterSignOutUrl: homeUrl
  };

  setAuthCopy(wantsSignUp());

  loadScript("https://" + host + "/npm/@clerk/ui@1/dist/ui.browser.js")
    .catch(function () {
      return null;
    })
    .then(function () {
      return loadScript(
        "https://" + host + "/npm/@clerk/clerk-js@6/dist/clerk.browser.js",
        { "data-clerk-publishable-key": key }
      );
    })
    .then(function () {
      if (window.__internal_ClerkUICtor) {
        loadOpts.ui = { ClerkUI: window.__internal_ClerkUICtor };
      }
      return Clerk.load(loadOpts);
    })
    .then(function () {
      bind();
      setAuthCopy(wantsSignUp());
      render();
      Clerk.addListener(render);
    })
    .catch(function (err) {
      console.warn("Clerk failed to load", err);
      setSignedIn(false);
      setReady();
      showSetupNote();
    });
})();
