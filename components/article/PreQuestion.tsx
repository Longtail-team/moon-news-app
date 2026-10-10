// 듣기 전 질문(2026-10-10): 들어올 때는 펼쳐 두고, 재생·읽기를 시작하면 한 줄로 접힌다(누르면 다시 펼침)
import { DownIcon } from "@/components/student/icons";

export function PreQuestion({ text, open, onToggle, verb }: { text: string; open: boolean; onToggle: () => void; verb: "들어" | "읽어" }) {
  if (!open)
    return (
      <button className="qline" onClick={onToggle} aria-expanded={false}>
        <b>질문</b>
        <span>{text}</span>
        <DownIcon />
      </button>
    );
  return (
    <div className="qbox stack" style={{ gap: 8 }}>
      <div className="between">
        <span className="qhead">이 질문을 생각하며 {verb} 봐요</span>
        <button className="textbtn qfold" onClick={onToggle} aria-expanded>
          접기
        </button>
      </div>
      <div className="qtext">{text}</div>
    </div>
  );
}
