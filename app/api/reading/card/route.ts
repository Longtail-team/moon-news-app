// 읽기 완료 카드 값: 휴대폰이 카드를 그릴 때 쓴다(이번 낭독 포함 누적 단어·횟수)
import { json, requireLearner } from "@/lib/server/learner";
import { readingCardValues } from "@/lib/server/cards";

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { activityId?: string } | null;
  const card = body?.activityId ? await readingCardValues(learner.student_id, body.activityId) : null;
  if (!card) return json({ error: "not found" }, 404);
  return json({ card });
}
