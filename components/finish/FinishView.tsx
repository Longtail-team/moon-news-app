"use client";

// 완주 화면 (spec 9장, 목업 finish): COMPLETE! 뱃지(제때만), 인증 수, 활동별 횟수, 소리 내어 읽은 영어 단어,
// 첫·마지막 낭독(제때·유예만, 녹음 보관 기간 안에는 앱에서 재생 + 인스타 링크), 상장 받기, 내 뉴스북
import Link from "next/link";
import { useRef, useState } from "react";
import type { Finish, Reading } from "@/lib/server/finish";
import { fmtMonthDay } from "@/lib/format";
import { ACT_ORDER, ActIcon, type ActType } from "@/components/student/icons";

const TILE: Record<ActType, [string, string]> = {
  KR_READING: ["한국어", "기사 읽기"],
  EN_READING: ["영어", "기사 읽기"],
  VOCA: ["VOCA", ""],
  SUMMARY: ["기사", "요약"],
  DEBATE: ["찬반", "토론"],
};

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

export function FinishView({ f }: { f: Finish }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<Record<string, HTMLAudioElement | null>>({});
  const q = f.is_current ? "" : `?e=${f.enrollment_id}`;

  function toggle(key: string) {
    const a = audio.current[key];
    if (!a) return;
    Object.entries(audio.current).forEach(([k, el]) => k !== key && el?.pause());
    if (playing === key) {
      a.pause();
      setPlaying(null);
    } else void a.play().then(() => setPlaying(key), () => setPlaying(null));
  }

  const clip = (key: string, label: string, r: Reading) => (
    <div className="card row" style={{ padding: 12 }}>
      {r.has_audio ? (
        <button className="play" style={{ width: 48, height: 48, background: "var(--ink)" }} onClick={() => toggle(key)} aria-label={`${label} ${playing === key ? "멈춤" : "재생"}`}>
          {playing === key ? <PauseIcon /> : <PlayIcon />}
        </button>
      ) : null}
      <span className="stack" style={{ gap: 2, flex: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{label}</span>
        <span className="meta">
          {r.week_no}주차 · {fmtMonthDay(r.completed_at)}
        </span>
      </span>
      {r.post_url && (
        <a className="textbtn" style={{ textDecoration: "none", fontSize: 13, minHeight: 44, display: "flex", alignItems: "center" }} href={r.post_url} target="_blank" rel="noopener noreferrer">
          인스타 ›
        </a>
      )}
      {r.has_audio && <audio ref={(el) => void (audio.current[key] = el)} src={`/media/${r.activity_id}`} preload="none" onEnded={() => setPlaying(null)} />}
    </div>
  );

  return (
    <div className="app">
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href={`/record${q}`}>
            ‹ 내 기록
          </Link>
        </div>
        <div className="pad stack" style={{ paddingTop: 8, gap: 18 }}>
          {f.tier === "on_time" && (
            <span className="pill" style={{ alignSelf: "flex-start", background: "var(--main)", fontSize: 14, letterSpacing: 1, padding: "8px 16px" }}>
              COMPLETE!
            </span>
          )}
          <h1 className="h1" style={{ fontSize: 30, lineHeight: 1.3 }}>
            12주 완주,
            <br />
            정말 해냈어요
          </h1>
          <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 64, fontWeight: 800, lineHeight: 1 }}>{f.verified}</span>
            <span style={{ fontSize: 18, color: "var(--sub)" }}>/ {f.cohort.total_target} 인증</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {ACT_ORDER.map((k) => (
              <div key={k} className="stack" style={{ gap: 4, alignItems: "center", padding: "10px 2px", borderRadius: 12, background: "var(--white)", border: "1px solid var(--line)" }}>
                <span style={{ color: "var(--deep)" }}>
                  <ActIcon type={k} size={20} />
                </span>
                <b style={{ fontSize: 18 }}>{f.acts[k] ?? 0}</b>
                <span style={{ fontSize: 13, color: "var(--sub)", textAlign: "center", lineHeight: 1.3, minHeight: 34 }}>
                  {TILE[k][0]}
                  {TILE[k][1] && <br />}
                  {TILE[k][1]}
                </span>
              </div>
            ))}
          </div>
          <div className="card" style={{ fontSize: 14, lineHeight: 1.6 }}>
            12주 동안 소리 내어 읽은 영어 단어 <b style={{ color: "var(--deep)" }}>{f.reading_words.toLocaleString()}</b>개
          </div>
          {f.first_reading && (
            <div className="stack" style={{ gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>처음과 지금, 들어볼까요?</div>
              {clip("first", "첫 낭독", f.first_reading)}
              {f.last_reading && clip("last", "마지막 낭독", f.last_reading)}
            </div>
          )}
        </div>
      </div>
      <div className="bottom stack" style={{ gap: 10 }}>
        <Link className="btn2" href={`/record/book${q}`}>
          내 영어 뉴스북 보기
        </Link>
        {f.certificate_name ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Link className="btn2" href={`/finish/certificate${q}`}>
              상장 이름 바꾸기
            </Link>
            <a className="cta" href={`/finish/certificate/pdf${q}`}>
              상장 받기
            </a>
          </div>
        ) : (
          <Link className="cta" href={`/finish/certificate${q}`}>
            완주 상장 받기
          </Link>
        )}
      </div>
    </div>
  );
}
