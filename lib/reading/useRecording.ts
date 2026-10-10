// 낭독 녹음 상태(기존 components/reading/ReadingFlow에서 옮김, T07 PR C). 기사 읽기 시트와 VOCA 단어 낭독이 함께 쓴다.
// 3초 카운트다운 → 녹음 → (최대 길이에서 자동 정지, 잘라내지 않음) → 결과. 녹음 중 하이라이트 페이서(속도 반영, 끄기·잠깐 멈추기).
import { useCallback, useEffect, useRef, useState } from "react";
import { micErrorText, openRecorder, type Recorder } from "./recorder";
import type { Step } from "./text";

export type RecPhase = "idle" | "count" | "rec" | "done";
export type RecResult = { blob: Blob; url: string; mime: string; sec: number };

export function useRecording({ steps, rate, maxSec }: { steps: Step[]; rate: number; maxSec: number }) {
  const [phase, setPhase] = useState<RecPhase>("idle");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [hl, setHl] = useState<string[]>([]);
  const [pacerOn, setPacerOn] = useState(true);
  const [pacerPaused, setPacerPaused] = useState(false);
  const [result, setResult] = useState<RecResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<Recorder | null>(null);
  const rateRef = useRef(rate);
  const stepsRef = useRef(steps);
  const pacer = useRef<{ i: number; t: ReturnType<typeof setTimeout> | null }>({ i: 0, t: null });
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const stopRef = useRef<() => void>(() => {});
  const pacerOnRef = useRef(true);
  rateRef.current = rate;
  stepsRef.current = steps;
  pacerOnRef.current = pacerOn;

  const pacerStop = useCallback(() => {
    if (pacer.current.t) clearTimeout(pacer.current.t);
    pacer.current.t = null;
  }, []);
  const pacerRun = useCallback(() => {
    pacerStop();
    const s = stepsRef.current[pacer.current.i];
    if (!s) {
      setHl([]);
      return;
    }
    setHl(s.ids);
    pacer.current.t = setTimeout(() => {
      pacer.current.i += 1;
      pacerRun();
    }, (s.d * 1000) / rateRef.current);
  }, [pacerStop]);

  const clearTimers = useCallback(() => {
    pacerStop();
    if (tickRef.current) clearInterval(tickRef.current);
    if (countRef.current) clearInterval(countRef.current);
    tickRef.current = null;
    countRef.current = null;
  }, [pacerStop]);

  /** 녹음 끝 → 결과 */
  const stop = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    clearTimers();
    setHl([]);
    const r = await rec.stop();
    setResult({ ...r, url: URL.createObjectURL(r.blob) });
    setPhase("done");
  }, [clearTimers]);
  stopRef.current = () => void stop();

  useEffect(
    () => () => {
      clearTimers();
      recRef.current?.cancel();
    },
    [clearTimers],
  );

  /** 마이크를 열고 3초 뒤 녹음 시작. 마이크를 못 열면 false */
  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    setHl([]);
    try {
      recRef.current = await openRecorder();
    } catch (e) {
      setError(micErrorText(e));
      return false;
    }
    setPhase("count");
    setCount(3);
    let n = 3;
    countRef.current = setInterval(() => {
      n -= 1;
      if (n > 0) return setCount(n);
      if (countRef.current) clearInterval(countRef.current);
      countRef.current = null;
      const rec = recRef.current;
      if (!rec) return;
      rec.start();
      startedAt.current = performance.now();
      setElapsed(0);
      setPhase("rec");
      setPacerPaused(false);
      pacer.current.i = 0;
      if (pacerOnRef.current) pacerRun();
      tickRef.current = setInterval(() => {
        const sec = (performance.now() - startedAt.current) / 1000;
        setElapsed(sec);
        if (sec >= maxSec) stopRef.current(); // 최대 길이에서 자동 정지(잘라내지 않는다)
      }, 250);
    }, 1000);
    return true;
  }, [maxSec, pacerRun]);

  /** 녹음 그만두기(저장 안 함) */
  const cancel = useCallback(() => {
    clearTimers();
    recRef.current?.cancel();
    recRef.current = null;
    setHl([]);
    setPhase("idle");
  }, [clearTimers]);

  /** 다시 읽기: 결과를 버리고 처음으로 */
  const reset = useCallback(() => {
    setResult((r) => {
      if (r) URL.revokeObjectURL(r.url);
      return null;
    });
    setError(null);
    setPhase("idle");
  }, []);

  const togglePacer = useCallback(() => {
    if (pacerOn) {
      pacerStop();
      setHl([]);
    } else if (phase === "rec" && !pacerPaused) pacerRun();
    setPacerOn(!pacerOn);
  }, [pacerOn, phase, pacerPaused, pacerRun, pacerStop]);

  const togglePause = useCallback(() => {
    if (pacerPaused) pacerRun();
    else pacerStop();
    setPacerPaused(!pacerPaused);
  }, [pacerPaused, pacerRun, pacerStop]);

  return { phase, count, elapsed, hl, pacerOn, pacerPaused, result, error, setError, start, stop, cancel, reset, togglePacer, togglePause };
}
