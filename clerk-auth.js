(function () {
  var key = String(window.CLERK_PUBLISHABLE_KEY || "").trim();
  var appearance = {
    variables: {
      colorPrimary: "#503931",
      colorBackground: "#EFE9E2",
      colorInputBackground: "#E9E1D8",
      colorText: "#503931",
      colorNeutral: "#503931",
      borderRadius: "2px",
      fontFamily: "Work Sans, system-ui, sans-serif"
    }
  };

  function accountUrl() {
    try {
      return new URL("account.html", window.location.href).href;
    } catch (err) {
      return "account.html";
    }
  }

  function redirectProps() {
    var dest = accountUrl();
    return {
      appearance: appearance,
      routing: "hash",
      withSignUp: true,
      forceRedirectUrl: dest,
      fallbackRedirectUrl: dest,
      signUpForceRedirectUrl: dest,
      signUpFallbackRedirectUrl: dest
    };
  }

  function setSignedOut() {
    document.querySelectorAll(".clerk-signed-out").forEach(function (el) {
      el.hidden = false;
    });
    document.querySelectorAll(".clerk-signed-in").forEach(function (el) {
      el.hidden = true;
    });
    document.body.classList.remove("is-signed-in");
    document.body.classList.add("is-signed-out");
  }

  function setSignedIn(on) {
    document.querySelectorAll(".clerk-signed-out").forEach(function (el) {
      el.hidden = on;
    });
    document.querySelectorAll(".clerk-signed-in").forEach(function (el) {
      el.hidden = !on;
    });
    document.body.classList.toggle("is-signed-in", on);
    document.body.classList.toggle("is-signed-out", !on);
  }

  function fillProfile(user) {
    var name = "member";
    var email = "";
    if (user) {
      name = user.fullName || user.firstName || user.username || "member";
      if (user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) {
        email = user.primaryEmailAddress.emailAddress;
      } else if (user.emailAddresses && user.emailAddresses[0]) {
        email = user.emailAddresses[0].emailAddress || "";
      }
    }
    document.querySelectorAll("[data-account-name]").forEach(function (el) {
      el.textContent = name;
    });
    document.querySelectorAll("[data-account-email]").forEach(function (el) {
      el.textContent = email || "—";
    });
  }

  function mountOnce(el, attr, fn) {
    if (!el || el.getAttribute(attr) === "true") return;
    fn(el);
    el.setAttribute(attr, "true");
  }

  function unmountIf(el, attr, fn) {
    if (!el || el.getAttribute(attr) !== "true") return;
    try {
      fn(el);
    } catch (err) {
      /* already gone */
    }
    el.removeAttribute(attr);
  }

  function render() {
    var inSession = !!(window.Clerk && Clerk.isSignedIn);
    setSignedIn(inSession);
    fillProfile(inSession && Clerk.user ? Clerk.user : null);

    document
      .querySelectorAll(".clerk-user-button, [data-clerk-user-button]")
      .forEach(function (mount) {
        if (!inSession) return;
        mountOnce(mount, "data-mounted", function (node) {
          Clerk.mountUserButton(node, { appearance: appearance });
        });
      });

    var signInMount = document.getElementById("clerk-sign-in");
    if (signInMount && window.Clerk) {
      if (inSession) {
        unmountIf(signInMount, "data-mounted", function (node) {
          Clerk.unmountSignIn(node);
        });
      } else {
        mountOnce(signInMount, "data-mounted", function (node) {
          Clerk.mountSignIn(node, redirectProps());
        });
      }
    }
  }

  function bindMissingKey() {
    document
      .querySelectorAll("[data-clerk-signin], [data-clerk-signup]")
      .forEach(function (btn) {
        btn.addEventListener("click", function (event) {
          event.preventDefault();
          window.alert(
            "Add your Clerk publishable key to clerk-config.js (Dashboard → API keys)."
          );
        });
      });
    var setup = document.getElementById("clerk-setup-note");
    if (setup) setup.hidden = false;
  }

  if (!key || key.indexOf("pk_") !== 0) {
    setSignedOut();
    bindMissingKey();
    return;
  }

  function fapiHost(pk) {
    try {
      var payload = pk.split("_")[2] || "";
      var decoded = atob(payload);
      return decoded.replace(/\$/g, "").replace(/\x00/g, "").replace(/\/$/, "");
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

  function bind() {
    document.querySelectorAll("[data-clerk-signin]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        Clerk.openSignIn(redirectProps());
      });
    });
    document.querySelectorAll("[data-clerk-signup]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        Clerk.openSignUp(redirectProps());
      });
    });
    document.querySelectorAll("[data-clerk-signout]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        Clerk.signOut({ redirectUrl: window.location.href });
      });
    });
    document.querySelectorAll("[data-clerk-profile]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        window.location.href = accountUrl();
      });
    });
  }

  var host = fapiHost(key);
  if (!host) {
    setSignedOut();
    bindMissingKey();
    return;
  }

  var dest = accountUrl();

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
        ui: { ClerkUI: window.__internal_ClerkUICtor },
        signInForceRedirectUrl: dest,
        signUpForceRedirectUrl: dest
      });
    })
    .then(function () {
      bind();
      render();
      Clerk.addListener(render);
      if (!Clerk.isSignedIn && location.hash === "#sign-up") {
        Clerk.openSignUp(redirectProps());
      }
    })
    .catch(function (err) {
      console.warn("Clerk failed to load", err);
      setSignedOut();
    });
})();
