"use client";

// 합친 기사 화면(T07, 2026-10-10 결정): 지문은 한 화면에 한 번, 아래 시트에서 청독 / 기사 읽기 / 찬반토론을 바꾼다.
// 이 부품은 화면 상태(시트·언어·지문 보기·질문 접기)와 조립만 한다.
// 재생 useListening · 녹음 useRecording · 찬반 useDebate, 완료 흐름 useListenComplete · useReadComplete · useDebateSubmit, 그리기는 각 부품.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { defaultView, type Mode, type ReadLang, type View } from "@/lib/article/mode";
import { useListening, type ListenAudio } from "@/lib/listen/useListening";
import { useListenComplete } from "@/lib/listen/useListenComplete";
import { useRecording } from "@/lib/reading/useRecording";
import { useReadComplete } from "@/lib/reading/useReadComplete";
import { useDebate } from "@/lib/debate/useDebate";
import { useDebateSubmit } from "@/lib/debate/useDebateSubmit";
import type { DebateBoard } from "@/lib/debate/board";
import { LISTEN_LEVELS, DEBATE_FEELS } from "@/lib/rating/options";
import type { AudioType } from "@/lib/listening";
import { timeline, totalSec, type Sentence } from "@/lib/reading/text";
import { PreQuestion } from "./PreQuestion";
import { ArticleBox } from "./ArticleBox";
import { ModeTabs } from "./ModeTabs";
import { ListenSheet } from "./ListenSheet";
import { ListenDoneView } from "./ListenDoneView";
import { ReadSheet } from "./ReadSheet";
import { ReadDoneView } from "./ReadDoneView";
import { RatingSheet } from "@/components/rating/RatingSheet";
import { DebateSection } from "@/components/debate/DebateSection";
import { DebateSheet } from "@/components/debate/DebateSheet";
import { DebateDoneView } from "@/components/debate/DebateDoneView";

export function ArticleScreen(p: {
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
  learnerName: string; // 부르는 이름(첫 낭독 안내·카드 기자 이름)
  deadline: string; // 종강일 표시
  listenRatingRequired: boolean; // 이 주차 첫 청독이면 이해도 평가 필수
  debate: DebateBoard | null; // 찬반토론 판
  debateFeelRequired: boolean; // 이 주차 첫 토론이면 주제 반응 필수
}) {
  const { week, sentences, audios, weeklyTarget } = p;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(p.initialMode);
  const [lang, setLang] = useState<ReadLang>(p.initialLang);
  const [view, setView] = useState<View>(defaultView(p.initialMode, p.initialLang));
  const [slash, setSlash] = useState(false);
  const [qOpen, setQOpen] = useState(true);
  const [selected, setSelected] = useState<AudioType | null>(audios[0]?.type ?? null);

  const L = useListening({ week, audios, sentences });
  const LC = useListenComplete(week, L, p.listenRatingRequired);
  const readSteps = useMemo(() => timeline(sentences, lang === "en" ? "en" : "ko"), [sentences, lang]);
  const R = useRecording({ steps: readSteps, rate: L.rate, maxSec: p.maxSec });
  const RC = useReadComplete(week, R);
  const D = useDebate(p.debate);
  const DS = useDebateSubmit(D, p.learnerName, p.debateFeelRequired);
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

  // 찬반토론 시트로 오면 토론 질문이 보이게
  useEffect(() => {
    if (mode === "debate") document.getElementById("debateSec")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [mode]);

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

  // 완료 화면에서 기사로 돌아오기
  function backTo(m: Mode) {
    LC.clear();
    RC.clear();
    DS.clear();
    R.reset();
    router.refresh(); // 주차 학습 수 다시 읽기
    setMode(m);
    setView(defaultView(m, lang));
  }

  if (LC.done) return <ListenDoneView week={week} weeklyTarget={weeklyTarget} done={LC.done} onBack={() => backTo("read")} />;
  if (RC.done)
    return (
      <ReadDoneView
        week={week}
        weeklyTarget={weeklyTarget}
        done={RC.done.done}
        firstPopup={RC.done.popup}
        learnerName={p.learnerName}
        deadline={p.deadline}
        recordSec={RC.done.sec}
        onPopupOk={RC.popupOk}
        onBack={() => backTo("debate")}
      />
    );
  if (DS.done) return <DebateDoneView weeklyTarget={weeklyTarget} done={DS.done} onBack={() => backTo("debate")} />;

  return (
    <div className="app">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@900&display=swap" precedence="default" />
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href={`/activity?week=${week}`}>
            ‹ 학습 고르기
          </Link>
          <div className="meta">
            {week}주차 학습 {p.weekCompleted} / {weeklyTarget}
          </div>
        </div>
        <div className="pad stack" style={{ gap: 10 }}>
          {/* 난이도·단어 수는 이번 주 자료 탭에만(spec 8장) */}
          <h1 className="h1" style={{ fontSize: 20 }}>
            {p.title}
          </h1>
          {p.preQuestion && mode !== "debate" && !recording && <PreQuestion text={p.preQuestion} open={qOpen} onToggle={() => setQOpen(!qOpen)} verb={mode === "listen" ? "들어" : "읽어"} />}
          {sentences.length > 0 ? (
            <ArticleBox sentences={sentences} hl={hl} view={view} onView={setView} slash={slash} onSlash={setSlash} locked={recording} big={recording} />
          ) : (
            <div className="card help">이번 주 지문을 준비하고 있어요.</div>
          )}
          {mode === "debate" && <DebateSection D={D} />}
          {LC.error && <div className="err">{LC.error}</div>}
        </div>
      </div>

      {/* 음원은 시트를 바꿔도 이어서 재고 칠하도록 화면에 늘 둔다 */}
      {audios.map((a) => (
        <audio key={a.type} src={a.src} {...L.audioProps(a.type)} />
      ))}

      <div className="bottom dock stack" style={{ gap: 10 }}>
        <ModeTabs mode={mode} onMode={changeMode} locked={recording} />
        {mode === "listen" && <ListenSheet audios={audios} selected={selected} onSelect={(t) => (L.pauseAll(), setSelected(t))} L={L} busy={LC.busy} onComplete={LC.ask} />}
        {mode === "read" && (
          <ReadSheet
            R={R}
            lang={lang}
            onLang={changeLang}
            rate={L.rate}
            onRate={L.setRate}
            estSec={totalSec(readSteps)}
            maxSec={p.maxSec}
            saving={RC.busy}
            onStart={() => (L.pauseAll(), setView(defaultView("read", lang)), void RC.start(lang))}
            onComplete={() => void RC.complete()}
          />
        )}
        {mode === "debate" && <DebateSheet D={D} busy={DS.busy} onSubmit={DS.ask} error={DS.error} />}
      </div>

      {LC.rateOpen && (
        <RatingSheet
          label="청독 이해도"
          title="이번 청독은 어땠나요?"
          help={LC.required ? "이 기사를 처음 청독했어요. 나와 가장 가까운 것을 골라 주세요." : "같은 기사를 다시 들었어요. 골라도 되고 건너뛰어도 돼요."}
          options={LISTEN_LEVELS}
          numbered
          required={LC.required}
          busy={LC.busy}
          onPick={(v) => void LC.complete(v)}
          onSkip={() => void LC.complete(null)}
          onClose={LC.close}
        />
      )}
      {DS.feelOpen && (
        <RatingSheet
          label="토론 주제 반응"
          title="오늘 토론 주제는 어땠어요?"
          help="하나만 골라 주세요. 토론 카드에 들어가요."
          options={DEBATE_FEELS}
          required={DS.required}
          busy={DS.busy}
          onPick={(v) => void DS.submit(v)}
          onSkip={() => void DS.submit(null)}
          onClose={DS.close}
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
