// 청독 재생 상태(기존 components/listen/ListenView에서 옮김, T07 PR B). 화면 부품은 이 훅이 주는 값으로 그리기만 한다.
// - 음원별 재생·멈춤(한 번에 하나), 진행, 90% 들은 횟수, 이번 청독 시간(실제 재생 시간, 반복·배속 반영)
// - 속도는 기기(브라우저)에 기억, 반복 재생
// - 청독 하이라이트: 재생 위치에 맞춰 칠할 조각(영어 음원 = 끊어 읽기 구, 한영 = 한국어 → 영어 2회)
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { trackListening, type AudioType } from "@/lib/listening";
import { krEnTimeline, stepAt, timeline, type Sentence } from "@/lib/reading/text";

export type ListenAudio = { type: AudioType; label: string; src: string };

export const RATES = [0.5, 0.8, 1, 1.2];
const RATE_KEY = "nd_rate";

export function useListening({ week, audios, sentences }: { week: number; audios: ListenAudio[]; sentences: Sentence[] }) {
  const els = useRef<Partial<Record<AudioType, HTMLAudioElement | null>>>({});
  const trackers = useRef<{ flush: () => Promise<void>; detach: () => void }[]>([]);
  const [playing, setPlaying] = useState<AudioType | null>(null);
  const [loop, setLoop] = useState(false);
  const [rate, setRateState] = useState(1);
  const [plays, setPlays] = useState<Partial<Record<AudioType, number>>>({});
  const [session, setSession] = useState(0);
  const [progress, setProgress] = useState<Partial<Record<AudioType, number>>>({});
  const [hl, setHl] = useState<string[]>([]);

  // 하이라이트: 재생 중인 음원 위치에 맞춰
  useEffect(() => {
    if (!playing) {
      setHl([]);
      return;
    }
    const el = els.current[playing];
    const steps = playing === "kr_en_repeat_audio" ? krEnTimeline(sentences) : timeline(sentences, "en");
    let raf = 0;
    const tick = () => {
      if (el && el.duration > 0) setHl(stepAt(steps, el.currentTime / el.duration)?.ids ?? []);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, sentences]);

  // 재생 시간 재기와 90% 들은 횟수
  useEffect(() => {
    trackers.current = audios.flatMap((a) => {
      const el = els.current[a.type];
      if (!el) return [];
      return [
        trackListening(el, {
          week,
          type: a.type,
          onPass: () => setPlays((p) => ({ ...p, [a.type]: (p[a.type] ?? 0) + 1 })),
          onTick: (s) => setSession((x) => x + s),
        }),
      ];
    });
    return () => trackers.current.forEach((t) => t.detach());
  }, [audios, week]);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(RATE_KEY));
      if (RATES.includes(saved)) setRateState(saved);
    } catch {}
  }, []);
  useEffect(() => {
    for (const a of audios) {
      const el = els.current[a.type];
      if (el) {
        el.playbackRate = rate;
        el.preservesPitch = true;
        el.loop = loop;
      }
    }
  }, [rate, loop, audios]);

  const setRate = useCallback((r: number) => {
    setRateState(r);
    try {
      localStorage.setItem(RATE_KEY, String(r));
    } catch {}
  }, []);

  const pauseAll = useCallback(() => {
    for (const a of audios) els.current[a.type]?.pause();
    setPlaying(null);
  }, [audios]);

  const toggle = useCallback(
    (t: AudioType) => {
      const el = els.current[t];
      if (!el) return;
      for (const a of audios) if (a.type !== t) els.current[a.type]?.pause();
      if (playing === t) {
        el.pause();
        setPlaying(null);
      } else void el.play().then(() => setPlaying(t), () => setPlaying(null));
    },
    [audios, playing],
  );

  /** <audio> 하나에 붙일 값들 */
  const audioProps = (t: AudioType) => ({
    ref: (el: HTMLAudioElement | null) => void (els.current[t] = el),
    preload: "metadata" as const,
    onTimeUpdate: (e: SyntheticEvent<HTMLAudioElement>) => {
      const el = e.currentTarget;
      if (el.duration) setProgress((p) => ({ ...p, [t]: el.currentTime / el.duration }));
    },
    onEnded: () => !loop && setPlaying(null),
  });

  const flush = () => Promise.all(trackers.current.map((t) => t.flush()));
  const passed = Object.values(plays).some((n) => (n ?? 0) > 0);

  return { playing, toggle, pauseAll, plays, progress, session, rate, setRate, loop, setLoop, hl, passed, flush, audioProps };
}
