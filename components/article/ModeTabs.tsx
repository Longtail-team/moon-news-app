// 아래 시트의 활동 고르기: 청독 / 기사 읽기 / 찬반토론
import { ActIcon } from "@/components/student/icons";
import type { Mode } from "@/lib/article/mode";

const TABS: [Mode, string, "LISTENING" | "EN_READING" | "DEBATE"][] = [
  ["listen", "청독", "LISTENING"],
  ["read", "기사 읽기", "EN_READING"],
  ["debate", "찬반토론", "DEBATE"],
];

export function ModeTabs({ mode, onMode, locked = false }: { mode: Mode; onMode: (m: Mode) => void; locked?: boolean }) {
  return (
    <div className="mtabs" role="group" aria-label="활동">
      {TABS.map(([k, label, icon]) => (
        <button key={k} className={mode === k ? "on" : ""} aria-pressed={mode === k} disabled={locked && mode !== k} onClick={() => onMode(k)}>
          <ActIcon type={icon} size={18} />
          {label}
        </button>
      ))}
    </div>
  );
}
