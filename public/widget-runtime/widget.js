(function () {
  const currentScript = document.currentScript || document.querySelector('script[data-key], script[data-site-id]');
  const widgetKey = currentScript?.dataset.key || currentScript?.dataset.siteId;
  const baseUrl = currentScript?.dataset.baseUrl || (currentScript?.src ? new URL(currentScript.src).origin : window.location.origin);

  if (!widgetKey) {
    console.error("SiroundChat widget missing key");
    return;
  }

  const container = document.createElement("div");
  container.id = "promptly-widget";
  container.style.position = "fixed";
  container.style.bottom = "24px";
  container.style.right = "24px";
  container.style.zIndex = "999999";
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: "open" });
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = `${baseUrl}/widget-runtime/widget.css`;
  shadow.appendChild(style);

  const iframe = document.createElement("iframe");
  const closedSize = { width: 66, height: 66 }; // Closed iframe dimensions to match launcher size
  const openSize = { width: 360, height: 840 }; // Open iframe dimensions to fit chat window + launcher
  iframe.src = `${baseUrl}/embed/${widgetKey}`;
  iframe.style.border = "0"; // Remove default iframe border
  iframe.style.background = "transparent"; // Keep iframe canvas transparent
  iframe.style.colorScheme = "light dark";
  iframe.setAttribute("allowtransparency", "true");
  iframe.style.overflow = "hidden"; // Prevent content bleed outside rounded corners
  iframe.style.padding = "0";
  iframe.style.display = "block";
  iframe.setAttribute("allow", "clipboard-write"); // Allow copy from widget UI

  const applySize = (size, isOpen) => { // Helper to resize the iframe when open/closed changes
    iframe.style.width = `${size.width}px`; // Apply width from size payload
    iframe.style.height = `${size.height}px`; // Apply height from size payload
    iframe.style.borderRadius = isOpen ? "30px" : "999px"; // Match preview radius when open and pill when closed
    iframe.style.boxShadow = "none"; // Avoid extra halo; rely on widget's internal shadows
  };

  applySize(closedSize, false); // Initialize iframe to closed size so only the icon shows
  shadow.appendChild(iframe);

  window.addEventListener("message", (event) => { // Listen for resize requests from the embedded widget
    const data = event?.data; // Read posted message payload
    if (!data || data.type !== "promptly-widget-resize") return; // Ignore unrelated messages
    if (data.siteId && data.siteId !== widgetKey) return; // Ignore messages meant for other widget instances
    applySize({ width: data.width, height: data.height }, data.open); // Resize iframe to match widget state
  });
})();
