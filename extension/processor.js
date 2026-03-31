// Offscreen processor for SnapCast.
//
// This is where we run heavyweight WASM tools (FFmpeg.wasm, Whisper.js).
// MV3 service workers are not a good place to run this kind of workload,
// so background.js creates an offscreen document and sends ArrayBuffers here.
//
// NOTE:
// - You must place FFmpeg.wasm assets under `extension/libs/ffmpeg/`
// - You must place Whisper.js assets under `extension/libs/whisper/`
// - This file is written to be "plain JS" and avoids frameworks.

let ffmpegReady = false;
let ffmpeg = null;

export async function ensureFfmpeg() {
  if (ffmpegReady && ffmpeg) return;

  // Expecting @ffmpeg/ffmpeg UMD-ish bundle placed locally:
  // - extension/libs/ffmpeg/ffmpeg.min.js
  // - extension/libs/ffmpeg/core/ffmpeg-core.js
  // - extension/libs/ffmpeg/core/ffmpeg-core.wasm
  // - extension/libs/ffmpeg/core/ffmpeg-core.worker.js
  //
  // You can use the official build outputs from @ffmpeg/ffmpeg.
  await import("./libs/ffmpeg/ffmpeg.min.js");

  // Global signature differs by build. We handle the common ones.
  const FFmpegGlobal = globalThis.FFmpeg || globalThis.createFFmpeg || null;

  if (globalThis.createFFmpeg) {
    ffmpeg = globalThis.createFFmpeg({
      log: false,
      corePath: chrome.runtime.getURL("libs/ffmpeg/core/ffmpeg-core.js")
    });
  } else if (FFmpegGlobal && FFmpegGlobal.createFFmpeg) {
    ffmpeg = FFmpegGlobal.createFFmpeg({
      log: false,
      corePath: chrome.runtime.getURL("libs/ffmpeg/core/ffmpeg-core.js")
    });
  } else {
    throw new Error(
      "FFmpeg loader not found. Place FFmpeg assets in extension/libs/ffmpeg/ (see processor.js notes)."
    );
  }

  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }

  ffmpegReady = true;
}

function writeFile(name, bytes) {
  ffmpeg.FS("writeFile", name, bytes);
}

function readFile(name) {
  return ffmpeg.FS("readFile", name);
}

function cleanupFiles(names) {
  for (const n of names) {
    try {
      ffmpeg.FS("unlink", n);
    } catch (_) {
      // ignore
    }
  }
}

export async function exportGif(webmBytes) {
  if (!ffmpegReady) throw new Error("FFmpeg not ready");

  const inName = "in.webm";
  const outName = "out.gif";

  writeFile(inName, webmBytes);

  // Simple GIF export (quality can be improved with palettegen/paletteuse later)
  await ffmpeg.run(
    "-i",
    inName,
    "-vf",
    "fps=12,scale=720:-1:flags=lanczos",
    "-loop",
    "0",
    outName
  );

  const out = readFile(outName);
  cleanupFiles([inName, outName]);
  return out;
}

export async function exportVertical(webmBytes) {
  if (!ffmpegReady) throw new Error("FFmpeg not ready");

  const inName = "in.webm";
  const outName = "out-vertical.mp4";

  writeFile(inName, webmBytes);

  // Crop to 9:16 centered, then scale to 1080x1920.
  // This uses input dimensions (iw/ih) at runtime.
  await ffmpeg.run(
    "-i",
    inName,
    "-vf",
    "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)':(iw-ow)/2:(ih-oh)/2,scale=1080:1920",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outName
  );

  const out = readFile(outName);
  cleanupFiles([inName, outName]);
  return out;
}

export async function exportSquare(webmBytes) {
  if (!ffmpegReady) throw new Error("FFmpeg not ready");

  const inName = "in.webm";
  const outName = "out-square.mp4";

  writeFile(inName, webmBytes);

  // Crop to 1:1 centered, scale to 1080x1080.
  await ffmpeg.run(
    "-i",
    inName,
    "-vf",
    "crop='min(iw,ih)':'min(iw,ih)':(iw-ow)/2:(ih-oh)/2,scale=1080:1080",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outName
  );

  const out = readFile(outName);
  cleanupFiles([inName, outName]);
  return out;
}

export async function transcribeWithWhisper(_webmBytes) {
  // Placeholder wiring for Whisper.js.
  // We will implement:
  // - extract audio with FFmpeg (to WAV/PCM)
  // - run whisper.js model inference
  // - return segments + timestamps for captions
  //
  // For now we return a stub.
  return {
    engine: "whisper.js",
    segments: [],
    note:
      "Whisper.js integration not yet installed. Next step will add libs + audio extraction + transcription."
  };
}

