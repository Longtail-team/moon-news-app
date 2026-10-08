// 첫 접속 2단계: 학습자 등록 (새 학습자 또는 지난 기수 학습자). 주문 수량 안에서만.
import { db } from "@/lib/server/db";
import { requireGuardian } from "@/lib/server/guardian";
import { json } from "@/lib/server/learner";

type Learner = { existing?: string; self?: boolean; name?: string; birth?: string; grade?: string; instagram?: string };

export async function POST(req: Request) {
  const g = await requireGuardian();
  if (!g) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { orderId?: string; learners?: Learner[] } | null;
  const list = body?.learners ?? [];
  if (!body?.orderId || list.length === 0 || list.length > 10) return json({ error: "bad request" }, 400);
  const ids: string[] = [];
  for (const l of list) {
    const birth = /^\d{4}-\d{2}$/.test(l.birth ?? "") ? `${l.birth}-01` : null;
    const insta = (l.instagram ?? "").replace(/^@/, "").trim().slice(0, 30) || null;
    const { data, error } = await db().rpc("register_learner", {
      p_guardian: g,
      p_order: body.orderId,
      p_existing: l.existing ?? null,
      p_name: (l.name ?? "").trim().slice(0, 20) || null,
      p_birth_ym: birth,
      p_grade: l.grade ?? null,
      p_instagram: insta,
      p_self: l.self === true,
    });
    if (error)
      return json(
        { error: error.message.includes("no seats") ? "no_seats" : error.message.includes("self already") ? "self_exists" : "cannot register", registered: ids },
        409,
      );
    ids.push(data as string);
  }
  return json({ registered: ids });
}
