(function () {
  function paint(host, svg) {
    if (!host) return;
    host.innerHTML = "";
    var frame = document.createElement("div");
    frame.className = "stamp-qr-frame";
    frame.setAttribute("aria-hidden", "true");
    if (svg && String(svg).indexOf("<svg") !== -1) {
      frame.innerHTML = svg;
      var mark = document.createElement("img");
      mark.className = "stamp-qr-mark";
      mark.src = "assets/logo.png";
      mark.alt = "";
      mark.width = 72;
      mark.height = 72;
      mark.decoding = "async";
      frame.appendChild(mark);
    }
    host.appendChild(frame);
  }

  window.blancoPaintStampQr = paint;
})();
