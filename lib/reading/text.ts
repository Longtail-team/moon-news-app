// 지문을 화면 조각과 하이라이트 순서로 바꾼다.
// 영어는 끊어 읽기 구(" / ") 단위, 한국어는 문장 단위 (spec.md 8장).
// 음원 시간 정보 파일이 생기기 전까지는 예상 시간(영어 단어당 0.4초, 한국어 글자당 0.11초)을 쓴다. 목업과 같은 값.

export type Sentence = { para_no: number; sent_no: number; en: string; ko: string };
export type Step = { ids: string[]; d: number }; // 칠할 조각 id, 1배속 기준 초

const wordCount = (t: string) => t.replace(/—/g, " ").trim().split(/\s+/).filter(Boolean).length;
const T_EN = (chunk: string) => wordCount(chunk) * 0.4;
const T_KO = (sent: string) => sent.replace(/\s/g, "").length * 0.11;

export const chunksOf = (s: Sentence) => s.en.split(" / ");
export const enId = (si: number, ci: number) => `e-${si}-${ci}`;
export const koId = (si: number) => `k-${si}`;

export function paragraphs(sentences: Sentence[]): number[][] {
  const map = new Map<number, number[]>();
  sentences.forEach((s, i) => map.set(s.para_no, [...(map.get(s.para_no) ?? []), i]));
  return [...map.values()];
}

export function timeline(sentences: Sentence[], kind: "en" | "ko"): Step[] {
  const q: Step[] = [];
  sentences.forEach((s, si) => {
    if (kind === "en") {
      const cs = chunksOf(s);
      cs.forEach((c, ci) => q.push({ ids: [enId(si, ci)], d: T_EN(c) + (ci === cs.length - 1 ? 0.35 : 0) }));
    } else {
      q.push({ ids: [koId(si)], d: T_KO(s.ko) + 0.4 });
    }
  });
  return q;
}

export const totalSec = (steps: Step[]) => steps.reduce((n, s) => n + s.d, 0);

// 한영 구간반복 음원의 하이라이트 순서: 한국어 문장 → 영어 문장 2회 (spec 8장)
export function krEnTimeline(sentences: Sentence[]): Step[] {
  const ko = timeline(sentences, "ko");
  const en = timeline(sentences, "en");
  const q: Step[] = [];
  sentences.forEach((s, si) => {
    const ids = chunksOf(s).map((_, ci) => enId(si, ci));
    const d = en.filter((x) => x.ids[0].startsWith(`e-${si}-`)).reduce((n, x) => n + x.d, 0) + 0.4;
    q.push(ko[si], { ids, d }, { ids, d });
  });
  return q;
}

/** 진행 비율(0~1)에 해당하는 조각 */
export function stepAt(steps: Step[], ratio: number): Step | undefined {
  const total = totalSec(steps);
  let t = ratio * total;
  for (const s of steps) {
    if (t < s.d) return s;
    t -= s.d;
  }
  return undefined;
}

export function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
}

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
