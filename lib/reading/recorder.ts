// 마이크 녹음 (T01 결과: audio/mp4 우선, 안 되면 webm/opus)
export type Recorder = {
  mime: string;
  start: () => void;
  stop: () => Promise<{ blob: Blob; mime: string; sec: number }>;
  cancel: () => void;
};

const TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];

/** 마이크 권한을 먼저 받는다(권한 창이 카운트다운을 가리지 않도록). */
export async function openRecorder(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const requested = TYPES.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, { ...(requested ? { mimeType: requested } : {}), audioBitsPerSecond: 64_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  let startedAt = 0;
  const release = () => stream.getTracks().forEach((t) => t.stop());

  return {
    mime: rec.mimeType || requested || "",
    start: () => {
      rec.start(1000);
      startedAt = performance.now();
    },
    stop: () =>
      new Promise((resolve) => {
        const finish = () => {
          release();
          const mime = rec.mimeType || requested || chunks[0]?.type || "audio/mp4";
          resolve({ blob: new Blob(chunks, { type: mime }), mime, sec: (performance.now() - startedAt) / 1000 });
        };
        if (rec.state === "inactive") return finish();
        rec.onstop = finish;
        rec.stop();
      }),
    cancel: () => {
      if (rec.state !== "inactive") rec.stop();
      release();
    },
  };
}

export function micErrorText(e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "마이크를 쓸 수 없어요. 브라우저 설정에서 이 사이트의 마이크를 허용해 주세요. 카카오톡 안이라면 Safari나 Chrome으로 열어 주세요.";
  if (name === "NotFoundError") return "마이크를 찾지 못했어요. 이어폰 마이크나 휴대폰 마이크를 확인해 주세요.";
  return "녹음을 시작하지 못했어요. 페이지를 새로 열어 다시 시도해 주세요.";
}
