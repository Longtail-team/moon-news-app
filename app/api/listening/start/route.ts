// 청독 완료 준비: 작성 중 청독 기록과 카드 값(들은 음원 횟수, 이번 시간, 누적 시간)을 받는다.
// 휴대폰이 카드를 그려 올린 뒤 /api/activity/complete로 학습 완료
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";

const TYPES = ["article_audio", "kr_en_repeat_audio", "voca_repeat_audio"];

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => null)) as { week?: unknown; plays?: Record<string, unknown>; sessionSeconds?: unknown } | null;
  const week = Number(b?.week);
  if (!Number.isInteger(week) || !b?.plays || typeof b.plays !== "object") return json({ error: "bad request" }, 400);
  const plays = Object.fromEntries(TYPES.map((t) => [t, Math.max(0, Math.min(99, Math.floor(Number(b.plays![t]) || 0)))]).filter(([, n]) => (n as number) > 0));
  const session = Math.max(0, Math.min(6 * 3600, Math.round(Number(b.sessionSeconds) || 0)));
  const { data, error } = await db().rpc("start_listening", { p_student: learner.student_id, p_week: week, p_plays: plays, p_session_seconds: session });
  if (error) return json({ error: error.message.includes("no plays") ? "no_plays" : "cannot start" }, 409);
  return json({ card: data });
}
