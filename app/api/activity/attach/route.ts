// 작성 중 파일 붙이기(사진을 고르자마자): 나갔다 와도 이어서 할 수 있게
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";
import { fileExists } from "@/lib/server/media";

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { activityId?: string; path?: string } | null;
  if (!body?.activityId || !body.path) return json({ error: "bad request" }, 400);
  if (!(await fileExists("media", body.path))) return json({ error: "file missing" }, 409);
  const { error } = await db().rpc("attach_media", { p_student: learner.student_id, p_activity: body.activityId, p_media_key: body.path });
  if (error) return json({ error: "cannot attach" }, 409);
  return json({ ok: true });
}
