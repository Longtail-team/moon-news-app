"use client";

// 합친 기사 화면(T07, 2026-10-10 결정): 지문은 한 화면에 한 번, 아래 시트에서 청독 / 기사 읽기 / 찬반토론을 바꾼다.
// 이 부품은 화면 상태(시트·지문 보기·질문 접기)만 들고, 재생은 useListening, 그리기는 각 부품이 맡는다.
// PR B: 청독만 이 화면 안에서 하고, 기사 읽기·찬반토론은 지금 화면으로 이어 준다(PR C·E에서 시트로 옮김).
import Link from "next/link";
import { useEffect, useState } from "react";
import { defaultView, type Mode, type ReadLang, type View } from "@/lib/article/mode";
import { useListening, type ListenAudio } from "@/lib/listen/useListening";
import { finishListening, type ListenDone } from "@/lib/listen/finish";
import type { AudioType } from "@/lib/listening";
import type { Sentence } from "@/lib/reading/text";
import { PreQuestion } from "./PreQuestion";
import { ArticleBox } from "./ArticleBox";
import { ModeTabs } from "./ModeTabs";
import { ListenSheet } from "./ListenSheet";
import { ListenDoneView } from "./ListenDoneView";
import { ReadSheetLinks, DebateSheetLink } from "./InterimSheets";

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
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [lang] = useState<ReadLang>(initialLang);
  const [view, setView] = useState<View>(defaultView(initialMode, initialLang));
  const [slash, setSlash] = useState(false);
  const [qOpen, setQOpen] = useState(true);
  const [selected, setSelected] = useState<AudioType | null>(audios[0]?.type ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ListenDone | null>(null);
  const L = useListening({ week, audios, sentences });

  // 재생을 시작하면 질문을 한 줄로 접는다
  useEffect(() => {
    if (L.playing) setQOpen(false);
  }, [L.playing]);

  // 칠한 조각이 아래 시트에 가리지 않게
  useEffect(() => {
    const id = L.hl[0];
    const el = id && document.getElementById(id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dock = document.querySelector(".dock")?.getBoundingClientRect().top ?? window.innerHeight;
    if (r.top < 80 || r.bottom > dock - 24) window.scrollBy({ top: r.top - (dock - 80) / 2, behavior: "smooth" });
  }, [L.hl]);

  function changeMode(m: Mode) {
    if (m === mode) return;
    L.pauseAll();
    setMode(m);
    setView(defaultView(m, lang));
  }

  async function complete() {
    if (!L.passed || busy) return;
    setBusy(true);
    setError(null);
    L.pauseAll();
    try {
      await L.flush();
      setDone(await finishListening(week, L.plays, L.session));
    } catch {
      setError("청독 카드를 만들지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. 들은 기록은 남아 있어요.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <ListenDoneView week={week} weeklyTarget={weeklyTarget} done={done} onBack={() => (setDone(null), changeMode("read"))} />;

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
          {preQuestion && mode !== "debate" && <PreQuestion text={preQuestion} open={qOpen} onToggle={() => setQOpen(!qOpen)} verb={mode === "listen" ? "들어" : "읽어"} />}
          {sentences.length > 0 ? (
            <ArticleBox sentences={sentences} hl={L.hl} view={view} onView={setView} slash={slash} onSlash={setSlash} />
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
        <ModeTabs mode={mode} onMode={changeMode} />
        {mode === "listen" && <ListenSheet audios={audios} selected={selected} onSelect={(t) => (L.pauseAll(), setSelected(t))} L={L} busy={busy} onComplete={() => void complete()} />}
        {mode === "read" && <ReadSheetLinks week={week} />}
        {mode === "debate" && <DebateSheetLink week={week} />}
      </div>
    </div>
  );
}
