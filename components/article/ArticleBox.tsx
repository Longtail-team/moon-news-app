// 지문 상자(2026-10-10): 위 한 줄에 왼쪽 언어 선택(영어 / 한·영 / 한국어, 작게), 오른쪽 끊어 읽기. "기사" 글자는 없음
import { ArticleText } from "@/components/reading/ArticleText";
import { canSlash, viewProps, type View } from "@/lib/article/mode";
import type { Sentence } from "@/lib/reading/text";

const VIEWS: [View, string][] = [
  ["en", "영어"],
  ["both", "한·영"],
  ["ko", "한국어"],
];

export function ArticleBox({
  sentences,
  hl,
  view,
  onView,
  slash,
  onSlash,
  locked = false,
  big = false,
}: {
  sentences: Sentence[];
  hl: string[];
  view: View;
  onView: (v: View) => void;
  slash: boolean;
  onSlash: (on: boolean) => void;
  locked?: boolean; // 녹음 중에는 바꾸지 않음
  big?: boolean; // 녹음 중 큰 글자
}) {
  const v = viewProps(view);
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="between" style={{ margin: "-6px 0 -4px" }}>
        <div className="seg" role="group" aria-label="지문 보기">
          {VIEWS.map(([k, label]) => (
            <button key={k} className={view === k ? "on" : ""} aria-pressed={view === k} disabled={locked} onClick={() => onView(k)}>
              <span>{label}</span>
            </button>
          ))}
        </div>
        {canSlash(view) && !locked && (
          <label className="slashck">
            <input type="checkbox" checked={slash} onChange={(e) => onSlash(e.target.checked)} />
            끊어 읽기
          </label>
        )}
      </div>
      <div className={big ? "recText" : undefined}>
        <ArticleText sentences={sentences} hl={hl} en={v.en} slash={slash && canSlash(view) && !big} onlyMain={v.onlyMain} gap={big ? 18 : 14} />
      </div>
    </div>
  );
}
