// 친구 의견 거르기(T07 PR F): 의견을 저장한 뒤 금칙어·연락처에 걸리면 친구들에게만 숨긴다.
// AI 검사는 아직 쓰지 않는다(아이 글을 외부 AI로 보내는 동의 범위·법률 검토 뒤 설정값으로 켬, T06 6장).
import "server-only";
import { db } from "./db";
import { checkOpinion } from "@/lib/moderation/filter";

export async function moderateOpinion(studentId: string, activityId: string, reason: string | null): Promise<void> {
  if (!reason) return;
  const r = checkOpinion(reason);
  if (!r.hide) return;
  await db().rpc("hide_note", { p_student: studentId, p_activity: activityId, p_why: r.why });
}
