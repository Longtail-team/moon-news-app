// 아이콘 (docs/reference/mockup-student.html과 같은 모양)
import type { ReactNode } from "react";

export type ActType = "KR_READING" | "EN_READING" | "VOCA" | "SUMMARY" | "DEBATE";

function Svg({ size = 22, stroke = "currentColor", width = 2, children }: { size?: number; stroke?: string; width?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const Bubble = ({ t, fs }: { t: string; fs: number }) => (
  <>
    <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-8l-4 3.5V17H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <text x="12" y="13.6" textAnchor="middle" fontFamily="Pretendard, sans-serif" fontSize={fs} fontWeight="800" fill="currentColor" stroke="none">
      {t}
    </text>
  </>
);

export const ACT: Record<ActType, { name: string; short: string; icon: ReactNode }> = {
  KR_READING: { name: "한국어 기사 읽기", short: "한국어 기사 읽기", icon: <Bubble t="가" fs={8} /> },
  EN_READING: { name: "영어 기사 읽기", short: "영어 기사 읽기", icon: <Bubble t="A" fs={9} /> },
  VOCA: {
    name: "VOCA",
    short: "VOCA",
    icon: (
      <>
        <rect x="3" y="7.5" width="13" height="13" rx="2" />
        <path d="M8 4h11a2 2 0 0 1 2 2v11" />
      </>
    ),
  },
  SUMMARY: {
    name: "기사 요약",
    short: "기사 요약",
    icon: (
      <>
        <path d="M6.5 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path d="M9 8h6M9 12h6M9 16h3.5" />
      </>
    ),
  },
  DEBATE: {
    name: "찬반토론",
    short: "찬반토론",
    icon: (
      <>
        <path d="M12 4v15M8 20h8M5 7h14" />
        <path d="M2 13a3 3 0 0 0 6 0L5 7z" />
        <path d="M16 13a3 3 0 0 0 6 0L19 7z" />
      </>
    ),
  },
};

export const ACT_ORDER: ActType[] = ["KR_READING", "EN_READING", "VOCA", "SUMMARY", "DEBATE"];

export const ActIcon = ({ type, size = 22 }: { type: ActType; size?: number }) => <Svg size={size}>{ACT[type].icon}</Svg>;

export const CheckIcon = () => (
  <Svg size={18} width={3}>
    <path d="M5 12l5 5 9-10" />
  </Svg>
);
export const HomeIcon = () => (
  <Svg size={24}>
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);
export const DocIcon = () => (
  <Svg size={24}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M14 3v5h5" />
  </Svg>
);
export const UpIcon = () => (
  <Svg size={24}>
    <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
  </Svg>
);
export const DownIcon = () => (
  <Svg size={20} width={2.4}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const UpChevronIcon = () => (
  <Svg size={20} width={2.4}>
    <path d="M6 15l6-6 6 6" />
  </Svg>
);
