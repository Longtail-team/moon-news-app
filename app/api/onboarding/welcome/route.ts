// 첫 접속 1단계: 보호자 이름, 알림톡 수신 동의
import { db } from "@/lib/server/db";
import { requireGuardian } from "@/lib/server/guardian";
import { json } from "@/lib/server/learner";

export async function POST(req: Request) {
  const g = await requireGuardian();
  if (!g) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { name?: string; agree?: boolean } | null;
  const name = (body?.name ?? "").trim().slice(0, 40);
  if (!name || body?.agree !== true) return json({ error: "bad request" }, 400);
  const { error } = await db().rpc("onboarding_welcome", { p_guardian: g, p_name: name });
  if (error) return json({ error: "cannot save" }, 409);
  return json({ ok: true });
}
