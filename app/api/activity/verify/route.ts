// 인스타 인증: 붙여넣은 게시물 링크를 정리해서 저장한다
import { db } from "@/lib/server/db";
import { json, requireLearner } from "@/lib/server/learner";
import { normalizeInstaUrl } from "@/lib/insta";

export async function POST(req: Request) {
  const learner = await requireLearner();
  if (!learner) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { activityId?: string; url?: string } | null;
  if (!body?.activityId) return json({ error: "bad request" }, 400);
  const url = normalizeInstaUrl(body.url ?? "");
  if (!url) return json({ error: "not_instagram" }, 400);

  const { data, error } = await db().rpc("verify_activity", { p_student: learner.student_id, p_activity: body.activityId, p_post_url: url });
  if (error) return json({ error: error.code === "23505" ? "duplicate" : "cannot verify" }, 409);
  const r = data as { verified_count: number; pending_count: number };
  return json({ verifiedCount: r.verified_count, pendingCount: r.pending_count, url });
}
