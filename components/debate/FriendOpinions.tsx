// 다른 친구들의 생각(이름 없이): 전체 / 찬성 / 반대 / 잘 모르겠어요 거르기. 내 의견은 맨 위에 "내 의견"
import { opinionCounts, opinionList, STANCE_TAG, type DebateBoard, type Stance } from "@/lib/debate/board";

const BubbleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-8l-4 3.5V17H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
  </svg>
);

function when(iso: string) {
  const f = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t: string) => f.find((x) => x.type === t)?.value ?? "";
  return `${g("month")}.${g("day")} ${g("hour")}:${g("minute")}`;
}

export function FriendOpinions({ board, show, filter, onFilter }: { board: DebateBoard; show: boolean; filter: Stance | "all"; onFilter: (f: Stance | "all") => void }) {
  const n = opinionCounts(board);
  const list = opinionList(board, filter);
  const chip = (k: Stance | "all", label: string) => (
    <button key={k} className={`chip${filter === k ? " on" : ""}`} aria-pressed={filter === k} onClick={() => onFilter(k)}>
      {label} {n[k]}
    </button>
  );
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 8 }}>
        <span style={{ display: "flex", color: "var(--deep)" }}>
          <BubbleIcon />
        </span>
        <span style={{ fontSize: 17, fontWeight: 800 }}>다른 친구들의 생각</span>
      </div>
      {!show ? (
        <div className="help" style={{ padding: "16px 12px", borderRadius: 12, border: "2px dashed var(--line2)", textAlign: "center" }}>
          내 의견을 고르면 친구들의 투표 결과와 생각을 볼 수 있어요
        </div>
      ) : (
        <>
          <div className="row" style={{ gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {chip("all", "전체")}
            {chip("agree", "찬성")}
            {chip("disagree", "반대")}
            {chip("unsure", "잘 모르겠어요")}
          </div>
          <div>
            {list.length === 0 && <div className="help" style={{ padding: "14px 0" }}>아직 이 의견을 쓴 친구가 없어요.</div>}
            {list.map((o, i) => (
              <div key={i} className="opi">
                <div className="between">
                  <span className="row" style={{ gap: 6 }}>
                    <span className={`optag ${o.stance}`}>{STANCE_TAG[o.stance]}</span>
                    {o.mine && <span className="meta" style={{ fontWeight: 800, color: "var(--deep)" }}>내 의견</span>}
                  </span>
                  <span className="meta">{when(o.at)}</span>
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.6, overflowWrap: "anywhere" }}>{o.reason}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
