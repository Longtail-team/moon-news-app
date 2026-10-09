// 내 기록 > 설정: 사진 글자 읽기(외부 AI) 동의 켜기·끄기. 보호자만 바꿀 수 있다.
import { db } from "@/lib/server/db";
import { requireGuardian } from "@/lib/server/guardian";
import { json, requireLearner } from "@/lib/server/learner";

export async function POST(req: Request) {
  const g = await requireGuardian();
  const learner = await requireLearner();
  if (!g || !learner) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => null)) as { on?: boolean } | null;
  if (typeof b?.on !== "boolean") return json({ error: "bad request" }, 400);
  const { error } = await db().rpc("set_ai_consent", { p_guardian: g, p_student: learner.student_id, p_on: b.on });
  if (error) return json({ error: "cannot save" }, 409);
  return json({ ok: true, on: b.on });
}
