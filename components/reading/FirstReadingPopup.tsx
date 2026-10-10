// 첫 영어 낭독 안내(spec 9장): 인스타에 올리면 첫 낭독으로 기억해 두고, 완주하면 마지막 낭독과 나란히 들려준다
import { clock } from "@/lib/reading/text";

const MicIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export function FirstReadingPopup({ learnerName, deadline, sec, onOk }: { learnerName: string; deadline: string; sec: number; onOk: () => void }) {
  return (
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
        <div style={{ fontSize: 15, lineHeight: 1.7 }}>인스타에 올리면 그 게시물을 첫 낭독으로 기억해 둬요. 종강일 {deadline}까지 완주하면 마지막 낭독과 나란히 들려드려요.</div>
        <div className="row" style={{ padding: 14, borderRadius: 14, background: "var(--bg)", border: "1px solid var(--line)" }}>
          <span className="stack" style={{ gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>
              {learnerName}의 첫 낭독 · {clock(sec)}
            </span>
            <span className="meta">완주하면 함께 들어요</span>
          </span>
        </div>
        <button className="cta" onClick={onOk}>
          좋아요
        </button>
      </div>
    </>
  );
}
