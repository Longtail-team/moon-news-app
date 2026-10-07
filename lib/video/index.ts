// 영상 합성 모듈 (개발 2단계, docs/tasks/V01-영상-합성-모듈.md)
// 1단계 앱은 이 연결 규칙만 부른다. 지금은 자리만 있는 상태이고, 2단계 결과물이 이 폴더를 채운다.

/** 녹음 최대 길이(초). V01 기기 시험으로 확정. 확정 전 임시값 5분 (2026-10-07 결정) */
export const MAX_RECORDING_SEC = 300;

export type MakeVideoInput = {
  audio: Blob; // 휴대폰이 녹음한 그대로 (audio/mp4 또는 audio/webm)
  image: Blob; // 인스타 템플릿 이미지 (1080×1350 PNG)
  fileName: string;
  signal?: AbortSignal;
  onProgress?: (p: { stage: "prepare" | "encode" | "finalize"; ratio: number }) => void;
};

export type MakeVideoResult = { file: File; durationSec: number; method: string; ms: number };

export type VideoErrorCode = "UNSUPPORTED" | "DECODE_FAILED" | "ENCODE_FAILED" | "BACKGROUNDED" | "ABORTED";

export class VideoError extends Error {
  constructor(
    public code: VideoErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VideoError";
  }
}

/** 이 기기에서 영상을 만들 수 있는지. 2단계 전까지는 항상 불가. */
export async function canMakeVideo(): Promise<{ ok: boolean; reason?: string }> {
  return { ok: false, reason: "영상 만들기는 2단계에서 연결돼요" };
}

export async function makeVideo(_input: MakeVideoInput): Promise<MakeVideoResult> {
  void _input;
  throw new VideoError("UNSUPPORTED", "영상 만들기는 2단계에서 연결돼요");
}

/** 사진첩 저장. 공유 창이 되면 공유 창, 안 되면 내려받기. (사진 저장에도 같은 방식을 쓴다) */
export async function saveVideo(file: File): Promise<"shared" | "downloaded" | "cancelled"> {
  return saveFile(file);
}

export async function saveFile(file: File): Promise<"shared" | "downloaded" | "cancelled"> {
  try {
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return "shared";
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return "cancelled";
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
