// 학습 완료: (새 파일이 있으면 확인해서 붙이고) 학습 완료로 바꾼다
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";
import { fileExists } from "@/lib/server/media";

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { activityId?: string; path?: string } | null;
  if (!body?.activityId) return json({ error: "bad request" }, 400);
  if (body.path && !(await fileExists("media", body.path))) return json({ error: "file missing" }, 409);

  const { data, error } = await db().rpc("complete_activity", { p_student: learner.student_id, p_activity: body.activityId, p_media_key: body.path ?? null });
  if (error) return json({ error: "cannot complete" }, 409);
  const r = data as { week_no: number; week_completed: number; first_en: boolean };
  return json({ weekNo: r.week_no, weekCompleted: r.week_completed, firstEn: r.first_en });
}
