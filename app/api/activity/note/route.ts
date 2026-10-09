// 기자수첩·의견 저장 (선택 입력): 기사 요약은 제목·요약, 찬반토론은 입장·이유. 학습 완료 직전에 저장한다.
// 찬반토론 의견은 그 주차 일요일 자정까지만 받는다(마감 뒤에는 저장하지 않음).
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => null)) as { activityId?: string; title?: unknown; body?: unknown; stance?: unknown; reason?: unknown } | null;
  if (!b?.activityId) return json({ error: "bad request" }, 400);
  const stance = b.stance === "agree" || b.stance === "disagree" ? b.stance : null;
  const { error } = await db().rpc("save_note", {
    p_student: learner.student_id,
    p_activity: b.activityId,
    p_title: str(b.title, 60),
    p_body: str(b.body, 2000),
    p_stance: stance,
    p_reason: str(b.reason, 300),
  });
  if (error) return json({ error: error.message.includes("vote closed") ? "vote_closed" : "cannot save" }, 409);
  return json({ ok: true });
}
