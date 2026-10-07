// 활동 시작: 활동 기록을 만들거나(같은 주차·활동의 작성 중 기록이 있으면 이어서) 그 id를 돌려준다
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";

const TYPES = ["KR_READING", "EN_READING", "VOCA", "SUMMARY", "DEBATE"];

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { week?: number; type?: string } | null;
  const week = Number(body?.week);
  if (!Number.isInteger(week) || !TYPES.includes(body?.type ?? "")) return json({ error: "bad request" }, 400);
  const { data, error } = await db().rpc("start_activity", { p_student: learner.student_id, p_week: week, p_type: body!.type });
  if (error) return json({ error: "cannot start" }, 409);
  return json({ activityId: (data as { activity_id: string }).activity_id });
}
