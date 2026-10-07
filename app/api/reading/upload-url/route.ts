// 녹음 올릴 주소: 브라우저가 Storage 비공개 버킷에 바로 올린다(서버 요청 크기 제한을 피하려고)
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";

const EXT: Record<string, string> = { "audio/mp4": "m4a", "audio/webm": "webm", "audio/ogg": "ogg", "audio/aac": "aac", "audio/mpeg": "mp3" };

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { activityId?: string; mime?: string } | null;
  const mime = (body?.mime ?? "").split(";")[0].trim();
  const ext = EXT[mime];
  if (!body?.activityId || !ext) return json({ error: "bad request" }, 400);

  const { data: owner, error } = await db().rpc("activity_owner", { p_student: learner.student_id, p_activity: body.activityId });
  const o = owner as { enrollment_id: string; completed: boolean } | null;
  if (error || !o || o.completed) return json({ error: "not found" }, 404);

  // 경로에 이름·연락처를 넣지 않는다
  const path = `recordings/${o.enrollment_id}/${body.activityId}-${Date.now()}.${ext}`;
  const { data, error: e2 } = await db().storage.from("media").createSignedUploadUrl(path);
  if (e2 || !data) return json({ error: "cannot sign" }, 500);
  return json({ path, uploadUrl: data.signedUrl, contentType: mime });
}
