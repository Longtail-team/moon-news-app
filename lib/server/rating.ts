// 활동 평가(T07 PR D): 청독 이해도·토론 주제 반응 저장. 학생 화면에는 점수를 보이지 않는다
import "server-only";
import { db } from "./db";
import type { RatingKind } from "@/lib/rating/options";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX: Record<RatingKind, number> = { listen_understanding: 5, debate_feel: 4 };

/** 이 주차에 아직 평가가 없으면 true(= 이번 평가는 필수) */
export async function ratingNeeded(studentId: string, week: number, kind: RatingKind): Promise<boolean> {
  const { data, error } = await db().rpc("rating_needed", { p_student: studentId, p_week: week, p_kind: kind });
  if (error) throw error;
  return data === true;
}

export async function rateActivity(studentId: string, activityId: string, kind: string, value: number): Promise<boolean> {
  if (!UUID.test(activityId) || !(kind in MAX) || !Number.isInteger(value) || value < 1 || value > MAX[kind as RatingKind]) return false;
  const { error } = await db().rpc("rate_activity", { p_student: studentId, p_activity: activityId, p_kind: kind, p_value: value });
  return !error;
}
