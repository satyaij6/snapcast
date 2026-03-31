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

  function selectChip(container, chip) {
    if (!container || !chip) return;
    const chips = container.querySelectorAll(".chip--selectable");
    chips.forEach((c) => c.classList.remove("chip--selected"));
    chip.classList.add("chip--selected");
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

  setIdle();
});


