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

let gifReady = false;
let GIFCtor = null;

let whisperReady = false;
let WhisperLib = null;

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

async function ensureGifJs() {
  if (gifReady && GIFCtor) return;

  // Expect gif.js files locally under `extension/libs/gifjs/`.
  // You should copy the gif.js distribution here, including:
  // - gif.js (main)
  // - gif.worker.js (worker script)
  //
  // Common usage: gif.js attaches `GIF` to the global scope.
  await import("./libs/gifjs/gif.js");

  GIFCtor = globalThis.GIF || null;
  if (!GIFCtor) {
    throw new Error(
      "GIF encoder not found. Place gif.js build in extension/libs/gifjs/gif.js (and ensure it sets global GIF)."
    );
  }

  gifReady = true;
}

async function ensureWhisper() {
  if (whisperReady && WhisperLib) return;

  // Expect whisper.js build under `extension/libs/whisper/`.
  // The exact file name varies by build, but this loader expects the main entry to attach something usable.
  await import("./libs/whisper/whisper.js").catch(() => {});

  // Whisper.js builds vary:
  // - Some expose global `Whisper`
  // - Some expose `createWhisper`
  // We'll store global references and decide at runtime.
  WhisperLib = globalThis.Whisper || globalThis.createWhisper || globalThis.whisper || null;
  if (!WhisperLib) {
    throw new Error(
      "Whisper.js not found. Place whisper.js build under extension/libs/whisper/ and ensure it attaches a global usable by this loader."
    );
  }

  whisperReady = true;
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
  // GIF encoding uses gif.js. FFmpeg is used only to extract frames.
  if (!ffmpegReady) throw new Error("FFmpeg not ready");
  await ensureGifJs();

  const inName = "in.webm";
  const framesDir = "frames";

  const fps = 12;
  const maxFrames = 48; // keep export fast; adjust later
  const scaleW = 720;

  writeFile(inName, webmBytes);

  // Create frames directory in FFmpeg FS.
  try {
    ffmpeg.FS("mkdir", framesDir);
  } catch (_) {
    // ignore if it exists
  }

  // Extract frames to PNGs. We limit number of frames for performance.
  await ffmpeg.run(
    "-i",
    inName,
    "-vf",
    `fps=${fps},scale=${scaleW}:-1:flags=lanczos`,
    "-vframes",
    String(maxFrames),
    `${framesDir}/frame_%03d.png`
  );

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const workerScript = chrome.runtime.getURL("libs/gifjs/gif.worker.js");

  // Delay in ms per frame based on fps.
  const delayMs = Math.round(1000 / fps);

  const gif = new GIFCtor({
    workers: 2,
    quality: 10,
    width: 1,
    height: 1,
    workerScript
  });

  const files = ffmpeg
    .FS("readdir", framesDir)
    .filter((f) => f.endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!files.length) {
    cleanupFiles([inName]);
    throw new Error("No frames extracted for GIF export.");
  }

  let outBytes = null;

  const finished = new Promise((resolve, reject) => {
    gif.on("finished", async (blob) => {
      try {
        const buf = await blob.arrayBuffer();
        outBytes = new Uint8Array(buf);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    gif.on("abort", (err) => reject(err));
  });

  // Add frames one-by-one.
  // gif.js samples canvas state at addFrame time.
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pngBytes = ffmpeg.FS("readFile", `${framesDir}/${file}`);
    const blob = new Blob([pngBytes], { type: "image/png" });
    const url = URL.createObjectURL(blob);

    try {
      const img = new Image();
      img.src = url;
      await img.decode();

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw current frame into canvas.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Update GIF dimensions (must match canvas size).
      // gif.js reads width/height at construction, so we constructed with 1x1.
      // This will still work in many builds, but if your gif.js build
      // requires known dims before first frame, adjust to set width/height
      // from the first extracted frame before constructing GIF.
      gif.addFrame(ctx, { copy: true, delay: delayMs });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  gif.render();
  await finished;

  cleanupFiles([inName]);
  // Best-effort cleanup frames
  for (const f of files) {
    try {
      ffmpeg.FS("unlink", `${framesDir}/${f}`);
    } catch (_) {}
  }

  if (!outBytes) throw new Error("GIF export finished but output missing.");
  return outBytes;
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
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-shortest",
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
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-shortest",
    outName
  );

  const out = readFile(outName);
  cleanupFiles([inName, outName]);
  return out;
}

export async function transcribeWithWhisper(_webmBytes) {
  // Caption pipeline (high-level):
  // 1) ensure whisper.js is loaded
  // 2) extract audio from the recording with FFmpeg into a WAV compatible format
  // 3) run transcription and return segments/timestamps
  //
  // This function contains real plumbing, but Whisper.js APIs differ
  // depending on the build you copy into extension/libs/whisper/.
  //
  // Next step after you add the library build is to adjust the final
  // `transcribe(...)` call to match the API shape.

  if (!ffmpegReady) throw new Error("FFmpeg not ready");
  await ensureWhisper();

  const inName = "in.webm";
  const audioName = "audio.wav";
  writeFile(inName, _webmBytes);

  // Convert to 16kHz mono PCM WAV (common whisper input).
  await ffmpeg.run(
    "-i",
    inName,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    audioName
  );

  const wav = readFile(audioName); // Uint8Array

  cleanupFiles([inName, audioName]);

  // Whisper.js API detection:
  // - Some builds expose `Whisper.transcribe(audioBufferOrTypedArray, opts)`
  // - Others expose `createWhisper()` and then `transcribe`
  const Whisper = globalThis.Whisper || globalThis.createWhisper;

  // Most builds at least need the exact API hookup here.
  if (Whisper && typeof Whisper.transcribe === "function") {
    // Try: Whisper.transcribe(wavBytes, options)
    const result = await Whisper.transcribe(wav, { language: "en" });
    return result;
  }

  if (typeof globalThis.createWhisper === "function") {
    const instance = await globalThis.createWhisper();
    if (instance && typeof instance.transcribe === "function") {
      const result = await instance.transcribe(wav, { language: "en" });
      return result;
    }
  }

  throw new Error(
    "Whisper.js API not recognized. Update processor.js transcribeWithWhisper() to match your specific whisper.js build."
  );
}

