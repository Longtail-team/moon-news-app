// 검사 3. 영상 만들기 (이미지 + 녹음 → MP4)
// A: MediaRecorder 실시간 녹화 / B: WebCodecs + Mediabunny / C: ffmpeg.wasm 단일 스레드

import { VIDEO_TYPES, pickType } from "./device";

export const FPS = 30; // 방법 A는 30 고정
export const FPS_OPTIONS = [30, 5, 1]; // 방법 B·C: 정지 화면이라 낮은 fps로 빨라지는지, 인스타가 받는지 비교용
const VIDEO_BITRATE = 2_500_000;
const AUDIO_BITRATE = 128_000;

export type VideoOutput = {
  blob: Blob;
  mime: string;
  detail: Record<string, unknown>;
};

type Progress = (text: string) => void;

function copyCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  c.getContext("2d")!.drawImage(src, 0, 0);
  return c;
}

// ───────── 방법 A ─────────
// AudioContext는 버튼을 누른 직후(사용자 동작 안)에 만들어 넘겨야 아이폰에서 소리가 난다.
export async function makeVideoA(ac: AudioContext, image: HTMLCanvasElement, audio: AudioBuffer, onProgress: Progress): Promise<VideoOutput> {
  const events: string[] = [];
  const t0 = performance.now();
  const ev = (m: string) => events.push(`${((performance.now() - t0) / 1000).toFixed(1)}s ${m}`);

  await ac.resume();
  const canvas = copyCanvas(image);
  const ctx = canvas.getContext("2d")!;
  const vStream = canvas.captureStream(FPS);
  const dest = ac.createMediaStreamDestination();
  const src = ac.createBufferSource();
  src.buffer = audio;
  src.connect(dest);

  const stream = new MediaStream([...vStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const requested = pickType(VIDEO_TYPES);
  if (!requested) ev("지원되는 video mimeType 없음 → 기본값으로 시도");
  const rec = new MediaRecorder(stream, {
    ...(requested ? { mimeType: requested } : {}),
    videoBitsPerSecond: VIDEO_BITRATE,
    audioBitsPerSecond: AUDIO_BITRATE,
  });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  rec.onerror = (e) => ev(`recorder error ${String((e as Event & { error?: unknown }).error ?? "")}`);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  const onVis = () => ev(`화면 ${document.visibilityState}`);
  document.addEventListener("visibilitychange", onVis);

  // 그림이 바뀌지 않으면 프레임을 내보내지 않는 브라우저가 있어, 매 프레임 다시 그리고 구석 1px 색을 아주 조금 바꾼다.
  let tick = 0;
  const draw = setInterval(() => {
    ctx.drawImage(image, 0, 0);
    ctx.fillStyle = tick++ % 2 ? "#E2F6F3" : "#E2F6F2";
    ctx.fillRect(canvas.width - 1, canvas.height - 1, 1, 1);
  }, 1000 / FPS);

  const ended = new Promise<void>((r) => (src.onended = () => r()));
  rec.start(1000);
  const audioStart = ac.currentTime;
  src.start();
  ev(`녹화 시작 (요청 ${requested ?? "기본값"}, 실제 ${rec.mimeType || "빈 값"})`);
  const prog = setInterval(() => onProgress(`녹화 중 ${(ac.currentTime - audioStart).toFixed(0)} / ${audio.duration.toFixed(0)}초`), 500);

  try {
    await ended;
    await new Promise((r) => setTimeout(r, 300));
    rec.stop();
    await stopped;
  } finally {
    clearInterval(draw);
    clearInterval(prog);
    document.removeEventListener("visibilitychange", onVis);
    stream.getTracks().forEach((t) => t.stop());
    void ac.close();
  }
  const mime = rec.mimeType || requested || chunks[0]?.type || "";
  return { blob: new Blob(chunks, { type: mime }), mime, detail: { requested, recorderMime: rec.mimeType, fps: FPS, events } };
}

// ───────── 방법 B ─────────
export async function makeVideoB(image: HTMLCanvasElement, audio: AudioBuffer, fps: number, onProgress: Progress): Promise<VideoOutput> {
  const mb = await import("mediabunny");
  const detail: Record<string, unknown> = {
    VideoEncoder: typeof VideoEncoder !== "undefined",
    AudioEncoder: typeof AudioEncoder !== "undefined",
    fps,
    audioSampleRate: audio.sampleRate,
    audioChannels: audio.numberOfChannels,
  };
  const canAvc = await mb.canEncodeVideo("avc", { width: image.width, height: image.height, bitrate: VIDEO_BITRATE, frameRate: fps });
  const aacOpts = { numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate, bitrate: AUDIO_BITRATE };
  const canAacNative = await mb.canEncodeAudio("aac", aacOpts);
  detail.canEncodeAvc = canAvc;
  detail.canEncodeAacNative = canAacNative;
  if (!canAvc) throw Object.assign(new Error("H.264(avc) 인코딩 미지원"), { detail });

  if (canAacNative) {
    detail.aacEncoder = "기기 내장(WebCodecs)";
  } else {
    // 기기에 AAC 인코더가 없으면 wasm 확장으로 시도하고 그 사실을 기록한다.
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
    detail.aacEncoder = "wasm 확장(@mediabunny/aac-encoder)";
    detail.canEncodeAacWithExtension = await mb.canEncodeAudio("aac", aacOpts);
  }

  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
  const canvas = copyCanvas(image);
  const videoSource = new mb.CanvasSource(canvas, { codec: "avc", bitrate: VIDEO_BITRATE, keyFrameInterval: 2 });
  const audioSource = new mb.AudioBufferSource({ codec: "aac", bitrate: AUDIO_BITRATE });
  output.addVideoTrack(videoSource, { frameRate: fps });
  output.addAudioTrack(audioSource);
  await output.start();

  const tAudio = performance.now();
  await audioSource.add(audio);
  audioSource.close();
  detail.audioEncodeMs = Math.round(performance.now() - tAudio);

  const tVideo = performance.now();
  const frames = Math.ceil(audio.duration * fps);
  for (let i = 0; i < frames; i++) {
    await videoSource.add(i / fps, 1 / fps);
    if (i % fps === 0) onProgress(`인코딩 중 ${(i / fps).toFixed(0)} / ${audio.duration.toFixed(0)}초`);
  }
  videoSource.close();
  detail.videoEncodeMs = Math.round(performance.now() - tVideo);
  detail.frames = frames;

  await output.finalize();
  const buf = (output.target as InstanceType<typeof mb.BufferTarget>).buffer!;
  return { blob: new Blob([buf], { type: "video/mp4" }), mime: "video/mp4 (avc + aac)", detail };
}

// ───────── 방법 C ─────────
const FFMPEG_CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

async function fetchBlobUrl(url: string, type: string): Promise<{ url: string; bytes: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return { url: URL.createObjectURL(new Blob([buf], { type })), bytes: buf.byteLength };
}

export async function makeVideoC(png: Blob, audioBlob: Blob, audioExt: string, fps: number, onProgress: Progress): Promise<VideoOutput> {
  const detail: Record<string, unknown> = { core: FFMPEG_CORE, fps };
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");

  onProgress("ffmpeg 내려받는 중");
  const tDl = performance.now();
  const [core, wasm] = await Promise.all([
    fetchBlobUrl(`${FFMPEG_CORE}/ffmpeg-core.js`, "text/javascript"),
    fetchBlobUrl(`${FFMPEG_CORE}/ffmpeg-core.wasm`, "application/wasm"),
  ]);
  detail.downloadMs = Math.round(performance.now() - tDl);
  detail.downloadBytes = core.bytes + wasm.bytes;

  const ff = new FFmpeg();
  const tail: string[] = [];
  ff.on("log", ({ message }) => {
    tail.push(message);
    if (tail.length > 15) tail.shift();
  });
  ff.on("progress", ({ progress }) => onProgress(`인코딩 중 ${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`));

  try {
    const tLoad = performance.now();
    // 워커는 public/ffmpeg/ 의 원본을 쓴다(scripts/copy-ffmpeg-worker.mjs).
    await ff.load({ coreURL: core.url, wasmURL: wasm.url, classWorkerURL: `${window.location.origin}/ffmpeg/worker.js` });
    detail.loadMs = Math.round(performance.now() - tLoad);

    const audioName = `in.${audioExt}`;
    await ff.writeFile("in.png", new Uint8Array(await png.arrayBuffer()));
    await ff.writeFile(audioName, new Uint8Array(await audioBlob.arrayBuffer()));

    const args = [
      "-loop", "1", "-framerate", String(fps), "-i", "in.png",
      "-i", audioName,
      "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-shortest", "-movflags", "+faststart", "out.mp4",
    ];
    detail.args = args.join(" ");
    const tEnc = performance.now();
    const code = await ff.exec(args);
    detail.encodeMs = Math.round(performance.now() - tEnc);
    detail.exitCode = code;
    if (code !== 0) throw Object.assign(new Error(`ffmpeg 종료 코드 ${code}`), { detail: { ...detail, logTail: tail } });

    const data = (await ff.readFile("out.mp4")) as Uint8Array;
    return { blob: new Blob([new Uint8Array(data)], { type: "video/mp4" }), mime: "video/mp4 (libx264 + aac)", detail };
  } catch (e) {
    detail.logTail = tail;
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { detail });
  } finally {
    ff.terminate();
    URL.revokeObjectURL(core.url);
    URL.revokeObjectURL(wasm.url);
  }
}
