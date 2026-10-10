"use client";

// VOCA 단어 낭독(spec 6장, 사진 대신 고를 수 있음): 1 듣기 → 2 낭독(3초 카운트다운, 녹음, 하이라이트) → 3 확인(다시 듣기, 제출 확인)
// 한국어·영어 기사 읽기는 합친 기사 화면(components/article)으로 옮겼다(T07 PR C). 녹음 상태는 useRecording.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Material } from "@/lib/server/reading";
import { clock, fmtDuration, timeline, totalSec } from "@/lib/reading/text";
import { useRecording } from "@/lib/reading/useRecording";
import { RATES } from "@/lib/listen/useListening";
import { post, uploadMedia } from "@/lib/client-api";
import { ArticleText } from "./ArticleText";

const RATE_KEY = "nd_rate"; // 고른 속도를 이 기기에 기억 (spec 8장)

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

export function ReadingFlow({ material, vocaAudio, maxSec }: { material: Material; vocaAudio: string | null; maxSec: number }) {
  const router = useRouter();
  const sentences = material.sentences;
  const steps = useMemo(() => timeline(sentences, "en"), [sentences]);
  const [rate, setRate] = useState(1);
  const [single, setSingle] = useState(false);
  const [playing, setPlaying] = useState<"voca" | "mine" | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmUp, setConfirmUp] = useState<boolean | null>(null); // 제출 확인(값: 바로 올리기)
  const audio = useRef<Record<"voca" | "mine", HTMLAudioElement | null>>({ voca: null, mine: null });
  const activity = useRef<Promise<string> | null>(null);
  const R = useRecording({ steps, rate, maxSec });

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(RATE_KEY));
      if (RATES.includes(saved)) setRate(saved);
    } catch {}
  }, []);
  useEffect(() => {
    const a = audio.current.voca;
    if (a) {
      a.playbackRate = rate;
      a.preservesPitch = true;
    }
  }, [rate]);
  const chooseRate = (r: number) => {
    setRate(r);
    try {
      localStorage.setItem(RATE_KEY, String(r));
    } catch {}
  };

  const toggle = (k: "voca" | "mine") => {
    const a = audio.current[k];
    if (!a) return;
    if (playing === k) {
      a.pause();
      setPlaying(null);
      return;
    }
    audio.current.voca?.pause();
    audio.current.mine?.pause();
    a.onended = () => setPlaying(null);
    void a.play().then(() => setPlaying(k), () => setPlaying(null));
  };

  async function begin() {
    audio.current.voca?.pause();
    setPlaying(null);
    if (!(await R.start())) return;
    const p = post<{ activityId: string }>("/api/activity/start", { week: material.week_no, type: "VOCA" }).then((j) => j.activityId);
    p.catch(() => {});
    activity.current = p;
  }

  async function complete(goUp: boolean) {
    if (!R.result || saving || !activity.current) return;
    setConfirmUp(null);
    setSaving(true);
    R.setError(null);
    try {
      const activityId = await activity.current;
      const path = await uploadMedia(activityId, R.result.blob, R.result.mime);
      const c = await post<{ weekNo: number; weekCompleted: number }>("/api/activity/complete", { activityId, path });
      router.push(goUp ? "/upload" : `/?done=${c.weekNo}-${c.weekCompleted}`);
    } catch {
      R.setError("저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. 녹음은 그대로 있어요.");
      setSaving(false);
    }
  }

  const stepBar = (n: number) => (
    <div className="steps">
      {["1 듣기", "2 낭독", "3 확인"].map((t, i) => (
        <div key={t} className={i + 1 === n ? "on" : ""}>
          {t}
        </div>
      ))}
    </div>
  );
  const rateBar = (
    <div className="rate" role="group" aria-label="속도">
      <span>속도</span>
      {RATES.map((r) => (
        <button key={r} className={rate === r ? "on" : ""} aria-pressed={rate === r} onClick={() => chooseRate(r)}>
          {r}배
        </button>
      ))}
    </div>
  );

  // ───────── 2 낭독 ─────────
  if (R.phase === "count" || R.phase === "rec") {
    const left = maxSec - R.elapsed;
    return (
      <div className="app">
        <div className="topbar">
          <button className="back textbtn" style={{ textDecoration: "none", fontSize: 15 }} onClick={R.cancel}>
            ‹ 그만두기
          </button>
        </div>
        {stepBar(2)}
        <div className="pad stack" style={{ paddingTop: 14, gap: 10 }}>
          <div className="between">
            <span className="rec">
              <i />
              녹음 중
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {clock(R.elapsed)} <span className="meta">/ {clock(maxSec)}</span>
            </span>
          </div>
          {left <= 30 && R.phase === "rec" && <div style={{ fontSize: 14, fontWeight: 800, color: "var(--deep)" }}>{Math.ceil(left)}초 남았어요. 시간이 되면 자동으로 멈춰요.</div>}
          <div className="row" style={{ gap: 6 }}>
            <button className="chip" style={{ borderRadius: 12 }} onClick={R.togglePacer}>
              {R.pacerOn ? "하이라이트 끄기" : "하이라이트 켜기"}
            </button>
            {R.pacerOn && (
              <button className="chip" style={{ borderRadius: 12 }} onClick={R.togglePause}>
                {R.pacerPaused ? "다시 움직이기" : "잠깐 멈추기"}
              </button>
            )}
          </div>
        </div>
        <div className="scroll">
          <div className="pad recText" style={{ paddingTop: 12 }}>
            <ArticleText sentences={sentences} hl={R.hl} en slash={false} onlyMain gap={18} />
          </div>
        </div>
        <div className="bottom">
          <button className="cta" disabled={R.phase !== "rec"} onClick={() => void R.stop()}>
            다 읽었어요
          </button>
        </div>
        {R.phase === "count" && (
          <div className="count" role="status">
            <b>{R.count}</b>
            <div style={{ fontSize: 15, fontWeight: 700 }}>곧 녹음이 시작돼요</div>
            <div className="help">하이라이트를 따라 읽어 보세요</div>
          </div>
        )}
      </div>
    );
  }

  // ───────── 3 확인 ─────────
  if (R.phase === "done" && R.result) {
    const after = Math.min(material.week_completed + 1, material.weekly_target);
    const again = () => (audio.current.mine?.pause(), setPlaying(null), R.reset());
    return (
      <div className="app">
        <div className="scroll">
          <div className="topbar">
            <button className="back textbtn" style={{ textDecoration: "none", fontSize: 15 }} onClick={again}>
              ‹ VOCA 단어 낭독
            </button>
            <div className="meta">{material.week_no}주차</div>
          </div>
          {stepBar(3)}
          <div className="pad stack" style={{ paddingTop: 28, gap: 18 }}>
            <h1 className="h1" style={{ fontSize: 26 }}>
              끝까지 읽었어요!
              <br />한번 들어볼까요?
            </h1>
            <div className="card lift row" style={{ padding: 20 }}>
              <button className="play" style={{ width: 56, height: 56 }} onClick={() => toggle("mine")} aria-label={playing === "mine" ? "내 낭독 멈춤" : "내 낭독 재생"}>
                {playing === "mine" ? <PauseIcon /> : <PlayIcon />}
              </button>
              <div className="stack" style={{ gap: 2, flex: 1 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>내 낭독</span>
                <span className="meta">{clock(R.result.sec)}</span>
              </div>
              <audio ref={(el) => void (audio.current.mine = el)} src={R.result.url} preload="metadata" />
            </div>
            <div className="card help" style={{ fontSize: 13 }}>
              완료하면 {material.week_no}주차 학습이{" "}
              <b style={{ color: "var(--ink)" }}>
                {after} / {material.weekly_target}
              </b>
              가 돼요. 인스타에는 나중에 몰아서 올려도 괜찮아요.
            </div>
            {R.error && <div className="err">{R.error}</div>}
          </div>
        </div>
        <div className="bottom stack" style={{ gap: 10 }}>
          <button className="cta" disabled={saving} onClick={() => setConfirmUp(false)}>
            {saving ? "저장하는 중…" : "이대로 완료"}
          </button>
          <button className="btn2" disabled={saving} onClick={() => setConfirmUp(true)}>
            완료하고 바로 올리기
          </button>
          <button className="textbtn" style={{ textDecoration: "none" }} disabled={saving} onClick={again}>
            다시 읽기
          </button>
        </div>
        {confirmUp !== null && (
          <>
            <div className="dim" onClick={() => setConfirmUp(null)} />
            <div className="sheet" role="dialog" aria-modal="true" aria-label="낭독 제출 확인">
              <div className="handle" />
              <h2 className="h1" style={{ fontSize: 22 }}>
                이 낭독으로 제출할까요?
              </h2>
              <div style={{ fontSize: 15, lineHeight: 1.7 }}>제출하면 {material.week_no}주차 학습 1회로 기록돼요. 다시 읽고 싶으면 &apos;다시 읽기&apos;를 눌러 주세요.</div>
              <button className="cta" onClick={() => void complete(confirmUp)}>
                제출하기
              </button>
              <button className="btn2" onClick={() => setConfirmUp(null)}>
                한 번 더 들어볼게요
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ───────── 1 듣기 ─────────
  const est = totalSec(steps) / rate;
  return (
    <div className="app">
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href={`/write/${material.week_no}/voca`}>
            ‹ VOCA 단어 낭독
          </Link>
          <div className="meta">{material.week_no}주차</div>
        </div>
        {stepBar(1)}
        <div className="pad stack" style={{ paddingTop: 14, gap: 10 }}>
          <div className="card row" style={{ padding: "10px 14px" }}>
            <button className="play" disabled={!vocaAudio} onClick={() => toggle("voca")} aria-label={`VOCA 구간반복 음원 ${playing === "voca" ? "멈춤" : "재생"}`}>
              {playing === "voca" ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>VOCA 구간반복 음원</div>
            <div className="meta">{vocaAudio ? (playing === "voca" ? "재생 중" : "") : "음원 준비 중"}</div>
            {vocaAudio && <audio ref={(el) => void (audio.current.voca = el)} src={vocaAudio} preload="metadata" />}
          </div>
          {rateBar}
          <div className="card stack" style={{ gap: 12 }}>
            <div className="between">
              <div style={{ fontSize: 13, fontWeight: 800 }}>이번 주 단어</div>
              <button className="chip" style={{ minHeight: 44, borderRadius: 12, fontSize: 12 }} onClick={() => setSingle(!single)}>
                {single ? "함께 보기" : "단어만 보기"}
              </button>
            </div>
            <ArticleText sentences={sentences} hl={[]} en slash={false} onlyMain={single} />
          </div>
        </div>
      </div>
      <div className="bottom stack" style={{ gap: 6 }}>
        {R.error && <div className="err">{R.error}</div>}
        <div className="help" style={{ textAlign: "center" }}>
          {rate}배로 읽으면 약 {fmtDuration(est)} 걸려요 · 이어폰을 끼면 녹음이 더 깨끗해요
          {est > maxSec ? ` · ${clock(maxSec)}가 되면 자동으로 멈춰요` : ""}
        </div>
        <button className="cta" onClick={() => void begin()}>
          낭독 시작
        </button>
      </div>
    </div>
  );
}
