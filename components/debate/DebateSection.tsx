// 찬반토론(지문 아래, T07 PR E): 토론 질문 → 찬성 / 반대 / 잘 모르겠어요(누르면 비율) → 이유 한 줄 → 다른 친구들의 생각
import { canSeeResults, countsWith, REASON_MAX, total } from "@/lib/debate/board";
import type { useDebate } from "@/lib/debate/useDebate";
import { VoteButtons } from "./VoteButtons";
import { FriendOpinions } from "./FriendOpinions";

export function DebateSection({ D }: { D: ReturnType<typeof useDebate> }) {
  const b = D.board;
  if (!b) return null;
  if (!b.question)
    return (
      <div id="debateSec" className="card help" style={{ textAlign: "center" }}>
        이번 주 토론 질문을 준비하고 있어요.
      </div>
    );
  const show = canSeeResults(b, D.picked);
  const counts = countsWith(b, D.picked);
  return (
    <div id="debateSec" className="stack" style={{ gap: 12, marginTop: 6 }}>
      <div className="card lift stack" style={{ gap: 8 }}>
        <div className="between">
          <span className="pill">이번 주 토론 질문</span>
          {show && <span className="meta">{total(counts)}명 참여</span>}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.45 }}>{b.question}</div>
        {!b.open && <div className="meta">투표가 마감됐어요. 지금 의견을 내면 학습 1회로 기록되지만 결과에는 들어가지 않아요.</div>}
      </div>
      <VoteButtons picked={D.picked} onPick={D.setPicked} counts={counts} show={show} locked={D.submitted} />
      {D.picked && !D.submitted && (
        <div className="stack" style={{ gap: 6 }}>
          <label htmlFor="dreason" style={{ fontSize: 13, fontWeight: 700 }}>
            왜 그렇게 생각하나요?
          </label>
          <input
            id="dreason"
            maxLength={REASON_MAX}
            value={D.reason}
            onChange={(e) => D.setReason(e.target.value)}
            placeholder="이유를 한 줄로 써 주세요 (한국어·영어 모두 좋아요)"
            style={{ width: "100%", height: 52, borderRadius: 12, border: "1px solid var(--faint)", background: "var(--white)", padding: "0 14px", fontSize: 16, font: "inherit" }}
          />
          <div className="help" style={{ fontSize: 13 }}>
            이름 없이 친구들에게 보여요. 낸 뒤에는 고칠 수 없어요.
          </div>
        </div>
      )}
      <FriendOpinions board={b} show={show} filter={D.filter} onFilter={D.setFilter} />
    </div>
  );
}
