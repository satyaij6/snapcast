// Injected into pages to provide:
// - Cursor effects (visual highlight on click)
// - Auto-zoom on click (visual zoom in the recorded tab)
//
// This file is intentionally "plain JS" and modular:
// - UI is controlled via chrome.runtime messages
// - We keep a small state in variables below

let currentCursorEffect = "none";
let autoZoomEnabled = true;
let currentZoomScale = 1.35;
let currentZoomDurationMs = 750;

let zoomTimer = null;
let savedRootStyles = null;

function getSafeClickPoint(event) {
  return {
    x: event.clientX,
    y: event.clientY
  };
}

function applyAutoZoom(x, y) {
  if (!autoZoomEnabled) return;
  if (typeof x !== "number" || typeof y !== "number") return;

  const root = document.documentElement;
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;

  // Save existing styles once so we can restore them after zoom.
  if (!savedRootStyles) {
    savedRootStyles = {
      transform: root.style.transform || "",
      transformOrigin: root.style.transformOrigin || "",
      transition: root.style.transition || ""
    };
  }

  // Compute a transform that keeps the click point closer to the viewport center.
  // This isn't perfect for all pages, but it's fast and works well enough for UX.
  const tx = (w / 2 - x) * (currentZoomScale - 1);
  const ty = (h / 2 - y) * (currentZoomScale - 1);
  const xPct = (x / w) * 100;
  const yPct = (y / h) * 100;

  root.style.transition = `transform ${Math.min(350, currentZoomDurationMs / 2)}ms ease`;
  root.style.transformOrigin = `${xPct}% ${yPct}%`;
  root.style.transform = `translate(${tx}px, ${ty}px) scale(${currentZoomScale})`;

  if (zoomTimer) window.clearTimeout(zoomTimer);
  zoomTimer = window.setTimeout(() => {
    root.style.transition = savedRootStyles.transition;
    root.style.transformOrigin = savedRootStyles.transformOrigin;
    root.style.transform = savedRootStyles.transform;
    savedRootStyles = null;
    zoomTimer = null;
  }, currentZoomDurationMs);
}

// Cursor ring element (created per click, removed automatically)
function showCursorRing(x, y, effect) {
  if (!x && x !== 0) return;
  if (!y && y !== 0) return;
  if (!effect || effect === "none") return;

  const ring = document.createElement("div");
  ring.className = "snapcast-cursor-ring snapcast-cursor-ring--" + effect;
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;

  document.body.appendChild(ring);

  window.setTimeout(() => {
    ring.remove();
  }, 600);
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) return;

  if (message.type === "SNAPCAST_SET_CURSOR_EFFECT") {
    currentCursorEffect = message.effect || "none";
  }

  if (message.type === "SNAPCAST_SET_AUTO_ZOOM") {
    autoZoomEnabled = message.enabled !== false; // default true
    if (typeof message.scale === "number") currentZoomScale = message.scale;
    if (typeof message.durationMs === "number") currentZoomDurationMs = message.durationMs;
  }

  return false;
});

document.addEventListener("click", (event) => {
  // Only for primary clicks; ignore context menus and drags.
  if (event.button !== 0) return;

  const { x, y } = getSafeClickPoint(event);

  showCursorRing(x, y, currentCursorEffect);
  applyAutoZoom(x, y);
});

// Basic styles injected once for cursor effects
function injectStyles() {
  if (document.getElementById("snapcast-cursor-style")) return;
  const style = document.createElement("style");
  style.id = "snapcast-cursor-style";
  style.textContent = `
    .snapcast-cursor-ring{
      position:fixed;
      width:32px;
      height:32px;
      border-radius:50%;
      pointer-events:none;
      transform:translate(-50%, -50%);
      border:2px solid rgba(59,130,246,.9);
      box-shadow:0 0 0 6px rgba(59,130,246,.35);
      opacity:0;
      animation:snapcast-ring 0.6s ease-out forwards;
      z-index:2147483647;
    }
    .snapcast-cursor-ring--halo{
      border-color:rgba(59,130,246,.9);
      box-shadow:0 0 0 8px rgba(59,130,246,.25);
    }
    .snapcast-cursor-ring--ring{
      border-color:rgba(34,211,238,.9);
      box-shadow:0 0 0 8px rgba(34,211,238,.25);
    }
    .snapcast-cursor-ring--pulse{
      border-color:rgba(248,113,113,.95);
      box-shadow:0 0 0 10px rgba(248,113,113,.30);
    }
    @keyframes snapcast-ring{
      0%{opacity:1; transform:translate(-50%, -50%) scale(0.8);}
      100%{opacity:0; transform:translate(-50%, -50%) scale(1.3);}
    }
  `;
  document.documentElement.appendChild(style);
}

injectStyles();

