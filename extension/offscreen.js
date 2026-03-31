import {
  ensureFfmpeg,
  exportGif,
  exportSquare,
  exportVertical,
  transcribeWithWhisper
} from "./processor.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "SNAPCAST_PROCESS_EXPORT") {
    handleExport(message).then(sendResponse);
    return true;
  }

  if (message.type === "SNAPCAST_TRANSCRIBE") {
    handleTranscribe(message).then(sendResponse);
    return true;
  }

  return false;
});

async function handleExport(message) {
  try {
    const input = message.input;
    const format = message.format;
    if (!input || !(input instanceof ArrayBuffer)) {
      throw new Error("Missing input ArrayBuffer");
    }
    if (!format) throw new Error("Missing export format");

    await ensureFfmpeg();

    const bytes = new Uint8Array(input);
    let out;
    let outMime = "video/webm";
    let outExt = "webm";

    if (format === "gif") {
      out = await exportGif(bytes);
      outMime = "image/gif";
      outExt = "gif";
    } else if (format === "vertical") {
      out = await exportVertical(bytes);
      outMime = "video/mp4";
      outExt = "mp4";
    } else if (format === "square") {
      out = await exportSquare(bytes);
      outMime = "video/mp4";
      outExt = "mp4";
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    // Slice to exact bytes (Uint8Array.buffer can be larger than the view)
    const outBytes = out instanceof Uint8Array ? out : new Uint8Array(out);
    const sliced = outBytes.buffer.slice(outBytes.byteOffset, outBytes.byteOffset + outBytes.byteLength);

    return {
      ok: true,
      output: sliced,
      mime: outMime,
      ext: outExt
    };
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : String(err)
    };
  }
}

async function handleTranscribe(message) {
  try {
    const input = message.input;
    if (!input || !(input instanceof ArrayBuffer)) {
      throw new Error("Missing input ArrayBuffer");
    }
    const bytes = new Uint8Array(input);
    const result = await transcribeWithWhisper(bytes);
    return { ok: true, result };
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : String(err)
    };
  }
}

