// 작성지 사진 글자 읽기 (기자수첩): 학생이 누를 때만, 활동마다 3번까지. 결과는 화면에 채워 주고 저장은 학생이 확인한 뒤.
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";
import { OcrError, ocrEnabled, readHandwriting } from "@/lib/server/ocr";

export const maxDuration = 60;

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  if (!ocrEnabled()) return json({ error: "unavailable" }, 503);
  const b = (await req.json().catch(() => null)) as { activityId?: string } | null;
  if (!b?.activityId) return json({ error: "bad request" }, 400);

  const { data: key, error } = await db().rpc("ocr_take", { p_student: learner.student_id, p_activity: b.activityId });
  if (error) return json({ error: error.message.includes("ocr limit") ? "limit" : "cannot read" }, 409);
  if (typeof key !== "string") return json({ error: "not found" }, 404);

  const { data: file, error: e2 } = await db().storage.from("media").download(key);
  if (e2 || !file) return json({ error: "file missing" }, 409);
  try {
    return json({ text: await readHandwriting(file) });
  } catch (e) {
    return json({ error: e instanceof OcrError ? e.code : "failed" }, 422);
  }
}
