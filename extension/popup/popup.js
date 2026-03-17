document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("statusText");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (!statusEl || !startBtn || !stopBtn) return;

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

  startBtn.addEventListener("click", () => {
    setRecording();
  });

  stopBtn.addEventListener("click", () => {
    setIdle();
  });

  setIdle();
});

