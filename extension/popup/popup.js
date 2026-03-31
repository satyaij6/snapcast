document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("statusText");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  const bgContainer = document.getElementById("bgPresets");
  const cursorContainer = document.getElementById("cursorEffects");

  const exportGifBtn = document.getElementById("exportGif");
  const exportVerticalBtn = document.getElementById("exportVertical");
  const exportSquareBtn = document.getElementById("exportSquare");

  if (!statusEl || !startBtn || !stopBtn) return;

  let currentBgPreset = "none";
  let currentCursorEffect = "none";

  function setIdle() {
    statusEl.textContent = "Status: Idle";
    statusEl.classList.remove("popup__status--recording");
    statusEl.classList.add("popup__status--idle");
  }

  function setRecording() {
    statusEl.textContent = "Status: Recording";
    statusEl.classList.remove("popup__status--idle");
    statusEl.classList.add("popup__status--recording");
  }

  function setExporting() {
    statusEl.textContent = "Status: Exporting…";
    statusEl.classList.remove("popup__status--recording");
    statusEl.classList.add("popup__status--idle");
  }

  function selectChip(container, chip) {
    if (!container || !chip) return;
    const chips = container.querySelectorAll(".chip--selectable");
    chips.forEach((c) => c.classList.remove("chip--selected"));
    chip.classList.add("chip--selected");
  }

  function downloadBytes(arrayBuffer, mime, ext) {
    const url = URL.createObjectURL(new Blob([arrayBuffer], { type: mime || "application/octet-stream" }));
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `SnapCast-${stamp}.${ext || "bin"}`;

    // MV3 requires the `downloads` permission to use chrome.downloads.
    // If not available, you can fallback to window.open in dev builds.
    if (chrome.downloads && chrome.downloads.download) {
      chrome.downloads.download({
        url,
        filename,
        saveAs: true
      });
    } else {
      window.open(url, "_blank");
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  // BACKGROUND PRESETS
  if (bgContainer) {
    bgContainer.addEventListener("click", (event) => {
      const chip = event.target.closest(".chip--selectable");
      if (!chip) return;
      const bg = chip.getAttribute("data-bg") || "none";
      currentBgPreset = bg;
      selectChip(bgContainer, chip);
      chrome.runtime.sendMessage({
        type: "SNAPCAST_SET_BG_PRESET",
        preset: currentBgPreset
      });
    });
  }

  // CURSOR EFFECTS
  if (cursorContainer) {
    cursorContainer.addEventListener("click", (event) => {
      const chip = event.target.closest(".chip--selectable");
      if (!chip) return;
      const effect = chip.getAttribute("data-cursor") || "none";
      currentCursorEffect = effect;
      selectChip(cursorContainer, chip);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || typeof tab.id !== "number") return;
        chrome.tabs.sendMessage(tab.id, {
          type: "SNAPCAST_SET_CURSOR_EFFECT",
          effect: currentCursorEffect
        });
      });
    });
  }

  // RECORD CONTROLS
  startBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "SNAPCAST_START_RECORDING",
      bgPreset: currentBgPreset,
      cursorEffect: currentCursorEffect
    });
    setRecording();
  });

  stopBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "SNAPCAST_STOP_RECORDING"
    });
    setIdle();
  });

  // EXPORT BUTTONS
  function requestExport(kind) {
    chrome.runtime.sendMessage({
      type: "SNAPCAST_EXPORT",
      format: kind,
      bgPreset: currentBgPreset,
      cursorEffect: currentCursorEffect
    });
  }

  if (exportGifBtn) {
    exportGifBtn.addEventListener("click", () => requestExport("gif"));
  }
  if (exportVerticalBtn) {
    exportVerticalBtn.addEventListener("click", () => requestExport("vertical"));
  }
  if (exportSquareBtn) {
    exportSquareBtn.addEventListener("click", () => requestExport("square"));
  }

  // Receive export results from background/offscreen.
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "SNAPCAST_EXPORT_RESULT") return;

    if (!message.ok) {
      statusEl.textContent = `Status: Export failed`;
      statusEl.classList.remove("popup__status--recording");
      statusEl.classList.add("popup__status--idle");
      console.error("[SnapCast] Export failed:", message.error);
      return;
    }

    setExporting();
    try {
      if (message.output) {
        downloadBytes(message.output, message.mime, message.ext);
        statusEl.textContent = "Status: Export ready";
      } else {
        statusEl.textContent = "Status: Export missing output";
      }
    } catch (err) {
      statusEl.textContent = "Status: Export error";
      console.error("[SnapCast] Export handling error:", err);
    }
  });

  // Receive Stripe gating requests.
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "SNAPCAST_STRIPE_REQUIRED") return;

    statusEl.textContent = "Status: Premium required (opening checkout…)";

    if (message.checkoutUrl) {
      window.open(message.checkoutUrl, "_blank", "noopener,noreferrer");
    }
  });

  setIdle();
});


