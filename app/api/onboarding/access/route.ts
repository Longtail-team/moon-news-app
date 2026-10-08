// 첫 접속 3단계: 학습자마다 본인 휴대폰 여부·보호자 동의. 자녀 번호가 있으면 자녀 링크를 보낸다.
import { db } from "@/lib/server/db";
import { requireGuardian } from "@/lib/server/guardian";
import { json } from "@/lib/server/learner";
import { issueLink, linkUrl } from "@/lib/server/session";
import { sendAlimtalk } from "@/lib/server/notify";
import { normalizePhone } from "@/lib/phone";

export async function POST(req: Request) {
  const g = await requireGuardian();
  if (!g) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as { consent?: boolean; items?: { studentId: string; ownPhone?: string | null }[] } | null;
  if (body?.consent !== true || !body.items?.length) return json({ error: "bad request" }, 400);

  const origin = new URL(req.url).origin;
  const devLinks: { studentId: string; link: string }[] = [];
  for (const it of body.items) {
    const phone = it.ownPhone ? normalizePhone(it.ownPhone) : null;
    if (it.ownPhone && !phone) return json({ error: "bad_phone", studentId: it.studentId }, 400);
    const { error } = await db().rpc("onboarding_access", { p_guardian: g, p_student: it.studentId, p_own_phone: phone });
    if (error) return json({ error: "cannot save" }, 409);
    if (phone) {
      const raw = await issueLink("child", { studentId: it.studentId }, phone);
      const r = await sendAlimtalk({ template: "child_link", to: phone, recipient: "child", studentId: it.studentId, link: linkUrl(origin, raw) });
      if (r.devLink) devLinks.push({ studentId: it.studentId, link: r.devLink });
    }
  }
  return json({ ok: true, devLinks });
}
