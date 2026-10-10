// 활동 카드 그림 붙이기(읽기 완료 카드 등, 앱·뉴스북용). 그림은 upload-url(kind=card)로 먼저 올린다
import { json, requireLearner } from "@/lib/server/learner";
import { attachCard } from "@/lib/server/cards";

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { activityId?: string; path?: string } | null;
  if (!body?.activityId || !body.path) return json({ error: "bad request" }, 400);
  const r = await attachCard(learner.student_id, body.activityId, body.path);
  if (r === "missing") return json({ error: "file missing" }, 409);
  if (r === "invalid") return json({ error: "invalid" }, 400);
  return json({ ok: true });
}
