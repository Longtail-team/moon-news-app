"use client";

// 이번 주 자료 (spec.md 17장, 목업 materials): 주차 고르기 → PDF 받기 · 음원 재생 · 추가 자료 · 라이브
// 열린 주차만 고를 수 있다(주차 시작 = 월 0시). 다음 주차가 열리는 날을 알려 준다.
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { isAudioType, trackListening } from "@/lib/listening";
import type { Materials } from "@/lib/server/materials";
import { TabBar } from "@/components/student/TabBar";

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
const DlIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);

const sec = (t: string) => (
  <div className="meta" style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>
    {t}
  </div>
);

export function MaterialsView({
  m,
  uploadCount,
  nextOpenLabel,
  liveLabels,
  kakao,
  now,
}: {
  m: Materials;
  uploadCount: number;
  nextOpenLabel: string | null;
  liveLabels: Record<string, string>;
  kakao: boolean;
  now: number;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLAudioElement | null>>({});
  const s = m.selected;

  // 청독량: 여기서 영어 기사 음원·한영 구간반복을 들은 시간도 쌓는다(VOCA는 청독이 아니라서 빼고)
  useEffect(() => {
    if (!s) return;
    const ts = s.audios.flatMap((a) => {
      const el = refs.current[a.type];
      return el && isAudioType(a.type) && a.type !== "voca_repeat_audio" ? [trackListening(el, { week: s.week_no, type: a.type })] : [];
    });
    return () => ts.forEach((t) => t.detach());
  }, [s]);

  const toggle = (key: string) => {
    const a = refs.current[key];
    if (!a) return;
    if (playing === key) {
      a.pause();
      setPlaying(null);
      return;
    }
    Object.values(refs.current).forEach((x) => x?.pause());
    void a.play().then(
      () => setPlaying(key),
      () => setPlaying(null),
    );
  };

  return (
    <div className="app">
      <div className="scroll">
        <div className="pad stack" style={{ paddingTop: 22, gap: 10 }}>
          <h1 className="h1">이번 주 자료</h1>
          {m.opened.length > 1 && (
            <div className="chips">
              {m.opened.map((w) => (
                <Link key={w.week_no} className={`chip${s?.week_no === w.week_no ? " on" : ""}`} href={`/materials?week=${w.week_no}`} replace scroll={false}>
                  {w.week_no}주차
                </Link>
              ))}
            </div>
          )}
          {nextOpenLabel && <div className="help">{nextOpenLabel}</div>}
          {kakao && (
            <div className="help" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--tint)", color: "var(--ink)" }}>
              카카오톡 안에서는 내려받기가 안 될 수 있어요. 오른쪽 위 메뉴에서 &apos;다른 브라우저로 열기&apos;를 눌러 주세요.
            </div>
          )}

          {!s ? (
            <div className="card help">아직 열린 자료가 없어요.</div>
          ) : !s.title_en ? (
            <div className="card help">{s.week_no}주차 자료를 준비하고 있어요.</div>
          ) : (
            <>
              <div className="stack" style={{ gap: 2 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{s.title_en}</div>
                {(s.level || s.word_count) && (
                  <div className="meta" style={{ fontSize: 12 }}>
                    {[s.level && `난이도 ${s.level}`, s.word_count && `본문 ${s.word_count}단어`].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>

              {sec("PDF")}
              {s.pdfs.map((p) => (
                <div key={p.type} className="card row" style={{ padding: "12px 14px" }}>
                  <div className="stack" style={{ gap: 2, flex: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{p.label}</span>
                    {p.sub && <span className="meta">{p.sub}</span>}
                  </div>
                  {p.url ? (
                    <a className="chip" style={{ background: "var(--tint)", border: 0, gap: 4, borderRadius: 12, fontWeight: 800 }} href={p.url}>
                      <DlIcon />
                      받기
                    </a>
                  ) : (
                    <span className="meta">준비 중</span>
                  )}
                </div>
              ))}

              {sec("음원")}
              {s.audios.map((a) => (
                <div key={a.type} className="card row" style={{ padding: "10px 14px" }}>
                  <button className="play" disabled={!a.url} onClick={() => toggle(a.type)} aria-label={`${a.label} ${playing === a.type ? "멈춤" : "재생"}`}>
                    {playing === a.type ? <PauseIcon /> : <PlayIcon />}
                  </button>
                  <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{a.label}</div>
                  <div className="meta">{a.url ? (playing === a.type ? "재생 중" : "") : "준비 중"}</div>
                  {a.url && (
                    <audio
                      ref={(el) => void (refs.current[a.type] = el)}
                      src={a.url}
                      preload="none"
                      controlsList="nodownload"
                      onEnded={() => setPlaying(null)}
                    />
                  )}
                </div>
              ))}

              {s.items.length > 0 && (
                <>
                  {sec("더 보기")}
                  {s.items.map((it, i) =>
                    it.kind === "text" ? (
                      <div key={i} className="card stack" style={{ gap: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 800 }}>{it.title}</span>
                        {it.body && <span style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-line" }}>{it.body}</span>}
                      </div>
                    ) : (
                      <a key={i} className="card row" style={{ padding: "12px 14px" }} href={it.url!} target="_blank" rel="noopener noreferrer">
                        <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{it.title}</span>
                        <span style={{ fontSize: 18, fontWeight: 800 }}>›</span>
                      </a>
                    ),
                  )}
                </>
              )}
            </>
          )}

          {m.live.length > 0 && (
            <>
              {sec("라이브")}
              {m.live.map((l) => {
                const start = Date.parse(l.starts_at);
                const open = l.has_zoom && now >= start - 10 * 60e3 && now <= start + 3 * 3600e3; // 시작 10분 전 ~ 시작 후 3시간 (서버 live_click과 같은 기준)
                const replay = l.has_replay && now > start;
                return (
                  <div key={l.session_id} className="row" style={{ padding: "12px 14px", borderRadius: 14, background: "var(--tint)" }}>
                    <span className="stack" style={{ gap: 2, flex: 1 }}>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>새벽달 Zoom Live {l.session_no}회차</span>
                      <span style={{ fontSize: 13 }}>{liveLabels[l.session_id]}</span>
                    </span>
                    {open ? (
                      <a className="chip" style={{ background: "var(--main)", border: 0, borderRadius: 12, fontWeight: 800 }} href={`/live/${l.session_id}`}>
                        입장
                      </a>
                    ) : replay ? (
                      <a className="chip" style={{ background: "var(--white)", border: 0, borderRadius: 12, fontWeight: 800 }} href={`/live/${l.session_id}?replay=1`}>
                        다시보기
                      </a>
                    ) : now < start ? (
                      <span className="meta" style={{ fontSize: 12 }}>
                        10분 전에 열려요
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
      <TabBar active="materials" uploadCount={uploadCount} />
    </div>
  );
}
