// 활동 평가 남기기(청독 이해도·토론 주제 반응)
import { json, requireLearner } from "@/lib/server/learner";
import { rateActivity } from "@/lib/server/rating";

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => null)) as { activityId?: string; kind?: string; value?: number } | null;
  if (!b?.activityId || !b.kind || typeof b.value !== "number") return json({ error: "bad request" }, 400);
  return (await rateActivity(learner.student_id, b.activityId, b.kind, b.value)) ? json({ ok: true }) : json({ error: "invalid" }, 400);
}
