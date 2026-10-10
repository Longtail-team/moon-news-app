// 기사 읽기 시트(T07 PR C, 2026-10-10): 한국어로 / 영어로 → 읽기 시작(3초 뒤 녹음) → 녹음 중(시트가 녹음 막대로 줄고 다른 활동 잠금)
// → 내 낭독 듣기 + "읽기를 완료했어요 / 다시 읽을게요". 녹음 상태는 useRecording(lib/reading), 이 부품은 그리기만 한다.
import { useRef, useState } from "react";
import { ActIcon } from "@/components/student/icons";
import { RATES } from "@/lib/listen/useListening";
import { clock, fmtDuration } from "@/lib/reading/text";
import type { ReadLang } from "@/lib/article/mode";
import type { useRecording } from "@/lib/reading/useRecording";

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
    <path d="M7 4l14 8-14 8z" />
  </svg>
);
const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);
const MicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export function ReadSheet({
  R,
  lang,
  onLang,
  rate,
  onRate,
  estSec,
  maxSec,
  saving,
  onStart,
  onComplete,
}: {
  R: ReturnType<typeof useRecording>;
  lang: ReadLang;
  onLang: (l: ReadLang) => void;
  rate: number;
  onRate: (r: number) => void;
  estSec: number; // 1배 기준 예상 낭독 시간
  maxSec: number;
  saving: boolean;
  onStart: () => void;
  onComplete: () => void;
}) {
  const mine = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  if (R.phase === "rec" || R.phase === "count") {
    const left = maxSec - R.elapsed;
    return (
      <>
        <div className="between">
          <span className="rec">
            <i />
            {lang === "en" ? "영어" : "한국어"}로 읽는 중
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {clock(R.elapsed)} <span className="meta">/ {clock(maxSec)}</span>
          </span>
        </div>
        {left <= 30 && R.phase === "rec" && <div style={{ fontSize: 14, fontWeight: 800, color: "var(--deep)" }}>{Math.ceil(left)}초 남았어요. 시간이 되면 자동으로 멈춰요.</div>}
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <button className="chip" style={{ borderRadius: 12 }} onClick={R.togglePacer}>
            {R.pacerOn ? "하이라이트 끄기" : "하이라이트 켜기"}
          </button>
          {R.pacerOn && (
            <button className="chip" style={{ borderRadius: 12 }} onClick={R.togglePause}>
              {R.pacerPaused ? "다시 움직이기" : "잠깐 멈추기"}
            </button>
          )}
          <button className="textbtn" style={{ marginLeft: "auto", fontSize: 13, textDecoration: "none", color: "var(--sub)" }} onClick={R.cancel}>
            그만두기
          </button>
        </div>
        <button className="cta" disabled={R.phase !== "rec"} onClick={() => void R.stop()}>
          다 읽었어요
        </button>
      </>
    );
  }

  if (R.phase === "done" && R.result) {
    const toggle = () => {
      const a = mine.current;
      if (!a) return;
      if (playing) a.pause();
      else void a.play().then(() => setPlaying(true), () => setPlaying(false));
      if (playing) setPlaying(false);
    };
    return (
      <>
        <div style={{ fontSize: 16, fontWeight: 800 }}>끝까지 읽었어요! 한번 들어볼까요?</div>
        <div className="row">
          <button className="play" onClick={toggle} aria-label={playing ? "내 낭독 멈춤" : "내 낭독 재생"}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>내 낭독</span>
          <span className="meta">{clock(R.result.sec)}</span>
          <audio ref={mine} src={R.result.url} preload="metadata" onEnded={() => setPlaying(false)} />
        </div>
        {R.error && <div className="err">{R.error}</div>}
        <button className="cta" disabled={saving} onClick={() => (mine.current?.pause(), setPlaying(false), onComplete())}>
          {saving ? "저장하는 중…" : "읽기를 완료했어요"}
        </button>
        <button className="btn2" disabled={saving} onClick={() => (mine.current?.pause(), setPlaying(false), R.reset())}>
          다시 읽을게요
        </button>
      </>
    );
  }

  const est = estSec / rate;
  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <button className={`achip${lang === "kr" ? " on" : ""}`} aria-pressed={lang === "kr"} onClick={() => onLang("kr")}>
          <ActIcon type="KR_READING" size={18} />
          한국어로 읽기
        </button>
        <button className={`achip${lang === "en" ? " on" : ""}`} aria-pressed={lang === "en"} onClick={() => onLang("en")}>
          <ActIcon type="EN_READING" size={18} />
          영어로 읽기
        </button>
      </div>
      <div className="rate" role="group" aria-label="하이라이트 속도">
        {RATES.map((r) => (
          <button key={r} className={rate === r ? "on" : ""} aria-pressed={rate === r} onClick={() => onRate(r)}>
            {r}배
          </button>
        ))}
      </div>
      {R.error && <div className="err">{R.error}</div>}
      <div className="help" style={{ textAlign: "center" }}>
        {rate}배 하이라이트로 약 {fmtDuration(est)} · 이어폰을 끼면 녹음이 더 깨끗해요
        {est > maxSec ? ` · ${clock(maxSec)}가 되면 자동으로 멈춰요` : ""}
      </div>
      <button className="cta" onClick={onStart}>
        <MicIcon />
        &nbsp;읽기 시작
      </button>
    </>
  );
}
