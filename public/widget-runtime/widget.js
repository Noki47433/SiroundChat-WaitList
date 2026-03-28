(function () {
  const LOG_PREFIX = "[SiroundChat widget]";
  const log = (...args) => console.info(LOG_PREFIX, ...args);
  const logError = (...args) => console.error(LOG_PREFIX, ...args);
  const currentScript = document.currentScript || document.querySelector('script[data-key], script[data-site-id]');
  const widgetKey = currentScript?.dataset.key || currentScript?.dataset.siteId;
  const baseUrl = currentScript?.dataset.baseUrl || (currentScript?.src ? new URL(currentScript.src).origin : window.location.origin);

  if (!widgetKey) {
    logError("missing key");
    return;
  }

  const closedSize = { width: 66, height: 66 }; // Closed iframe dimensions to match launcher size
  const openSize = { width: 360, height: 840 }; // Open iframe dimensions to fit chat window + launcher

  const mount = () => {
    if (!document.body) {
      log("document.body missing, mount skipped");
      return;
    }

    const existing = document.getElementById("promptly-widget");
    if (existing) {
      log("host already exists");
      return;
    }

    const container = document.createElement("div");
    container.id = "promptly-widget";
    container.dataset.widgetKey = widgetKey;
    container.style.position = "fixed";
    container.style.bottom = "24px";
    container.style.right = "24px";
    container.style.zIndex = "999999";
    container.style.display = "block";
    container.style.overflow = "visible";
    container.style.pointerEvents = "auto";

    document.body.appendChild(container);
    log("host appended", { path: window.location.pathname });

    const shadow = container.attachShadow({ mode: "open" });
    log("shadow root attached");

    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = `${baseUrl}/widget-runtime/widget.css`;
    shadow.appendChild(style);

    const iframe = document.createElement("iframe");
    iframe.src = `${baseUrl}/embed/${widgetKey}`;
    iframe.style.border = "0"; // Remove default iframe border
    iframe.style.background = "transparent"; // Keep iframe canvas transparent
    iframe.style.colorScheme = "light dark";
    iframe.setAttribute("allowtransparency", "true");
    iframe.style.overflow = "hidden"; // Prevent content bleed outside rounded corners
    iframe.style.padding = "0";
    iframe.style.display = "block";
    iframe.setAttribute("allow", "clipboard-write"); // Allow copy from widget UI

    iframe.addEventListener("load", () => {
      log("iframe loaded", { src: iframe.src });
    });
    iframe.addEventListener("error", () => {
      logError("iframe failed", { src: iframe.src });
    });

    const applySize = (size, isOpen) => { // Helper to resize the iframe when open/closed changes
      container.style.width = `${size.width}px`;
      container.style.height = `${size.height}px`;
      container.style.borderRadius = isOpen ? "30px" : "999px";
      container.style.background = isOpen ? "transparent" : "rgba(245, 158, 11, 0.12)";
      container.style.outline = isOpen ? "none" : "2px solid rgba(245, 158, 11, 0.65)";
      container.style.boxShadow = isOpen
        ? "none"
        : "0 12px 28px rgba(15, 23, 42, 0.18)";

      iframe.style.width = `${size.width}px`; // Apply width from size payload
      iframe.style.height = `${size.height}px`; // Apply height from size payload
      iframe.style.borderRadius = isOpen ? "30px" : "999px"; // Match preview radius when open and pill when closed
      iframe.style.boxShadow = "none"; // Avoid extra halo; rely on widget's internal shadows
    };

    applySize(closedSize, false); // Initialize host + iframe to closed size so the launcher is visible
    shadow.appendChild(iframe);
    log("iframe appended", { closedSize });

    window.addEventListener("message", (event) => { // Listen for resize requests from the embedded widget
      const data = event?.data; // Read posted message payload
      if (!data || data.type !== "promptly-widget-resize") return; // Ignore unrelated messages
      if (data.siteId && data.siteId !== widgetKey) return; // Ignore messages meant for other widget instances
      log("resize message", { width: data.width, height: data.height, open: data.open });
      applySize({ width: data.width, height: data.height }, data.open); // Resize host + iframe to match widget state
    });
  };

  if (document.body) {
    mount();
    return;
  }

  log("waiting for DOMContentLoaded");
  window.addEventListener("DOMContentLoaded", mount, { once: true });
})();
