// 찬반토론 규칙(T07 PR E, 화면 없이 테스트하는 순수 함수)
import { percents } from "@/lib/cards/layout";

export type Stance = "agree" | "disagree" | "unsure";
export type Counts = Record<Stance, number>;
export type Opinion = { stance: Stance; reason: string; at: string; mine?: boolean };
export type DebateBoard = {
  week_no: number;
  cohort_no: number;
  question: string | null;
  open: boolean; // 마감(그 주차 일요일 자정) 전
  ends_at: string;
  counts: Counts; // 다른 친구들(나 빼고)
  mine: { stance: Stance; reason: string | null; at: string; counted: boolean } | null;
  opinions: Opinion[]; // 다른 친구들(이름 없이, 숨긴 글·마감 뒤 글 빼고)
};

export const STANCES: Stance[] = ["agree", "disagree", "unsure"];
export const STANCE_LABEL: Record<Stance, string> = { agree: "찬성해요", disagree: "반대해요", unsure: "잘 모르겠어요" };
export const STANCE_TAG: Record<Stance, string> = { agree: "찬성", disagree: "반대", unsure: "잘 모르겠어요" };
export const REASON_MAX = 80;

/** 화면에 보이는 비율에 쓸 투표 수: 내가 고른 것(아직 안 냈어도)을 더한다. 마감 뒤에 낸 의견은 더하지 않는다 */
export function countsWith(b: Pick<DebateBoard, "counts" | "open" | "mine">, picked: Stance | null): Counts {
  const c = { ...b.counts };
  const mine = b.mine ? (b.mine.counted ? b.mine.stance : null) : b.open ? picked : null;
  if (mine) c[mine] += 1;
  return c;
}

export const total = (c: Counts) => c.agree + c.disagree + c.unsure;
export const pcts = (c: Counts) => percents(c);

/** 비율·친구 의견은 내가 고른 뒤(또는 이미 냈거나) 마감 뒤에 보여 준다 */
export const canSeeResults = (b: Pick<DebateBoard, "open" | "mine">, picked: Stance | null) => !b.open || !!b.mine || !!picked;

/** 친구 의견 목록: 내 의견을 맨 위에(있으면), 거르기 */
export function opinionList(b: Pick<DebateBoard, "opinions" | "mine">, filter: Stance | "all"): Opinion[] {
  const mine: Opinion[] = b.mine?.reason ? [{ stance: b.mine.stance, reason: b.mine.reason, at: b.mine.at, mine: true }] : [];
  return [...mine, ...b.opinions].filter((o) => filter === "all" || o.stance === filter);
}

/** 거르기 칩의 개수(내 의견 포함) */
export function opinionCounts(b: Pick<DebateBoard, "opinions" | "mine">): Record<Stance | "all", number> {
  const all = opinionList(b, "all");
  return { all: all.length, agree: all.filter((o) => o.stance === "agree").length, disagree: all.filter((o) => o.stance === "disagree").length, unsure: all.filter((o) => o.stance === "unsure").length };
}
