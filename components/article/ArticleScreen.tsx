"use client";

// 합친 기사 화면(T07, 2026-10-10 결정): 지문은 한 화면에 한 번, 아래 시트에서 청독 / 기사 읽기 / 찬반토론을 바꾼다.
// 이 부품은 화면 상태(시트·언어·지문 보기·질문 접기·완료 화면)만 들고, 재생은 useListening, 녹음은 useRecording,
// 완료 처리는 lib/listen·lib/reading의 finish, 그리기는 각 부품이 맡는다.
// 찬반토론은 PR E 전까지 지금 화면으로 이어 준다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultView, type Mode, type ReadLang, type View } from "@/lib/article/mode";
import { useListening, type ListenAudio } from "@/lib/listen/useListening";
import { finishListening, type ListenDone } from "@/lib/listen/finish";
import { useRecording } from "@/lib/reading/useRecording";
import { finishReading, type ReadDone } from "@/lib/reading/finish";
import { post } from "@/lib/client-api";
import type { AudioType } from "@/lib/listening";
import { timeline, totalSec, type Sentence } from "@/lib/reading/text";
import { PreQuestion } from "./PreQuestion";
import { ArticleBox } from "./ArticleBox";
import { ModeTabs } from "./ModeTabs";
import { ListenSheet } from "./ListenSheet";
import { ListenDoneView } from "./ListenDoneView";
import { ReadSheet } from "./ReadSheet";
import { ReadDoneView } from "./ReadDoneView";
import { DebateSheetLink } from "./InterimSheets";
import { RatingSheet } from "@/components/rating/RatingSheet";
import { LISTEN_LEVELS } from "@/lib/rating/options";

const TYPE: Record<ReadLang, string> = { en: "EN_READING", kr: "KR_READING" };

export function ArticleScreen({
  week,
  title,
  sentences,
  preQuestion,
  audios,
  weeklyTarget,
  weekCompleted,
  initialMode,
  initialLang,
  maxSec,
  learnerName,
  deadline,
  listenRatingRequired,
}: {
  week: number;
  title: string;
  sentences: Sentence[];
  preQuestion: string | null;
  audios: ListenAudio[];
  weeklyTarget: number;
  weekCompleted: number;
  initialMode: Mode;
  initialLang: ReadLang;
  maxSec: number; // 녹음 최대 길이(2단계 확정 전 임시)
  learnerName: string; // 부르는 이름(첫 낭독 안내)
  deadline: string; // 종강일 표시
  listenRatingRequired: boolean; // 이 주차 첫 청독이면 이해도 평가 필수(다시 청독은 선택)
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [lang, setLang] = useState<ReadLang>(initialLang);
  const [view, setView] = useState<View>(defaultView(initialMode, initialLang));
  const [slash, setSlash] = useState(false);
  const [qOpen, setQOpen] = useState(true);
  const [selected, setSelected] = useState<AudioType | null>(audios[0]?.type ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listenDone, setListenDone] = useState<ListenDone | null>(null);
  const [readDone, setReadDone] = useState<{ done: ReadDone; sec: number; popup: boolean } | null>(null);
  const [rateOpen, setRateOpen] = useState(false); // 청독 완료 → 이해도 평가
  const [rateRequired, setRateRequired] = useState(listenRatingRequired);
  const activity = useRef<Promise<string> | null>(null);

  const L = useListening({ week, audios, sentences });
  const readSteps = useMemo(() => timeline(sentences, lang === "en" ? "en" : "ko"), [sentences, lang]);
  const R = useRecording({ steps: readSteps, rate: L.rate, maxSec });
  const recording = R.phase === "count" || R.phase === "rec";
  const hl = mode === "read" ? R.hl : L.hl;

  // 재생·읽기를 시작하면 질문을 한 줄로 접는다
  useEffect(() => {
    if (L.playing || recording) setQOpen(false);
  }, [L.playing, recording]);

  // 칠한 조각이 아래 시트에 가리지 않게
  useEffect(() => {
    const el = hl[0] && document.getElementById(hl[0]);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dock = document.querySelector(".dock")?.getBoundingClientRect().top ?? window.innerHeight;
    if (r.top < 80 || r.bottom > dock - 24) window.scrollBy({ top: r.top - (dock - 80) / 2, behavior: "smooth" });
  }, [hl]);

  function changeMode(m: Mode) {
    if (m === mode || recording) return;
    L.pauseAll();
    if (R.phase === "done") R.reset();
    setMode(m);
    setView(defaultView(m, lang));
  }

  function changeLang(l: ReadLang) {
    setLang(l);
    setView(defaultView("read", l));
  }

  // 청독 완료 → 이해도 평가 창(첫 청독은 필수) → 고르거나 건너뛰면 완료 처리
  function askRating() {
    if (!L.passed || busy) return;
    L.pauseAll();
    setRateOpen(true);
  }

  async function completeListening(understanding: number | null) {
    if (!L.passed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await L.flush();
      const done = await finishListening(week, L.plays, L.session, understanding);
      if (understanding) setRateRequired(false);
      setRateOpen(false);
      setListenDone(done);
    } catch {
      setRateOpen(false);
      setError("청독 카드를 만들지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. 들은 기록은 남아 있어요.");
    } finally {
      setBusy(false);
    }
  }

  async function startReading() {
    L.pauseAll();
    setView(defaultView("read", lang));
    if (!(await R.start())) return;
    // 녹음과 함께 작성 중 기록을 만든다(완료할 때 녹음을 붙임)
    const p = post<{ activityId: string }>("/api/activity/start", { week, type: TYPE[lang] }).then((j) => j.activityId);
    p.catch(() => {});
    activity.current = p;
  }

  async function completeReading() {
    if (!R.result || busy || !activity.current) return;
    setBusy(true);
    R.setError(null);
    try {
      const done = await finishReading(await activity.current, R.result);
      setReadDone({ done, sec: R.result.sec, popup: done.firstEn });
    } catch {
      R.setError("저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. 녹음은 그대로 있어요.");
    } finally {
      setBusy(false);
    }
  }

  const backToArticle = (m: Mode) => {
    setListenDone(null);
    setReadDone(null);
    R.reset();
    router.refresh(); // 주차 학습 수 다시 읽기
    changeModeAfterDone(m);
  };
  const changeModeAfterDone = (m: Mode) => {
    setMode(m);
    setView(defaultView(m, lang));
  };

  if (listenDone) return <ListenDoneView week={week} weeklyTarget={weeklyTarget} done={listenDone} onBack={() => backToArticle("read")} />;
  if (readDone)
    return (
      <ReadDoneView
        week={week}
        weeklyTarget={weeklyTarget}
        done={readDone.done}
        firstPopup={readDone.popup}
        learnerName={learnerName}
        deadline={deadline}
        recordSec={readDone.sec}
        onPopupOk={() => setReadDone({ ...readDone, popup: false })}
        onBack={() => backToArticle("debate")}
      />
    );

  return (
    <div className="app">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@900&display=swap" precedence="default" />
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href={`/activity?week=${week}`}>
            ‹ 학습 고르기
          </Link>
          <div className="meta">
            {week}주차 학습 {weekCompleted} / {weeklyTarget}
          </div>
        </div>
        <div className="pad stack" style={{ gap: 10 }}>
          {/* 난이도·단어 수는 이번 주 자료 탭에만(spec 8장) */}
          <h1 className="h1" style={{ fontSize: 20 }}>
            {title}
          </h1>
          {preQuestion && mode !== "debate" && !recording && <PreQuestion text={preQuestion} open={qOpen} onToggle={() => setQOpen(!qOpen)} verb={mode === "listen" ? "들어" : "읽어"} />}
          {sentences.length > 0 ? (
            <ArticleBox sentences={sentences} hl={hl} view={view} onView={setView} slash={slash} onSlash={setSlash} locked={recording} big={recording} />
          ) : (
            <div className="card help">이번 주 지문을 준비하고 있어요.</div>
          )}
          {error && <div className="err">{error}</div>}
        </div>
      </div>

      {/* 음원은 시트를 바꿔도 이어서 재고 칠하도록 화면에 늘 둔다 */}
      {audios.map((a) => (
        <audio key={a.type} src={a.src} {...L.audioProps(a.type)} />
      ))}

      <div className="bottom dock stack" style={{ gap: 10 }}>
        <ModeTabs mode={mode} onMode={changeMode} locked={recording} />
        {mode === "listen" && <ListenSheet audios={audios} selected={selected} onSelect={(t) => (L.pauseAll(), setSelected(t))} L={L} busy={busy} onComplete={askRating} />}
        {mode === "read" && (
          <ReadSheet
            R={R}
            lang={lang}
            onLang={changeLang}
            rate={L.rate}
            onRate={L.setRate}
            estSec={totalSec(readSteps)}
            maxSec={maxSec}
            saving={busy}
            onStart={() => void startReading()}
            onComplete={() => void completeReading()}
          />
        )}
        {mode === "debate" && <DebateSheetLink week={week} />}
      </div>

      {rateOpen && (
        <RatingSheet
          label="청독 이해도"
          title="이번 청독은 어땠나요?"
          help={rateRequired ? "이 기사를 처음 청독했어요. 나와 가장 가까운 것을 골라 주세요." : "같은 기사를 다시 들었어요. 골라도 되고 건너뛰어도 돼요."}
          options={LISTEN_LEVELS}
          numbered
          required={rateRequired}
          busy={busy}
          onPick={(v) => void completeListening(v)}
          onSkip={() => void completeListening(null)}
        />
      )}

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
