// 찬반토론 시트(아래): 안내 + "의견 내기". 낸 뒤에는 의견을 냈다는 표시
import type { useDebate } from "@/lib/debate/useDebate";

export function DebateSheet({ D, busy, onSubmit, error }: { D: ReturnType<typeof useDebate>; busy: boolean; onSubmit: () => void; error: string | null }) {
  if (!D.board?.question) return <div className="help" style={{ textAlign: "center", padding: "8px 0" }}>토론 질문이 올라오면 할 수 있어요.</div>;
  if (D.submitted)
    return (
      <div className="card row" style={{ background: "var(--tint)", border: 0, padding: "12px 14px" }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: "var(--deep)" }}>의견을 냈어요</span>
        <span className="meta">친구들의 생각을 읽어 봐요</span>
      </div>
    );
  const label = busy ? "토론 카드를 만드는 중…" : D.ready ? "의견 내기" : D.picked ? "이유를 한 줄 써 주세요" : "찬성·반대·잘 모르겠어요 중 골라 주세요";
  return (
    <>
      {error && <div className="err">{error}</div>}
      <div className="help" style={{ textAlign: "center" }}>
        투표하고 이유를 한 줄 쓰면 학습 1회{D.board.open ? " · 일요일 자정 마감" : ""}
      </div>
      <button className="cta" disabled={!D.ready || busy} onClick={onSubmit}>
        {label}
      </button>
    </>
  );
}
