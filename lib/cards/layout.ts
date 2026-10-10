// 카드 배치 규칙(그리기와 분리한 순수 함수, 단위 테스트 대상)

/** 제목 크기 단계: [글자 크기, 그 크기에서 허용하는 최대 줄 수] */
export type TitleStep = [size: number, maxLines: number];

/** 단어 단위 줄바꿈. 한 단어가 폭보다 길면 그 단어만 한 줄 */
export function wrapWords(measure: (t: string) => number, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** 큰 글자부터 시도해 줄 수가 허용 범위에 들어오는 첫 크기. 마지막 단계는 줄 수 상관없이 씀 */
export function fitTitle(measure: (size: number, t: string) => number, text: string, steps: TitleStep[], maxW: number) {
  let size = steps[0][0];
  let lines: string[] = [];
  for (const [s, max] of steps) {
    size = s;
    lines = wrapWords((t) => measure(s, t), text, maxW);
    if (lines.length <= max) break;
  }
  return { size, lines };
}

/** 넘치는 글을 줄 수에 맞춰 자르고 마지막 줄 끝에 "…" */
export function clampLines(measure: (t: string) => number, text: string, maxW: number, maxLines: number): string[] {
  const lines = wrapWords(measure, text, maxW);
  if (lines.length <= maxLines) return lines;
  const out = lines.slice(0, maxLines);
  let last = out[maxLines - 1];
  while (last.length > 1 && measure(`${last}…`) > maxW) last = last.slice(0, -1);
  out[maxLines - 1] = `${last.trimEnd()}…`;
  return out;
}

/**
 * 도장 자리: top~bottom 사이(도장 윗변 기준) 아무 곳. 빈 곳이 좁으면(bottom < top) fallback.
 * rand는 x → y 순서로 쓴다(기존 청독 카드와 같은 순서라 이미 그린 카드와 같은 자리).
 */
export function stampSpot(
  rand: () => number,
  a: { top: number; bottom: number; left: number; width: number; size: number; fallback: { x: number; y: number } },
): { x: number; y: number } {
  if (a.bottom < a.top) return a.fallback;
  const x = a.left + rand() * (a.width - a.size);
  const y = a.top + rand() * (a.bottom - a.top);
  return { x, y };
}

/** 찬반 비율: 반올림하되 합이 100이 되게(남는 차이는 가장 큰 나머지 순으로). 0명이면 모두 0 */
export function percents<K extends string>(counts: Record<K, number>): Record<K, number> {
  const keys = Object.keys(counts) as K[];
  const total = keys.reduce((n, k) => n + counts[k], 0);
  const out = {} as Record<K, number>;
  if (total <= 0) {
    keys.forEach((k) => (out[k] = 0));
    return out;
  }
  const raw = keys.map((k) => ({ k, v: (counts[k] / total) * 100 }));
  raw.forEach(({ k, v }) => (out[k] = Math.floor(v)));
  let left = 100 - raw.reduce((n, { k }) => n + out[k], 0);
  for (const { k } of [...raw].sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)))) {
    if (left <= 0) break;
    out[k] += 1;
    left -= 1;
  }
  return out;
}
