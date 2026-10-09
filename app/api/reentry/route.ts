// 다시 들어가기: 번호 → 등록된 보호자·자녀 번호면 새 링크 알림톡 (spec 11장)
// 결과와 상관없이 같은 응답을 준다(번호 등록 여부를 드러내지 않는다). 이전 링크는 살려 둔다.
// 링크 발급·발송은 응답을 보낸 뒤에 해서, 응답 시간으로도 등록 여부를 짐작할 수 없게 한다.
// 미리보기의 시험 번호만 화면에 링크를 보여 줘야 하므로 그때는 기다렸다가 응답한다.
import { after } from "next/server";
import { db } from "@/lib/server/db";
import { json } from "@/lib/server/learner";
import { issueLink, linkUrl } from "@/lib/server/session";
import { devOutbox, isTestPhone, sendAlimtalk } from "@/lib/server/notify";
import { normalizePhone } from "@/lib/phone";

const MAX_PER_HOUR = 3;

async function sendNewLink(phone: string, origin: string): Promise<string | undefined> {
  const { data: count } = await db().rpc("recent_link_requests", { p_phone: phone });
  if ((count as number) >= MAX_PER_HOUR) return;

  const { data } = await db().rpc("reentry_target", { p_phone: phone });
  const t = data as { holder: "guardian" | "child"; guardian_id?: string; student_id?: string } | null;
  if (!t) return;

  const raw = await issueLink(t.holder, { guardianId: t.guardian_id, studentId: t.student_id }, phone);
  const r = await sendAlimtalk({
    template: "new_link",
    to: phone,
    recipient: t.holder,
    guardianId: t.guardian_id ?? null,
    studentId: t.student_id ?? null,
    link: linkUrl(origin, raw),
  });
  return r.devLink;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { phone?: string } | null;
  const phone = normalizePhone(body?.phone ?? "");
  if (!phone) return json({ error: "bad_phone" }, 400);
  const origin = new URL(req.url).origin;

  if (devOutbox() && isTestPhone(phone)) {
    const devLink = await sendNewLink(phone, origin);
    return json(devLink ? { ok: true, devLink } : { ok: true });
  }
  after(() => sendNewLink(phone, origin).catch((e) => console.error("reentry", e instanceof Error ? e.message : e)));
  return json({ ok: true });
}
