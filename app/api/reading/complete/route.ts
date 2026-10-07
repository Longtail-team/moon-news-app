// 이대로 완료: 올린 녹음을 확인하고 학습 완료로 바꾼다
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { activityId?: string; path?: string } | null;
  if (!body?.activityId || !body.path) return json({ error: "bad request" }, 400);

  // 파일이 실제로 올라갔는지 확인
  const dir = body.path.slice(0, body.path.lastIndexOf("/"));
  const name = body.path.slice(body.path.lastIndexOf("/") + 1);
  const { data: files } = await db().storage.from("media").list(dir, { search: name, limit: 1 });
  if (!files?.some((f) => f.name === name)) return json({ error: "file missing" }, 409);

  const { data, error } = await db().rpc("complete_reading", { p_student: learner.student_id, p_activity: body.activityId, p_media_key: body.path });
  if (error) return json({ error: "cannot complete" }, 409);
  const r = data as { week_no: number; week_completed: number; first_en: boolean };
  return json({ weekNo: r.week_no, weekCompleted: r.week_completed, firstEn: r.first_en });
}
