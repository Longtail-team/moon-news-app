// 청독량 기록 (2026-10-09 결정): 영어 기사 음원·한영 구간반복을 실제로 소리가 난 시간만큼 쌓는다(반복 포함, 배속이면 실제 들은 시간).
// 청독 화면과 이번 주 자료에서 들은 것. VOCA 구간반복은 VOCA 탭에서 따로 듣고 청독량에 넣지 않는다.
// 음원 <audio>에 붙이면 재생 중 시간을 재서 15초마다, 그리고 멈춤·끝·화면 숨김 때 서버로 보낸다.
// 청독 화면은 같은 도구로 "90% 이상 들은 횟수"도 센다.
export type AudioType = "article_audio" | "kr_en_repeat_audio" | "voca_repeat_audio";

export const isAudioType = (t: string): t is AudioType => t === "article_audio" || t === "kr_en_repeat_audio" || t === "voca_repeat_audio";

const FLUSH_MS = 15_000;
const PASS_RATIO = 0.9; // 90% 이상 들으면 한 번 들은 것으로 (청독 완료 버튼 조건)

type Opts = { week: number; type: AudioType; onPass?: () => void; onTick?: (sec: number) => void };

function send(week: number, type: AudioType, seconds: number): Promise<unknown> {
  if (seconds < 1) return Promise.resolve();
  const body = JSON.stringify({ week, audio: type, seconds: Math.min(120, Math.round(seconds * 10) / 10) });
  // 화면을 떠나는 중에도 보내지도록 keepalive
  return fetch("/api/listening/log", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}

/** 재생 시간 재기. 떼어 내는 함수와 지금까지 쌓인 것을 바로 보내는 함수를 돌려준다 */
export function trackListening(el: HTMLAudioElement, { week, type, onPass, onTick }: Opts): { detach: () => void; flush: () => Promise<void> } {
  let playingSince: number | null = null;
  let pending = 0; // 아직 보내지 않은 초
  let passCounted = false;
  let lastPos = 0;

  const take = () => {
    if (playingSince === null) return;
    const now = performance.now();
    const sec = (now - playingSince) / 1000;
    playingSince = now;
    if (sec > 0 && sec < 60) {
      pending += sec;
      onTick?.(sec);
    }
  };
  // 보내기를 기다릴 수 있게(청독 완료 직전: 누적 시간에 마지막 몇 초까지 들어가도록)
  const inflight = new Set<Promise<unknown>>(); // 멈춤 때 보낸 것까지 기다리기 위해
  const flush = async () => {
    take();
    while (pending >= 1) {
      const part = Math.min(pending, 120);
      const p = send(week, type, part);
      inflight.add(p);
      void p.finally(() => inflight.delete(p));
      pending -= part;
    }
    await Promise.all([...inflight]);
  };
  const onPlay = () => {
    playingSince = performance.now();
  };
  const onStop = () => {
    take();
    playingSince = null;
    void flush();
  };
  const onTime = () => {
    const d = el.duration;
    if (!d || !isFinite(d)) return;
    const pos = el.currentTime;
    // 처음으로 돌아갔으면(반복 재생·되감기) 새로 듣는 것으로
    if (pos < lastPos - d * 0.5 || pos < d * 0.05) passCounted = false;
    lastPos = pos;
    if (!passCounted && pos / d >= PASS_RATIO) {
      passCounted = true;
      onPass?.();
    }
    take();
  };
  const onEnded = () => {
    onStop();
    passCounted = false;
  };
  const onHide = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  const timer = setInterval(() => {
    take();
    if (pending >= FLUSH_MS / 1000) void flush();
  }, FLUSH_MS);

  el.addEventListener("play", onPlay);
  el.addEventListener("playing", onPlay);
  el.addEventListener("pause", onStop);
  el.addEventListener("ended", onEnded);
  el.addEventListener("timeupdate", onTime);
  document.addEventListener("visibilitychange", onHide);
  if (!el.paused) onPlay();

  return {
    flush,
    detach: () => {
      clearInterval(timer);
      onStop();
      el.removeEventListener("play", onPlay);
      el.removeEventListener("playing", onPlay);
      el.removeEventListener("pause", onStop);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTime);
      document.removeEventListener("visibilitychange", onHide);
    },
  };
}

/** 136초 → "2분 16초", 4320초 → "1시간 12분" */
export function fmtListen(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m ? `${h}시간 ${m}분` : `${h}시간`;
  if (m > 0) return `${m}분 ${String(s % 60).padStart(2, "0")}초`;
  return `${s}초`;
}
