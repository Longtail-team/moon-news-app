// 찬성해요 / 반대해요 / 잘 모르겠어요: 고르면 버튼마다 비율이 바로 보인다(내가 고른 것 포함)
import { STANCES, STANCE_LABEL, pcts, type Counts, type Stance } from "@/lib/debate/board";

export function VoteButtons({ picked, onPick, counts, show, locked }: { picked: Stance | null; onPick: (s: Stance) => void; counts: Counts; show: boolean; locked: boolean }) {
  const p = pcts(counts);
  return (
    <div className="stack" style={{ gap: 8 }} role="group" aria-label="내 의견">
      {STANCES.map((s) => (
        <button key={s} className={`vopt${picked === s ? " on" : ""}`} aria-pressed={picked === s} disabled={locked} onClick={() => onPick(s)}>
          {show && <i style={{ width: `${p[s]}%` }} />}
          <span>{STANCE_LABEL[s]}</span>
          {show && <b>{p[s]}%</b>}
        </button>
      ))}
    </div>
  );
}
