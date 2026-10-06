// 기기 정보와 기능 지원 여부 (T01 3장 맨 위)

export const AUDIO_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];

export const VIDEO_TYPES = [
  "video/mp4;codecs=avc1,mp4a",
  'video/mp4;codecs="avc1.42E01F,mp4a.40.2"',
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

// T01 5장 시험 환경 중 어디서 열었는지. 목록에 없는 인앱 브라우저도 이름을 남긴다.
export function detectEnvironment(ua: string, standalone: boolean): string {
  if (/KAKAOTALK/i.test(ua)) return "카카오톡 인앱";
  if (/NAVER\(inapp/i.test(ua)) return "네이버 앱 인앱 (시험 목록에 없음)";
  if (/Instagram/i.test(ua)) return "인스타그램 인앱 (시험 목록에 없음)";
  if (/FBAN|FBAV/i.test(ua)) return "페이스북 인앱 (시험 목록에 없음)";
  if (/SamsungBrowser/i.test(ua)) return standalone ? "삼성 인터넷 · 홈 화면" : "삼성 인터넷";
  if (/iPhone|iPad/i.test(ua)) {
    if (standalone) return "아이폰 · 홈 화면에 추가 후 실행";
    if (/CriOS|FxiOS|EdgiOS|Whale/i.test(ua)) return "아이폰 · Safari 아닌 브라우저";
    return "아이폰 · Safari";
  }
  if (/Android/i.test(ua)) {
    if (/; wv\)/.test(ua)) return "안드로이드 · 앱 안 웹뷰 (시험 목록에 없음)";
    if (/Whale/i.test(ua)) return "안드로이드 · 웨일 (시험 목록에 없음)";
    if (/Chrome\//.test(ua)) return standalone ? "안드로이드 Chrome · 홈 화면" : "안드로이드 · Chrome";
  }
  return "기타 (시험 목록에 없음)";
}

export function pickType(list: string[]): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return list.find((t) => MediaRecorder.isTypeSupported(t));
}

function isTypeSupported(t: string): boolean {
  try {
    return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t);
  } catch {
    return false;
  }
}

function canShareFile(file: File): boolean | string {
  if (typeof navigator.canShare !== "function") return "canShare 없음";
  try {
    return navigator.canShare({ files: [file] });
  } catch (e) {
    return String(e);
  }
}

async function videoEncoderSupport(codec: string): Promise<boolean | string> {
  if (typeof VideoEncoder === "undefined") return "VideoEncoder 없음";
  try {
    const r = await VideoEncoder.isConfigSupported({ codec, width: 1080, height: 1350, bitrate: 2_500_000, framerate: 30 });
    return !!r.supported;
  } catch (e) {
    return String(e);
  }
}

async function audioEncoderSupport(codec: string): Promise<boolean | string> {
  if (typeof AudioEncoder === "undefined") return "AudioEncoder 없음";
  try {
    const r = await AudioEncoder.isConfigSupported({ codec, sampleRate: 48000, numberOfChannels: 1, bitrate: 128_000 });
    return !!r.supported;
  } catch (e) {
    return String(e);
  }
}

export async function getDeviceInfo(): Promise<Record<string, unknown>> {
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { standalone?: boolean; userAgentData?: { platform?: string; mobile?: boolean } };
  const dummyMp4 = new File([new Uint8Array(8)], "test.mp4", { type: "video/mp4" });
  const dummyPng = new File([new Uint8Array(8)], "test.png", { type: "image/png" });

  const standalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  return {
    environment: detectEnvironment(ua, standalone),
    userAgent: ua,
    platform: nav.userAgentData?.platform ?? navigator.platform,
    screen: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    kakaoInApp: /KAKAOTALK/i.test(ua),
    standalone,
    isSecureContext: window.isSecureContext,
    getUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
    MediaRecorder: typeof MediaRecorder !== "undefined",
    audioTypes: Object.fromEntries(AUDIO_TYPES.map((t) => [t, isTypeSupported(t)])),
    videoTypes: Object.fromEntries(VIDEO_TYPES.map((t) => [t, isTypeSupported(t)])),
    VideoEncoder: typeof VideoEncoder !== "undefined",
    AudioEncoder: typeof AudioEncoder !== "undefined",
    h264High: await videoEncoderSupport("avc1.640028"),
    h264Baseline: await videoEncoderSupport("avc1.42E028"),
    aacLC: await audioEncoderSupport("mp4a.40.2"),
    canvasCaptureStream: typeof HTMLCanvasElement.prototype.captureStream === "function",
    share: typeof navigator.share === "function",
    canShareMp4: canShareFile(dummyMp4),
    canSharePng: canShareFile(dummyPng),
    crossOriginIsolated: window.crossOriginIsolated,
    preservesPitch: "preservesPitch" in HTMLMediaElement.prototype,
    webkitPreservesPitch: "webkitPreservesPitch" in HTMLMediaElement.prototype,
    clipboardWrite: typeof navigator.clipboard?.writeText === "function",
  };
}
