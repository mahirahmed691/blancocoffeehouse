/* Clerk JS (CDN) for this static site.
   App: app_3ICtW3IyvsokSBEB7HVoxDweHCq
   Quickstart: https://clerk.com/docs/js-frontend/getting-started/quickstart */
(function () {
  var key = String(window.CLERK_PUBLISHABLE_KEY || "").trim();
  var accountUrl = new URL("account.html", window.location.href).href;
  var homeUrl = new URL("index.html", window.location.href).href;
  var appearance = {
    variables: {
      colorPrimary: "#503931",
      colorBackground: "#F3ECE4",
      colorInputBackground: "#E9E1D8",
      colorText: "#503931",
      colorTextOnPrimaryBackground: "#E9E1D8",
      colorNeutral: "#503931",
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
        backgroundColor: "#503931",
        color: "#E9E1D8",
        borderRadius: "1px",
        fontSize: "0.92rem",
        fontWeight: "500"
      },
      userButtonAvatarBox: { width: "2.15rem", height: "2.15rem" }
    }
  };

  function setReady() {
    document.body.classList.add("clerk-ready");
  }

  function setSignedIn(inSession) {
    document.querySelectorAll(".clerk-signed-out").forEach(function (el) {
      el.hidden = !!inSession;
    });
    document.querySelectorAll(".clerk-signed-in").forEach(function (el) {
      el.hidden = !inSession;
    });
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

  function fillProfile() {
    var user = window.Clerk && Clerk.user;
    if (!user) return;
    var emailObj = user.primaryEmailAddress || (user.emailAddresses && user.emailAddresses[0]);
    var name = user.fullName || user.firstName || "member";
    var email = (emailObj && emailObj.emailAddress) || "—";
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
          appearance: appearance,
          userProfileMode: "modal",
          afterSignOutUrl: homeUrl
        });
        el.setAttribute("data-mounted", "true");
      });
  }

  function mountAuthForm() {
    var mount = document.getElementById("clerk-sign-in");
    if (!mount || isSignedIn()) return;
    if (mount.getAttribute("data-mounted") === "true") return;
    var opts = {
      appearance: appearance,
      forceRedirectUrl: accountUrl,
      signInForceRedirectUrl: accountUrl,
      signUpForceRedirectUrl: accountUrl
    };
    if (location.hash === "#sign-up") {
      Clerk.mountSignUp(mount, opts);
    } else {
      Clerk.mountSignIn(mount, opts);
    }
    mount.setAttribute("data-mounted", "true");
  }

  function render() {
    var inSession = isSignedIn();
    setSignedIn(inSession);
    setReady();
    if (inSession) fillProfile();
    mountUserButtons();
    mountAuthForm();
  }

  function bind() {
    document.querySelectorAll("[data-clerk-signin]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!window.Clerk) return;
        Clerk.openSignIn({
          appearance: appearance,
          forceRedirectUrl: accountUrl
        });
      });
    });
    document.querySelectorAll("[data-clerk-signup]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!window.Clerk) return;
        Clerk.openSignUp({
          appearance: appearance,
          forceRedirectUrl: accountUrl
        });
      });
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
    appearance: appearance,
    signInForceRedirectUrl: accountUrl,
    signUpForceRedirectUrl: accountUrl,
    afterSignOutUrl: homeUrl
  };

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
