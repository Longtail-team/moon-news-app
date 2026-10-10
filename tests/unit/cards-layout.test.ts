import { describe, expect, it } from "vitest";
import { clampLines, fitTitle, percents, stampSpot, wrapWords } from "@/lib/cards/layout";

// 글자 하나 = 10px로 재는 가짜 측정
const m = (t: string) => t.length * 10;

describe("카드 배치 규칙", () => {
  it("단어 단위로 줄바꿈하고, 폭보다 긴 단어는 그 단어만 한 줄", () => {
    expect(wrapWords(m, "aa bb cc", 50)).toEqual(["aa bb", "cc"]);
    expect(wrapWords(m, "abcdefghij kk", 50)).toEqual(["abcdefghij", "kk"]);
    expect(wrapWords(m, "  ", 50)).toEqual([]);
  });

  it("제목은 큰 글자부터 줄 수가 맞는 첫 크기, 다 넘치면 마지막 크기", () => {
    const measure = (size: number, t: string) => t.length * size;
    expect(fitTitle(measure, "aa bb cc", [[10, 1], [5, 99]], 80)).toEqual({ size: 10, lines: ["aa bb cc"] });
    expect(fitTitle(measure, "aa bb cc", [[20, 1], [10, 2]], 80)).toEqual({ size: 10, lines: ["aa bb cc"] });
    expect(fitTitle(measure, "aa bb cc dd ee", [[20, 1], [10, 1]], 80).size).toBe(10);
  });

  it("넘치는 글은 줄 수에 맞춰 자르고 끝에 …", () => {
    expect(clampLines(m, "aa bb cc dd", 50, 1)).toEqual(["aa b…"]);
    expect(clampLines(m, "aa bb", 50, 2)).toEqual(["aa bb"]);
  });

  it("도장 자리: 빈 곳 안에서 x → y 순서로 정하고, 좁으면 대신 자리", () => {
    const seq = [0, 1];
    const rand = () => seq.shift()!;
    expect(stampSpot(rand, { top: 100, bottom: 200, left: 10, width: 400, size: 300, fallback: { x: 1, y: 2 } })).toEqual({ x: 10, y: 200 });
    expect(stampSpot(() => 0.5, { top: 300, bottom: 200, left: 0, width: 400, size: 300, fallback: { x: 1, y: 2 } })).toEqual({ x: 1, y: 2 });
  });

  it("찬반 비율은 합이 100, 0명이면 모두 0", () => {
    const p = percents({ agree: 22, disagree: 17, unsure: 6 });
    expect(p.agree + p.disagree + p.unsure).toBe(100);
    expect(p).toEqual({ agree: 49, disagree: 38, unsure: 13 });
    expect(percents({ agree: 1, disagree: 1, unsure: 1 })).toEqual({ agree: 34, disagree: 33, unsure: 33 });
    expect(percents({ agree: 0, disagree: 0, unsure: 0 })).toEqual({ agree: 0, disagree: 0, unsure: 0 });
  });
});
