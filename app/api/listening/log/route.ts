// 청독량: 재생 중에 휴대폰이 나눠 보내는 실제 재생 시간(초). 한 번에 120초까지
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";

const TYPES = ["article_audio", "kr_en_repeat_audio", "voca_repeat_audio"];

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => null)) as { week?: unknown; audio?: unknown; seconds?: unknown } | null;
  const week = Number(b?.week);
  const seconds = Number(b?.seconds);
  if (!Number.isInteger(week) || !TYPES.includes(String(b?.audio)) || !(seconds > 0)) return json({ error: "bad request" }, 400);
  const { error } = await db().rpc("log_listening", { p_student: learner.student_id, p_week: week, p_audio: b!.audio, p_seconds: Math.min(seconds, 120) });
  if (error) return json({ error: "cannot log" }, 409);
  return json({ ok: true });
}
