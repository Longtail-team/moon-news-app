// 완주 상장 발급(이름 확인 후). 다시 보내면 이름을 바꿔 새로 발급한다(spec 5장)
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => null)) as { name?: unknown; e?: unknown } | null;
  const name = typeof b?.name === "string" ? b.name.trim().slice(0, 20) : "";
  const e = typeof b?.e === "string" && UUID.test(b.e) ? b.e : null;
  if (name.length < 2) return json({ error: "bad_name" }, 400);
  const { error } = await db().rpc("issue_certificate", { p_student: learner.student_id, p_enrollment: e, p_name: name });
  if (error) return json({ error: error.message.includes("not completed") ? "not_completed" : error.message.includes("bad name") ? "bad_name" : "cannot issue" }, 409);
  return json({ ok: true, name });
}
