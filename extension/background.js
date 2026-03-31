// Service worker (MV3) that coordinates recording and export.
// Receives messages from popup.js and delegates to recorder.js.

import { startRecording, stopRecording } from "./recorder.js";

let lastRecording = null; // { tabId, buffer, meta }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  switch (message.type) {
    case "SNAPCAST_START_RECORDING":
      handleStart(message);
      break;
    case "SNAPCAST_STOP_RECORDING":
      handleStop(message);
      break;
    case "SNAPCAST_EXPORT":
      handleExport(message);
      break;
    case "SNAPCAST_RECORDING_COMPLETE":
      handleRecordingComplete(message);
      break;
    default:
      break;
  }

  // Indicate async when needed
  return false;
});

async function ensureOffscreen() {
  // If already created, createDocument will throw; we treat that as OK.
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["BLOBS"],
      justification: "Process recordings with FFmpeg.wasm and Whisper.js"
    });
  } catch (_) {
    // ignore
  }
}

async function handleStart(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== "number") return;

  await startRecording(tab.id, {
    bgPreset: message.bgPreset,
    cursorEffect: message.cursorEffect,
    exportFormat: message.exportFormat || "mp4"
  });
}

function handleStop(message) {
  if (typeof message.tabId === "number") {
    stopRecording(message.tabId);
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (tab && typeof tab.id === "number") {
      stopRecording(tab.id);
    }
  });
}

function handleRecordingComplete(message) {
  // Save last recording in memory so we can export/transcribe.
  // NOTE: MV3 service workers can suspend; later we’ll store metadata in storage
  // and keep the actual bytes in an offscreen document or IndexedDB.
  lastRecording = {
    tabId: message.tabId,
    buffer: message.payload?.buffer || null,
    meta: message.payload || {}
  };

  chrome.runtime.sendMessage({
    type: "SNAPCAST_STATUS",
    status: "complete"
  });
}

async function handleExport(message) {
  if (!lastRecording || !lastRecording.buffer) {
    chrome.runtime.sendMessage({
      type: "SNAPCAST_EXPORT_RESULT",
      ok: false,
      error: "No recording available yet. Record something first."
    });
    return;
  }

  await ensureOffscreen();

  const response = await chrome.runtime.sendMessage({
    type: "SNAPCAST_PROCESS_EXPORT",
    format: message.format,
    input: lastRecording.buffer
  });

  if (!response || !response.ok) {
    chrome.runtime.sendMessage({
      type: "SNAPCAST_EXPORT_RESULT",
      ok: false,
      error: response?.error || "Export failed"
    });
    return;
  }

  chrome.runtime.sendMessage({
    type: "SNAPCAST_EXPORT_RESULT",
    ok: true,
    mime: response.mime,
    ext: response.ext,
    output: response.output
  });
}

