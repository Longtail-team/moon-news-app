// 다시 들어가기: 번호 → 등록된 보호자·자녀 번호면 새 링크 알림톡 (spec 11장)
// 결과와 상관없이 같은 응답을 준다(번호 등록 여부를 드러내지 않는다). 이전 링크는 살려 둔다.
import { db } from "@/lib/server/db";
import { json } from "@/lib/server/learner";
import { issueLink, linkUrl } from "@/lib/server/session";
import { sendAlimtalk } from "@/lib/server/notify";
import { normalizePhone } from "@/lib/phone";

const MAX_PER_HOUR = 3;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { phone?: string } | null;
  const phone = normalizePhone(body?.phone ?? "");
  if (!phone) return json({ error: "bad_phone" }, 400);

  const same = { ok: true } as { ok: true; devLink?: string };
  const { data: count } = await db().rpc("recent_link_requests", { p_phone: phone });
  if ((count as number) >= MAX_PER_HOUR) return json(same);

  const { data } = await db().rpc("reentry_target", { p_phone: phone });
  const t = data as { holder: "guardian" | "child"; guardian_id?: string; student_id?: string } | null;
  if (!t) return json(same);

  const raw = await issueLink(t.holder, { guardianId: t.guardian_id, studentId: t.student_id }, phone);
  const r = await sendAlimtalk({
    template: "new_link",
    to: phone,
    recipient: t.holder,
    guardianId: t.guardian_id ?? null,
    studentId: t.student_id ?? null,
    link: linkUrl(new URL(req.url).origin, raw),
  });
  return json(r.devLink ? { ...same, devLink: r.devLink } : same);
}
