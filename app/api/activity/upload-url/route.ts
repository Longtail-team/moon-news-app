// 파일 올릴 주소: 브라우저가 Storage 비공개 버킷에 바로 올린다(서버 요청 크기 제한을 피하려고)
// 녹음은 recordings/<수강>/, 사진은 photos/<수강>/, 청독 카드는 cards/<수강>/. 경로에 이름·연락처를 넣지 않는다.
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";

const EXT: Record<string, [folder: string, ext: string]> = {
  "audio/mp4": ["recordings", "m4a"],
  "audio/webm": ["recordings", "webm"],
  "audio/ogg": ["recordings", "ogg"],
  "audio/aac": ["recordings", "aac"],
  "audio/mpeg": ["recordings", "mp3"],
  "image/jpeg": ["photos", "jpg"],
  "image/png": ["photos", "png"],
  "image/webp": ["photos", "webp"],
  "image/heic": ["photos", "heic"],
};

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { activityId?: string; mime?: string; kind?: string } | null;
  const mime = (body?.mime ?? "").split(";")[0].trim().toLowerCase();
  // 청독 카드: 휴대폰이 그린 PNG
  const rule = body?.kind === "card" ? (mime === "image/png" ? (["cards", "png"] as [string, string]) : undefined) : EXT[mime];
  if (!body?.activityId || !rule) return json({ error: "bad request" }, 400);

  const { data: owner, error } = await db().rpc("activity_owner", { p_student: learner.student_id, p_activity: body.activityId });
  const o = owner as { enrollment_id: string; completed: boolean } | null;
  if (error || !o || o.completed) return json({ error: "not found" }, 404);

  const path = `${rule[0]}/${o.enrollment_id}/${body.activityId}-${Date.now()}.${rule[1]}`;
  const { data, error: e2 } = await db().storage.from("media").createSignedUploadUrl(path);
  if (e2 || !data) return json({ error: "cannot sign" }, 500);
  return json({ path, uploadUrl: data.signedUrl, contentType: mime });
}
