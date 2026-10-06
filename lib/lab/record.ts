// 검사 1. 마이크 녹음
// 녹음 중 일어난 일(화면 꺼짐, 앱 전환, 트랙 끊김)을 경과 초와 함께 events에 남긴다.

import { AUDIO_TYPES, pickType } from "./device";

export type RecordingSession = {
  requestedMime?: string;
  getUserMediaMs: number;
  startedAt: number; // performance.now()
  events: string[];
  stop: () => Promise<{ blob: Blob; mime: string; elapsedSec: number }>;
  isActive: () => boolean;
};

export async function queryMicPermission(): Promise<string> {
  try {
    const s = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return s.state;
  } catch (e) {
    return `조회 불가(${e instanceof Error ? e.name : e})`;
  }
}

export async function startRecording(onEvent: (msg: string) => void): Promise<RecordingSession> {
  const t0 = performance.now();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const getUserMediaMs = Math.round(performance.now() - t0);

  const requestedMime = pickType(AUDIO_TYPES);
  const rec = new MediaRecorder(stream, requestedMime ? { mimeType: requestedMime } : undefined);
  const chunks: Blob[] = [];
  const events: string[] = [];
  let startedAt = 0;
  const log = (msg: string) => {
    const line = `${((performance.now() - startedAt) / 1000).toFixed(1)}s ${msg}`;
    events.push(line);
    onEvent(line);
  };

  const track = stream.getAudioTracks()[0];
  track.onended = () => log("마이크 트랙 끝남(ended)");
  track.onmute = () => log("마이크 트랙 mute");
  track.onunmute = () => log("마이크 트랙 unmute");
  rec.onpause = () => log("recorder pause");
  rec.onresume = () => log("recorder resume");
  rec.onerror = (e) => log(`recorder error ${String((e as Event & { error?: unknown }).error ?? "")}`);
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const onVis = () => log(`화면 ${document.visibilityState}`);
  const onPageHide = () => log("pagehide");
  const onPageShow = () => log("pageshow");
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);

  let resolveStop!: () => void;
  const stopped = new Promise<void>((r) => (resolveStop = r));
  let stoppedAt = 0;
  rec.onstop = () => {
    stoppedAt = performance.now();
    log(`recorder stop (state=${rec.state})`);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    stream.getTracks().forEach((t) => t.stop());
    resolveStop();
  };

  // 1초 단위로 조각을 받아 두면 중간에 끊겨도 그때까지는 남는다.
  rec.start(1000);
  startedAt = performance.now();
  log(`녹음 시작 (요청 ${requestedMime ?? "기본값"}, 실제 ${rec.mimeType || "빈 값"})`);

  return {
    requestedMime,
    getUserMediaMs,
    startedAt,
    events,
    isActive: () => rec.state !== "inactive",
    stop: async () => {
      if (rec.state !== "inactive") rec.stop();
      await stopped;
      const mime = rec.mimeType || requestedMime || chunks[0]?.type || "";
      return { blob: new Blob(chunks, { type: mime }), mime, elapsedSec: (stoppedAt - startedAt) / 1000 };
    },
  };
}

export async function decodeAudio(blob: Blob): Promise<AudioBuffer> {
  const ac = new AudioContext();
  try {
    return await ac.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ac.close();
  }
}
