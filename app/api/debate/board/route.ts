// 찬반토론 판 다시 읽기(의견을 낸 뒤 친구 의견·비율 새로 고침)
import { json, requireLearner } from "@/lib/server/learner";
import { getDebateBoard } from "@/lib/server/debate";

export async function GET(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const week = Number(new URL(req.url).searchParams.get("week"));
  if (!Number.isInteger(week) || week < 1) return json({ error: "bad request" }, 400);
  const board = await getDebateBoard(learner.student_id, week);
  return board ? json({ board }) : json({ error: "not found" }, 404);
}
