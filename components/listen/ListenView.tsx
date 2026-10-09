"use client";

// 청독 (2026-10-09 결정): 영어 기사 음원·한영 구간반복을 원하는 만큼 듣고(VOCA 구간반복은 VOCA 탭에),
// 하나라도 90% 이상 들으면 "청독 완료"가 켜진다. 완료하면 카드(1080×1350)를 그려 올리고 학습 1회로 센다.
// 듣는 동안의 실제 재생 시간은 청독량으로 모두 쌓인다(반복 포함).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { post, uploadMedia } from "@/lib/client-api";
import { fmtListen, trackListening, type AudioType } from "@/lib/listening";
import { drawListeningCard, type CardData } from "@/lib/listening-card";
import { saveFile } from "@/lib/video";
import { givenName } from "@/lib/format";

export type ListenAudio = { type: AudioType; label: string; src: string };

const RATES = [0.5, 0.8, 1, 1.2];
const RATE_KEY = "nd_rate";

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

export function ListenView({ week, title, audios, weeklyTarget, weekCompleted }: { week: number; title: string; audios: ListenAudio[]; weeklyTarget: number; weekCompleted: number }) {
  const router = useRouter();
  const els = useRef<Partial<Record<AudioType, HTMLAudioElement | null>>>({});
  const trackers = useRef<{ flush: () => Promise<void>; detach: () => void }[]>([]);
  const [playing, setPlaying] = useState<AudioType | null>(null);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(1);
  const [plays, setPlays] = useState<Partial<Record<AudioType, number>>>({});
  const [session, setSession] = useState(0);
  const [progress, setProgress] = useState<Partial<Record<AudioType, number>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 청독 완료 화면: 저장·인스타에 올릴 인스타용 카드(제목 100px)를 그대로 미리 보여 주고 저장한다. 앱·뉴스북용(68/58px)은 서버에 보관
  const [done, setDone] = useState<{ url: string; file: File; weekCompleted: number } | null>(null);

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
      if (RATES.includes(saved)) setRate(saved);
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

  function toggle(t: AudioType) {
    const el = els.current[t];
    if (!el) return;
    for (const a of audios) if (a.type !== t) els.current[a.type]?.pause();
    if (playing === t) {
      el.pause();
      setPlaying(null);
    } else void el.play().then(() => setPlaying(t), () => setPlaying(null));
  }

  const passed = Object.values(plays).some((n) => (n ?? 0) > 0);

  async function complete() {
    if (!passed || busy) return;
    setBusy(true);
    setError(null);
    for (const a of audios) els.current[a.type]?.pause();
    try {
      await Promise.all(trackers.current.map((t) => t.flush()));
      const r = await post<{ card: Omit<CardData, "reporter"> }>("/api/listening/start", { week, plays, sessionSeconds: Math.round(session) });
      const card: CardData = { ...r.card, reporter: givenName(r.card.name) };
      // 앱·뉴스북용(보관)과 인스타용(저장) 두 가지
      const [appBlob, instaBlob] = await Promise.all([drawListeningCard(card, "app"), drawListeningCard(card, "insta")]);
      const path = await uploadMedia(card.activity_id, appBlob, "image/png", "card");
      const c = await post<{ weekCompleted: number }>("/api/activity/complete", { activityId: card.activity_id, path });
      const file = new File([instaBlob], `새벽달영어뉴스_${week}주차_청독.png`, { type: "image/png" });
      const blob = instaBlob;
      setDone({ url: URL.createObjectURL(blob), file, weekCompleted: c.weekCompleted });
    } catch {
      setError("청독 카드를 만들지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. 들은 기록은 남아 있어요.");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="app">
        <div className="scroll">
          <div className="pad stack" style={{ paddingTop: 24, gap: 16 }}>
            <h1 className="h1">청독 완료!</h1>
            <div className="help">
              {week}주차 학습 {Math.min(done.weekCompleted, weeklyTarget)} / {weeklyTarget}. 카드를 저장해서 인스타에 올리면 인증돼요.
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={done.url} alt="청독 카드" style={{ width: "100%", aspectRatio: "4 / 5", borderRadius: 16, border: "1px solid var(--line)" }} />
          </div>
        </div>
        <div className="bottom stack" style={{ gap: 10 }}>
          <button className="cta" onClick={() => void saveFile(done.file)}>
            카드 저장
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Link className="btn2" href="/upload">
              인스타 올리기
            </Link>
            <button className="btn2" onClick={() => router.push(`/?done=${week}-${done.weekCompleted}`)}>
              홈으로
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="app">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@900&display=swap" precedence="default" />
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href={`/activity?week=${week}`}>
            ‹ 청독
          </Link>
          <div className="meta">
            {week}주차 학습 {weekCompleted} / {weeklyTarget}
          </div>
        </div>
        <div className="pad stack" style={{ gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.4 }}>{title}</div>
          <div className="help">음원 하나를 끝까지(90% 이상) 들으면 청독 완료를 누를 수 있어요. 여러 번 들을수록 청독 시간이 쌓여요.</div>
          {audios.length === 0 && <div className="card help">이번 주 음원을 준비하고 있어요.</div>}
          {audios.map((a) => {
            const n = plays[a.type] ?? 0;
            const pct = Math.round((progress[a.type] ?? 0) * 100);
            return (
              <div key={a.type} className="card row" style={{ padding: 14, gap: 12 }}>
                <button className="play" style={{ width: 48, height: 48 }} onClick={() => toggle(a.type)} aria-label={`${a.label} ${playing === a.type ? "멈춤" : "재생"}`}>
                  {playing === a.type ? <PauseIcon /> : <PlayIcon />}
                </button>
                <span className="stack" style={{ gap: 6, flex: 1 }}>
                  <span className="between">
                    <b style={{ fontSize: 15 }}>{a.label}</b>
                    <span className="meta" style={{ fontWeight: 700, color: n ? "var(--deep)" : undefined }}>
                      {n ? `${n}회 들음` : "아직 안 들음"}
                    </span>
                  </span>
                  <span className="bar">
                    <i style={{ width: `${pct}%` }} />
                  </span>
                </span>
                <audio
                  ref={(el) => void (els.current[a.type] = el)}
                  src={a.src}
                  preload="metadata"
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    if (el.duration) setProgress((p) => ({ ...p, [a.type]: el.currentTime / el.duration }));
                  }}
                  onEnded={() => !loop && setPlaying(null)}
                />
              </div>
            );
          })}
          <div className="rate" role="group" aria-label="속도">
            <span>속도</span>
            {RATES.map((r) => (
              <button
                key={r}
                className={rate === r ? "on" : ""}
                aria-pressed={rate === r}
                onClick={() => {
                  setRate(r);
                  try {
                    localStorage.setItem(RATE_KEY, String(r));
                  } catch {}
                }}
              >
                {r}배
              </button>
            ))}
          </div>
          <label className="row" style={{ gap: 8, fontSize: 14, fontWeight: 700, minHeight: 44 }}>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--deep)" }} />
            반복 재생
          </label>
          <div className="card row" style={{ background: "var(--tint)", border: 0 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--deep)" }}>이번 청독</span>
            <b style={{ fontSize: 20 }}>{fmtListen(session)}</b>
          </div>
          {error && <div className="err">{error}</div>}
        </div>
      </div>
      <div className="bottom">
        <button className="cta" disabled={!passed || busy} onClick={() => void complete()}>
          {busy ? "청독 카드를 만드는 중…" : passed ? "청독 완료" : "음원을 끝까지 들으면 완료할 수 있어요"}
        </button>
      </div>
    </div>
  );
}
