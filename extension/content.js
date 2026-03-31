// Injected into pages to support cursor effects and auto-zoom hints.
// For now this is UI-only: highlights clicks and can be extended later.

let currentCursorEffect = "none";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "SNAPCAST_SET_CURSOR_EFFECT") {
    currentCursorEffect = message.effect || "none";
  }

  return false;
});

document.addEventListener("click", (event) => {
  if (currentCursorEffect === "none") return;

  const x = event.clientX;
  const y = event.clientY;

  const ring = document.createElement("div");
  ring.className = "snapcast-cursor-ring snapcast-cursor-ring--" + currentCursorEffect;
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;

  document.body.appendChild(ring);

  setTimeout(() => {
    ring.remove();
  }, 600);
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

