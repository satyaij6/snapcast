// Plain-JS recording helper used by background.js
// - Uses MediaRecorder with chrome.tabCapture
// - Leaves hooks for Whisper.js and FFmpeg.wasm processing

const recordings = new Map();

function getRecording(tabId) {
  return recordings.get(tabId);
}

function setRecording(tabId, value) {
  recordings.set(tabId, value);
}

function clearRecording(tabId) {
  recordings.delete(tabId);
}

export async function startRecording(tabId, options) {
  const existing = getRecording(tabId);
  if (existing && existing.mediaRecorder && existing.mediaRecorder.state === "recording") {
    return;
  }

  const captureOptions = {
    audio: true,
    video: true,
    videoConstraints: {
      mandatory: {
        chromeMediaSource: "tab"
      }
    }
  };

  const stream = await new Promise((resolve, reject) => {
    try {
      chrome.tabCapture.capture(captureOptions, (capturedStream) => {
        if (chrome.runtime.lastError || !capturedStream) {
          reject(chrome.runtime.lastError || new Error("No stream captured"));
        } else {
          resolve(capturedStream);
        }
      });
    } catch (err) {
      reject(err);
    }
  });

  const chunks = [];
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp9,opus"
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Placeholder: run Whisper.js locally on the audio track
    // const captions = await runWhisperOnRecording(data);

    // Placeholder: do FFmpeg.wasm processing for export formats
    // const processed = await processWithFFmpeg(data, options.exportFormat);

    chrome.runtime.sendMessage({
      type: "SNAPCAST_RECORDING_COMPLETE",
      tabId,
      // For now we return raw data; popup/background can decide what to do next.
      payload: {
        buffer: data.buffer,
        // captions,
        // processed,
        bgPreset: options?.bgPreset || "none",
        cursorEffect: options?.cursorEffect || "none"
      }
    });

    stream.getTracks().forEach((t) => t.stop());
    clearRecording(tabId);
  };

  mediaRecorder.start();

  setRecording(tabId, {
    mediaRecorder,
    stream,
    chunks,
    options: options || {}
  });
}

export function stopRecording(tabId) {
  const rec = getRecording(tabId);
  if (!rec || !rec.mediaRecorder) return;

  const { mediaRecorder } = rec;
  if (mediaRecorder.state === "inactive") return;
  mediaRecorder.stop();
}

