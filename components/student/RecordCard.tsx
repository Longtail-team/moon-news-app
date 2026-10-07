"use client";

// 12주 기록: 기본은 접힌 한 줄, 누르면 12주 × 5칸 (spec.md 7장)
import { useState } from "react";
import { ACT, ACT_ORDER, ActIcon, DownIcon, UpChevronIcon, type ActType } from "./icons";

type Week = { week_no: number; acts: ActType[] };

export function RecordCard({
  weeks,
  currentWeek,
  weeklyTarget,
  totalTarget,
  totalCompleted,
  readingWords,
}: {
  weeks: Week[];
  currentWeek: number;
  weeklyTarget: number;
  totalTarget: number;
  totalCompleted: number;
  readingWords: number;
}) {
  const [open, setOpen] = useState(false);
  const backlogWeek = weeks.find((w) => w.week_no < currentWeek && w.acts.length < weeklyTarget);
  const backlog = backlogWeek ? `${backlogWeek.week_no}주차 ${weeklyTarget - backlogWeek.acts.length}회 남음` : "";

  return (
    <div className="card" style={{ padding: "8px 16px" }}>
      <button className="recHead" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="stack" style={{ gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>12주 기록</span>
          <span className="meta">
            학습 {totalCompleted} / {totalTarget}
            {backlog ? ` · ${backlog}` : ""}
          </span>
        </span>
        <span className="row" style={{ gap: 4, fontSize: 13, fontWeight: 700 }}>
          {open ? (
            <>
              접기
              <UpChevronIcon />
            </>
          ) : (
            <>
              펼쳐 보기
              <DownIcon />
            </>
          )}
        </span>
      </button>
      {open && (
        <div className="stack reveal" style={{ padding: "4px 0 12px" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            지금까지 소리 내어 읽은 영어 단어 <b style={{ color: "var(--deep)" }}>{readingWords.toLocaleString()}</b>개
          </div>
          <div className="legend">
            {ACT_ORDER.map((k) => (
              <span key={k}>
                <ActIcon type={k} size={18} />
                {ACT[k].short}
              </span>
            ))}
          </div>
          <div className="grid">
            {weeks.map((w) => (
              <div className="grow" key={w.week_no}>
                <div className={`wk${w.week_no > currentWeek ? " future" : ""}`}>{w.week_no}주</div>
                {Array.from({ length: weeklyTarget }, (_, i) => {
                  const act = w.acts[i];
                  if (act)
                    return (
                      <div key={i} className="box done" role="img" aria-label={ACT[act].short}>
                        <ActIcon type={act} />
                      </div>
                    );
                  if (w.week_no < currentWeek) return <div key={i} className="box miss" role="img" aria-label="빈 칸" />;
                  if (w.week_no === currentWeek) return <div key={i} className="box open" role="img" aria-label="빈 칸" />;
                  return <div key={i} className="box future" />;
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
