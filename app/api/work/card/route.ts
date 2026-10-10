// 기사 요약·VOCA 카드 값(기수·이름·날짜·기사 제목, VOCA는 이번 주 단어·익힌 단어 수)
import { json, requireLearner } from "@/lib/server/learner";
import { workCardHead } from "@/lib/server/cards";

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { activityId?: string } | null;
  const card = body?.activityId ? await workCardHead(learner.student_id, body.activityId) : null;
  return card ? json({ card }) : json({ error: "not found" }, 404);
}
