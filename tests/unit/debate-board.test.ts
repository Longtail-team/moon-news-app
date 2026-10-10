import { describe, expect, it } from "vitest";
import { canSeeResults, countsWith, opinionCounts, opinionList, pcts, total } from "@/lib/debate/board";

const base = { counts: { agree: 21, disagree: 17, unsure: 6 }, open: true, mine: null, opinions: [{ stance: "agree" as const, reason: "a", at: "2026-10-08" }, { stance: "unsure" as const, reason: "b", at: "2026-10-07" }] };

describe("찬반토론 규칙", () => {
  it("비율에 내가 고른 것을 더한다(마감 뒤에 낸 의견은 빼고)", () => {
    expect(countsWith(base, "disagree")).toEqual({ agree: 21, disagree: 18, unsure: 6 });
    expect(countsWith(base, null)).toEqual(base.counts);
    expect(countsWith({ ...base, open: false }, "agree")).toEqual(base.counts); // 마감 뒤 고르기만 한 것
    const late = { ...base, open: false, mine: { stance: "agree" as const, reason: "x", at: "2026-10-20", counted: false } };
    expect(countsWith(late, null)).toEqual(base.counts);
    const sent = { ...base, mine: { stance: "unsure" as const, reason: "x", at: "2026-10-09", counted: true } };
    expect(countsWith(sent, null).unsure).toBe(7);
  });

  it("비율 합 100, 결과는 고른 뒤·낸 뒤·마감 뒤에만", () => {
    const p = pcts(countsWith(base, "disagree"));
    expect(p.agree + p.disagree + p.unsure).toBe(100);
    expect(total(base.counts)).toBe(44);
    expect(canSeeResults(base, null)).toBe(false);
    expect(canSeeResults(base, "agree")).toBe(true);
    expect(canSeeResults({ ...base, open: false }, null)).toBe(true);
  });

  it("친구 의견: 내 의견을 맨 위에, 거르기와 개수", () => {
    const b = { ...base, mine: { stance: "agree" as const, reason: "내 이유", at: "2026-10-09", counted: true } };
    expect(opinionList(b, "all").map((o) => o.reason)).toEqual(["내 이유", "a", "b"]);
    expect(opinionList(b, "unsure").map((o) => o.reason)).toEqual(["b"]);
    expect(opinionCounts(b)).toEqual({ all: 3, agree: 2, disagree: 0, unsure: 1 });
  });
});
