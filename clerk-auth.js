/* Clerk JS (CDN) for this static site.
   App: app_3ICtW3IyvsokSBEB7HVoxDweHCq
   Quickstart: https://clerk.com/docs/js-frontend/getting-started/quickstart
   Local CLI (OAuth needs a real browser):
     clerk auth login
     clerk init --app app_3ICtW3IyvsokSBEB7HVoxDweHCq */
(function () {
  var key = String(window.CLERK_PUBLISHABLE_KEY || "").trim();
  var appearance = {
    variables: {
      colorPrimary: "#503931",
      colorBackground: "#F3ECE4",
      colorInputBackground: "#E9E1D8",
      colorText: "#503931",
      colorTextOnPrimaryBackground: "#E9E1D8",
      colorNeutral: "#503931",
      borderRadius: "16px",
      fontFamily: "Work Sans, system-ui, sans-serif"
    },
    elements: {
      card: { borderRadius: "22px" },
      headerTitle: {
        fontFamily: "Fraunces, Times New Roman, serif",
        fontWeight: "500"
      },
      formButtonPrimary: {
        backgroundColor: "#503931",
        color: "#E9E1D8",
        borderRadius: "999px",
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

  function missingKey() {
    window.alert(
      "Add your Clerk publishable key (pk_test_… or pk_live_…) to clerk-config.js.\n\nClerk Dashboard → API keys for app app_3ICtW3IyvsokSBEB7HVoxDweHCq.\nNever add CLERK_SECRET_KEY to this site."
    );
  }

  if (!key || key.indexOf("pk_") !== 0) {
    setSignedIn(false);
    setReady();
    document
      .querySelectorAll("[data-clerk-signin], [data-clerk-signup], [data-clerk-profile]")
      .forEach(function (btn) {
        btn.addEventListener("click", missingKey);
      });
    return;
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

  function render() {
    var inSession = !!(window.Clerk && Clerk.isSignedIn);
    setSignedIn(inSession);
    setReady();

    var mount = document.getElementById("clerk-user-button");
    if (!mount || !window.Clerk) return;

    if (inSession) {
      if (mount.getAttribute("data-mounted") !== "true") {
        Clerk.mountUserButton(mount, {
          appearance: appearance,
          userProfileMode: "modal",
          afterSignOutUrl: "/"
        });
        mount.setAttribute("data-mounted", "true");
      }
    } else if (mount.getAttribute("data-mounted") === "true") {
      Clerk.unmountUserButton(mount);
      mount.removeAttribute("data-mounted");
    }
  }

  function bind() {
    document.querySelectorAll("[data-clerk-signin]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        Clerk.openSignIn({ appearance: appearance });
      });
    });
    document.querySelectorAll("[data-clerk-signup]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        Clerk.openSignUp({ appearance: appearance });
      });
    });
    document.querySelectorAll("[data-clerk-profile]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        Clerk.openUserProfile({ appearance: appearance });
      });
    });
  }

  var host = fapiHost(key);
  if (!host) {
    setSignedIn(false);
    setReady();
    console.warn("Clerk publishable key did not contain a Frontend API host.");
    return;
  }

  loadScript("https://" + host + "/npm/@clerk/ui@1/dist/ui.browser.js")
    .then(function () {
      return loadScript(
        "https://" + host + "/npm/@clerk/clerk-js@6/dist/clerk.browser.js",
        { "data-clerk-publishable-key": key }
      );
    })
    .then(function () {
      return Clerk.load({
        appearance: appearance,
        ui: { ClerkUI: window.__internal_ClerkUICtor }
      });
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
    });
})();
