(function () {
  var root = document.getElementById("gallery-live");
  if (!root) return;

  function supabaseConfig() {
    var url = String(window.HOUSE_SUPABASE_URL || "").replace(/\/$/, "");
    var key = String(window.HOUSE_SUPABASE_ANON_KEY || "").trim();
    if (!url || !key) return null;
    return { url: url, key: key };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function publicUrl(path) {
    var cfg = supabaseConfig();
    if (!cfg || !path) return "";
    return cfg.url + "/storage/v1/object/public/gallery/" + path;
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

  function render(shots) {
    if (!shots.length) {
      root.innerHTML = "";
      root.hidden = true;
      return;
    }
    root.hidden = false;
    root.innerHTML = shots
      .map(function (shot, i) {
        var src = publicUrl(shot.path);
        var alt = shot.alt || shot.caption || "From the house.";
        var added = addedLine(shot.created_at);
        var span = i % 5 === 0 ? " span-tall" : i % 7 === 0 ? " span-hero" : "";
        return (
          '<li class="' +
          span.trim() +
          '" data-kind="' +
          escapeHtml(shot.kind || "house") +
          '">' +
          '<button type="button" class="gallery-open" aria-haspopup="dialog"' +
          (added ? ' data-added="' + escapeHtml(added) + '"' : "") +
          ">" +
          '<img src="' +
          escapeHtml(src) +
          '" alt="' +
          escapeHtml(alt) +
          '" width="1350" height="1800" loading="lazy" decoding="async" />' +
          (added ? '<span class="gallery-added">' + escapeHtml(added) + "</span>" : "") +
          "</button>" +
          "</li>"
        );
      })
      .join("");
    if (typeof window.blancoRefreshGallery === "function") {
      window.blancoRefreshGallery();
    }
  }

  var cfg = supabaseConfig();
  if (!cfg) return;

  fetch(cfg.url + "/rest/v1/gallery_shots?select=*&order=sort.desc,created_at.desc", {
    headers: {
      apikey: cfg.key,
      Authorization: "Bearer " + cfg.key
    }
  })
    .then(function (res) {
      if (!res.ok) throw new Error("Gallery could not load");
      return res.json();
    })
    .then(function (rows) {
      render(rows || []);
    })
    .catch(function () {
      /* Printed gallery stays put. */
    });
})();
