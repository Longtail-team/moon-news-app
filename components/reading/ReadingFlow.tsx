"use client";

// 낭독 활동 루프 (spec.md 8장): 1 듣기 → 2 낭독(3초 카운트다운, 녹음, 하이라이트) → 3 확인(다시 듣기, 완료)
// 녹음 파일은 서버가 준 짧은 유효시간 주소로 Storage 비공개 버킷에 바로 올린다. 영상 만들기는 2단계(V01).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AudioSrc, Material } from "@/lib/server/reading";
import { chunksOf, clock, enId, fmtDuration, koId, paragraphs, timeline, totalSec, type Sentence, type Step } from "@/lib/reading/text";
import { micErrorText, openRecorder, type Recorder } from "@/lib/reading/recorder";
import { post, uploadMedia } from "@/lib/client-api";
import { trackListening, type AudioType as ListenType } from "@/lib/listening";

// 청독량: 읽기 화면 음원으로 들은 시간도 쌓는다(2026-10-09)
const LISTEN_TYPE: Record<string, ListenType> = { article: "article_audio", krEn: "kr_en_repeat_audio", voca: "voca_repeat_audio" };

type Kind = "en" | "kr" | "voca";
type Phase = "listen" | "count" | "record" | "review";
type AudioKey = string; // 음원 key 또는 "mine"(내 낭독)

const RATES = [0.5, 0.8, 1, 1.2];
const RATE_KEY = "nd_rate"; // 고른 속도를 이 기기에 기억 (spec 8장)
const NAME: Record<Kind, string> = { en: "영어 기사 읽기", kr: "한국어 기사 읽기", voca: "VOCA 단어 낭독" };
const TYPE: Record<Kind, string> = { en: "EN_READING", kr: "KR_READING", voca: "VOCA" };

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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
const MicIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

// 한영 구간반복 음원의 하이라이트 순서: 한국어 문장 → 영어 문장 2회 (spec 8장)
function krEnTimeline(sentences: Sentence[]): Step[] {
  const ko = timeline(sentences, "ko");
  const en = timeline(sentences, "en");
  const q: Step[] = [];
  sentences.forEach((s, si) => {
    const ids = chunksOf(s).map((_, ci) => enId(si, ci));
    const d = en.filter((x) => x.ids[0].startsWith(`e-${si}-`)).reduce((n, x) => n + x.d, 0) + 0.4;
    q.push(ko[si], { ids, d }, { ids, d });
  });
  return q;
}

/** 진행 비율(0~1)에 해당하는 조각 */
function stepAt(steps: Step[], ratio: number): Step | undefined {
  const total = totalSec(steps);
  let t = ratio * total;
  for (const s of steps) {
    if (t < s.d) return s;
    t -= s.d;
  }
  return undefined;
}

export function ReadingFlow({
  kind,
  material,
  audios,
  maxSec,
  learnerName,
  deadline,
  articlePdf = null,
  preQuestion = null,
}: {
  kind: Kind;
  material: Material;
  audios: AudioSrc[];
  maxSec: number;
  learnerName: string;
  deadline: string;
  articlePdf?: string | null; // 기사 PDF 받기 (spec 17장: 낭독 화면 원문 카드)
  preQuestion?: string | null; // 듣기 전 질문: 듣기 단계에 보여 주기만 한다(답은 받지 않음)
}) {
  const router = useRouter();
  const en = kind !== "kr"; // 영어가 주인 화면 (영어 낭독, VOCA 단어)
  const sentences = material.sentences;
  const readSteps = useMemo(() => timeline(sentences, en ? "en" : "ko"), [sentences, en]);
  const readTotal = useMemo(() => totalSec(readSteps), [readSteps]);

  const [phase, setPhase] = useState<Phase>("listen");
  const [rate, setRate] = useState(1);
  const [slash, setSlash] = useState(false);
  const [single, setSingle] = useState(false);
  const [hl, setHl] = useState<string[]>([]);
  const [playing, setPlaying] = useState<AudioKey | null>(null);
  const [pacerOn, setPacerOn] = useState(true);
  const [pacerPaused, setPacerPaused] = useState(false);
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string; mime: string; sec: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [popupTo, setPopupTo] = useState<string | null>(null);
  // 제출 확인: 고른 낭독만 학습 1회로 센다 (2026-10-09 결정). 값은 "완료하고 바로 올리기"를 눌렀는지
  const [confirmUp, setConfirmUp] = useState<boolean | null>(null);

  const recRef = useRef<Recorder | null>(null);
  const activityRef = useRef<Promise<string> | null>(null);
  const rateRef = useRef(1);
  const pacer = useRef<{ i: number; t: ReturnType<typeof setTimeout> | null }>({ i: 0, t: null });
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const audioRefs = useRef<Record<AudioKey, HTMLAudioElement | null>>({});
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    const ts = audios.flatMap((a) => {
      const el = audioRefs.current[a.key];
      const type = LISTEN_TYPE[a.key];
      return el && type ? [trackListening(el, { week: material.week_no, type })] : [];
    });
    return () => ts.forEach((t) => t.detach());
  }, [audios, material.week_no, phase]);

  // 속도 기억
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(RATE_KEY));
      if (RATES.includes(saved)) setRate(saved);
    } catch {}
  }, []);
  useEffect(() => {
    rateRef.current = rate;
    for (const k of audios.map((x) => x.key)) {
      const a = audioRefs.current[k];
      if (a) {
        a.playbackRate = rate;
        a.preservesPitch = true; // 재생 속도만 바꾸고 목소리 높이는 유지
      }
    }
  }, [rate, audios]);
  const chooseRate = (r: number) => {
    setRate(r);
    try {
      localStorage.setItem(RATE_KEY, String(r));
    } catch {}
  };

  // 칠한 조각이 화면 밖이면 보이게 스크롤
  useEffect(() => {
    if (!hl[0]) return;
    const el = document.getElementById(hl[0]);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 120 || r.bottom > window.innerHeight - 140) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [hl]);

  // ───────── 1 듣기: 음원 재생 위치에 맞춰 칠하기 ─────────
  // 시간 정보 파일이 생기기 전까지는 예상 시간 비율로 맞춘다.
  useEffect(() => {
    const how = audios.find((x) => x.key === playing)?.highlight;
    if (!playing || !how) return;
    const a = audioRefs.current[playing];
    const steps = how === "en" ? timeline(sentences, "en") : krEnTimeline(sentences);
    let raf = 0;
    const loop = () => {
      if (a && a.duration > 0) setHl(stepAt(steps, a.currentTime / a.duration)?.ids ?? []);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, sentences, audios]);

  const togglePlay = (key: AudioKey) => {
    const a = audioRefs.current[key];
    if (!a) return;
    if (playing === key) {
      a.pause();
      setPlaying(null);
      if (key !== "mine") setHl([]);
      return;
    }
    for (const k of Object.keys(audioRefs.current)) audioRefs.current[k]?.pause();
    a.onended = () => {
      setPlaying(null);
      setHl([]);
    };
    void a.play().then(
      () => setPlaying(key),
      () => setPlaying(null),
    );
  };

  // ───────── 2 낭독: 하이라이트 페이서 ─────────
  const pacerStop = useCallback(() => {
    if (pacer.current.t) clearTimeout(pacer.current.t);
    pacer.current.t = null;
  }, []);
  const pacerRun = useCallback(() => {
    pacerStop();
    const s = readSteps[pacer.current.i];
    if (!s) {
      setHl([]);
      return;
    }
    setHl(s.ids);
    pacer.current.t = setTimeout(() => {
      pacer.current.i += 1;
      pacerRun();
    }, (s.d * 1000) / rateRef.current);
  }, [readSteps, pacerStop]);

  const clearTimers = useCallback(() => {
    pacerStop();
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, [pacerStop]);

  const finishRecording = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    clearTimers();
    setHl([]);
    const r = await rec.stop();
    setResult({ ...r, url: URL.createObjectURL(r.blob) });
    setPhase("review");
  }, [clearTimers]);
  stopRef.current = () => void finishRecording();

  useEffect(() => () => {
    clearTimers();
    recRef.current?.cancel();
  }, [clearTimers]);

  async function begin() {
    setError(null);
    for (const k of Object.keys(audioRefs.current)) audioRefs.current[k]?.pause();
    setPlaying(null);
    setHl([]);
    try {
      recRef.current = await openRecorder();
    } catch (e) {
      setError(micErrorText(e));
      return;
    }
    const p = post<{ activityId: string }>("/api/activity/start", { week: material.week_no, type: TYPE[kind] }).then((j) => j.activityId);
    p.catch(() => {});
    activityRef.current = p;

    setPhase("count");
    setCount(3);
    let n = 3;
    const t = setInterval(() => {
      n -= 1;
      if (n > 0) return setCount(n);
      clearInterval(t);
      const rec = recRef.current;
      if (!rec) return;
      rec.start();
      startedAt.current = performance.now();
      setElapsed(0);
      setPhase("record");
      setPacerPaused(false);
      pacer.current.i = 0;
      if (pacerOn) pacerRun();
      tickRef.current = setInterval(() => {
        const sec = (performance.now() - startedAt.current) / 1000;
        setElapsed(sec);
        if (sec >= maxSec) stopRef.current(); // 최대 길이에서 자동 정지 (잘라내지 않는다)
      }, 250);
    }, 1000);
  }

  function quit() {
    clearTimers();
    recRef.current?.cancel();
    recRef.current = null;
    setHl([]);
    setPhase("listen");
  }

  function readAgain() {
    audioRefs.current.mine?.pause();
    setPlaying(null);
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setError(null);
    setPhase("listen");
  }

  // ───────── 3 확인: 올리고 학습 완료 ─────────
  async function complete(goUp: boolean) {
    if (!result || saving) return;
    setConfirmUp(null);
    setSaving(true);
    setError(null);
    try {
      const activityId = await activityRef.current!;
      const path = await uploadMedia(activityId, result.blob, result.mime);
      const c = await post<{ weekNo: number; weekCompleted: number; firstEn: boolean }>("/api/activity/complete", { activityId, path });
      const to = goUp ? "/upload" : `/?done=${c.weekNo}-${c.weekCompleted}`;
      if (c.firstEn) setPopupTo(to);
      else router.push(to);
    } catch {
      setError("저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. 녹음은 그대로 있어요.");
      setSaving(false);
    }
  }

  // ───────── 화면 조각 ─────────
  const rateBar = (compact = false) => (
    <div className="rate" role="group" aria-label="속도">
      {!compact && <span>속도</span>}
      {RATES.map((r) => (
        <button key={r} className={rate === r ? "on" : ""} aria-pressed={rate === r} onClick={() => chooseRate(r)}>
          {r}배
        </button>
      ))}
    </div>
  );

  const text = (onlyMain: boolean, rec: boolean) => (
    <div className={`txt${en ? "" : " koMain"}`}>
      {paragraphs(sentences).map((idx, pi) => {
        const E = (
          <div className="en" key="e">
            {idx.map((si) => (
              <span key={si}>
                {chunksOf(sentences[si]).map((c, ci, all) => (
                  <span key={ci}>
                    <span id={enId(si, ci)} className={`ck${hl.includes(enId(si, ci)) ? " hl" : ""}`}>
                      {c}
                    </span>
                    {ci < all.length - 1 ? slash && !rec ? <span className="sl">/</span> : " " : null}
                  </span>
                ))}{" "}
              </span>
            ))}
          </div>
        );
        const K = (
          <div className="ko" key="k">
            {idx.map((si) => (
              <span key={si}>
                <span id={koId(si)} className={`sk${hl.includes(koId(si)) ? " hl" : ""}`}>
                  {sentences[si].ko}
                </span>{" "}
              </span>
            ))}
          </div>
        );
        if (onlyMain) return <div key={pi} style={{ marginBottom: rec ? 18 : 14 }}>{en ? E : K}</div>;
        return <div key={pi}>{en ? [E, K] : [K, E]}</div>;
      })}
    </div>
  );

  const audioRow = (key: string, name: string, src: string | null) => (
    <div className="card row" style={{ padding: "10px 14px" }}>
      <button className="play" disabled={!src} onClick={() => togglePlay(key)} aria-label={`${name} ${playing === key ? "멈춤" : "재생"}`}>
        {playing === key ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{name}</div>
      <div className="meta">{src ? (playing === key ? "재생 중" : "") : "음원 준비 중"}</div>
      {src && <audio ref={(el) => void (audioRefs.current[key] = el)} src={src} preload="metadata" />}
    </div>
  );

  const steps = (n: number) => (
    <div className="steps">
      {["1 듣기", "2 낭독", "3 확인"].map((t, i) => (
        <div key={t} className={i + 1 === n ? "on" : ""}>
          {t}
        </div>
      ))}
    </div>
  );

  const backToPicker = kind === "voca" ? `/write/${material.week_no}/voca` : `/activity?week=${material.week_no}`;

  // ───────── 2 낭독 화면 ─────────
  if (phase === "count" || phase === "record") {
    const left = maxSec - elapsed;
    return (
      <div className="app">
        <div className="topbar">
          <button className="back textbtn" style={{ textDecoration: "none", fontSize: 15 }} onClick={quit}>
            ‹ 그만두기
          </button>
        </div>
        {steps(2)}
        <div className="pad stack" style={{ paddingTop: 14, gap: 10 }}>
          <div className="between">
            <span className="rec">
              <i />
              녹음 중
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {clock(elapsed)} <span className="meta">/ {clock(maxSec)}</span>
            </span>
          </div>
          {left <= 30 && phase === "record" && (
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--deep)" }}>{Math.ceil(left)}초 남았어요. 시간이 되면 자동으로 멈춰요.</div>
          )}
          <div className="between">{rateBar(true)}</div>
          <div className="row" style={{ gap: 6 }}>
            <button
              className="chip"
              style={{ borderRadius: 12 }}
              onClick={() => {
                if (pacerOn) {
                  pacerStop();
                  setHl([]);
                } else if (phase === "record" && !pacerPaused) pacerRun();
                setPacerOn(!pacerOn);
              }}
            >
              {pacerOn ? "하이라이트 끄기" : "하이라이트 켜기"}
            </button>
            {pacerOn && (
              <button
                className="chip"
                style={{ borderRadius: 12 }}
                onClick={() => {
                  if (pacerPaused) pacerRun();
                  else pacerStop();
                  setPacerPaused(!pacerPaused);
                }}
              >
                {pacerPaused ? "다시 움직이기" : "잠깐 멈추기"}
              </button>
            )}
          </div>
        </div>
        <div className="scroll">
          <div className="pad recText" style={{ paddingTop: 12 }}>
            {text(true, true)}
          </div>
        </div>
        <div className="bottom">
          <button className="cta" disabled={phase !== "record"} onClick={() => void finishRecording()}>
            다 읽었어요
          </button>
        </div>
        {phase === "count" && (
          <div className="count" role="status">
            <b>{count}</b>
            <div style={{ fontSize: 15, fontWeight: 700 }}>곧 녹음이 시작돼요</div>
            <div className="help">하이라이트를 따라 읽어 보세요</div>
          </div>
        )}
      </div>
    );
  }

  // ───────── 3 확인 화면 ─────────
  if (phase === "review" && result) {
    const after = Math.min(material.week_completed + 1, material.weekly_target);
    return (
      <div className="app">
        <div className="scroll">
          <div className="topbar">
            <button className="back textbtn" style={{ textDecoration: "none", fontSize: 15 }} onClick={readAgain}>
              ‹ {NAME[kind]}
            </button>
            <div className="meta">{material.week_no}주차</div>
          </div>
          {steps(3)}
          <div className="pad stack" style={{ paddingTop: 28, gap: 18 }}>
            <h1 className="h1" style={{ fontSize: 26 }}>
              끝까지 읽었어요!
              <br />한번 들어볼까요?
            </h1>
            <div className="card lift row" style={{ padding: 20 }}>
              <button className="play" style={{ width: 56, height: 56 }} onClick={() => togglePlay("mine")} aria-label={playing === "mine" ? "내 낭독 멈춤" : "내 낭독 재생"}>
                {playing === "mine" ? <PauseIcon /> : <PlayIcon />}
              </button>
              <div className="stack" style={{ gap: 2, flex: 1 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>내 낭독</span>
                <span className="meta">{clock(result.sec)}</span>
              </div>
              <audio ref={(el) => void (audioRefs.current.mine = el)} src={result.url} preload="metadata" />
            </div>
            <div className="card help" style={{ fontSize: 13 }}>
              완료하면 {material.week_no}주차 학습이{" "}
              <b style={{ color: "var(--ink)" }}>
                {after} / {material.weekly_target}
              </b>
              가 돼요. 인스타에는 나중에 몰아서 올려도 괜찮아요.
            </div>
            {error && <div className="err">{error}</div>}
          </div>
        </div>
        <div className="bottom stack" style={{ gap: 10 }}>
          <button className="cta" disabled={saving} onClick={() => setConfirmUp(false)}>
            {saving ? "저장하는 중…" : "이대로 완료"}
          </button>
          <button className="btn2" disabled={saving} onClick={() => setConfirmUp(true)}>
            완료하고 바로 올리기
          </button>
          <button className="textbtn" style={{ textDecoration: "none" }} disabled={saving} onClick={readAgain}>
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
              <div style={{ fontSize: 15, lineHeight: 1.7 }}>
                제출하면 {material.week_no}주차 학습 1회로 기록돼요. 다시 읽고 싶으면 &apos;다시 읽기&apos;를 눌러 주세요.
              </div>
              <button className="cta" onClick={() => void complete(confirmUp)}>
                제출하기
              </button>
              <button className="btn2" onClick={() => setConfirmUp(null)}>
                한 번 더 들어볼게요
              </button>
            </div>
          </>
        )}
        {popupTo && (
          <>
            <div className="dim" />
            <div className="sheet" role="dialog" aria-modal="true" aria-label="첫 영어 낭독 안내">
              <div className="handle" />
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MicIcon />
              </div>
              <h2 className="h1" style={{ fontSize: 22 }}>
                첫 영어 낭독을
                <br />
                기억해 둘게요
              </h2>
              <div style={{ fontSize: 15, lineHeight: 1.7 }}>
                인스타에 올리면 그 게시물을 첫 낭독으로 기억해 둬요. 종강일 {deadline}까지 완주하면 마지막 낭독과 나란히 들려드려요.
              </div>
              <div className="row" style={{ padding: 14, borderRadius: 14, background: "var(--bg)", border: "1px solid var(--line)" }}>
                <span className="stack" style={{ gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>
                    {learnerName}의 첫 낭독 · {clock(result.sec)}
                  </span>
                  <span className="meta">완주하면 함께 들어요</span>
                </span>
              </div>
              <button className="cta" onClick={() => router.push(popupTo)}>
                좋아요
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ───────── 1 듣기 화면 ─────────
  const est = readTotal / rate;
  return (
    <div className="app">
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href={backToPicker}>
            ‹ {NAME[kind]}
          </Link>
          <div className="meta">{material.week_no}주차</div>
        </div>
        {steps(1)}
        <div className="pad stack" style={{ paddingTop: 14, gap: 10 }}>
          {preQuestion && (
            <div className="card stack" style={{ gap: 6, background: "var(--tint)", border: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--deep)" }}>듣기 전에 생각해 봐요</span>
              <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6 }}>{preQuestion}</span>
            </div>
          )}
          {articlePdf && (
            <div className="card row" style={{ padding: "12px 16px" }}>
              <span style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>기사 PDF</span>
              <a className="chip" style={{ background: "var(--tint)", border: 0, gap: 4, borderRadius: 12, fontWeight: 800 }} href={articlePdf} target="_blank" rel="noopener">
                <DlIcon />
                받기
              </a>
            </div>
          )}
          {audios.map((a) => (
            <div key={a.key}>{audioRow(a.key, a.label, a.src)}</div>
          ))}
          {rateBar()}
          <div className="card stack" style={{ gap: 12 }}>
            <div className="between">
              <div style={{ fontSize: 13, fontWeight: 800 }}>{kind === "voca" ? "이번 주 단어" : en ? "기사 원문" : "기사 해석"}</div>
              <button className="chip" style={{ minHeight: 44, borderRadius: 12, fontSize: 12 }} onClick={() => setSingle(!single)}>
                {single ? "함께 보기" : kind === "voca" ? "단어만 보기" : en ? "영어만 보기" : "한글만 보기"}
              </button>
            </div>
            {kind === "en" && (
              <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 700, color: "var(--sub)", minHeight: 32 }}>
                <input type="checkbox" checked={slash} onChange={(e) => setSlash(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--deep)" }} />
                끊어 읽기 표시
              </label>
            )}
            {text(single, false)}
          </div>
        </div>
      </div>
      <div className="bottom stack" style={{ gap: 6 }}>
        {error && <div className="err">{error}</div>}
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
