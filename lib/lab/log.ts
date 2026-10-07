// 검사 결과 기록. 모든 검사는 이 형식으로 로그를 남기고, "결과 복사"가 그대로 JSON으로 묶는다.

export type LogEntry = {
  id: number;
  at: string; // ISO 시각
  test: string; // 예: "1 녹음", "3-B 영상"
  ok: boolean;
  ms?: number; // 걸린 시간
  mime?: string; // 파일 형식
  size?: number; // 파일 크기(바이트)
  error?: string;
  detail?: Record<string, unknown>;
};

export type ManualMark = { mark: "" | "○" | "△" | "✕"; memo: string };

export function errorText(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

export function fmtBytes(n?: number): string {
  if (n == null) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function fmtSec(s?: number | null): string {
  if (s == null || !Number.isFinite(s)) return String(s);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m > 0 ? `${m}분 ${r.toFixed(1)}초` : `${r.toFixed(1)}초`;
}

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// 만든 파일을 <audio>/<video>로 열어 메타데이터를 읽는다. 재생 가능 여부와 길이 확인용.
export function probeMedia(url: string, kind: "audio" | "video"): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.muted = true;
    const timer = setTimeout(() => done({ probe: "timeout(8s)" }), 8000);
    function done(r: Record<string, unknown>) {
      clearTimeout(timer);
      el.removeAttribute("src");
      el.load();
      resolve(r);
    }
    el.onloadedmetadata = () => {
      const r: Record<string, unknown> = { elementDuration: Number.isFinite(el.duration) ? round(el.duration) : String(el.duration) };
      if (el instanceof HTMLVideoElement) {
        r.videoWidth = el.videoWidth;
        r.videoHeight = el.videoHeight;
      }
      done(r);
    };
    el.onerror = () => done({ probe: `error code ${el.error?.code ?? "?"}` });
    el.src = url;
  });
}

export function extFromMime(mime: string): string {
  if (mime.includes("mp4")) return mime.startsWith("audio") ? "m4a" : "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  return "bin";
}
