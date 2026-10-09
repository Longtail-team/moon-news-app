// 알림톡 발송 (솔라피). 계정·발신 프로필·템플릿 승인 전이라 지금은 기록만 남긴다.
// 미리보기(DEV_OUTBOX=1)에서는 보낼 링크를 돌려줘 화면에서 시험할 수 있게 한다. 링크 원문은 DB에 남기지 않는다.
import "server-only";
import { db } from "./db";

export type Template = "start_guide" | "child_link" | "new_link";

export type Outgoing = {
  template: Template;
  to: string;
  recipient: "guardian" | "child";
  guardianId?: string | null;
  studentId?: string | null;
  link: string;
};

export const devOutbox = () => process.env.DEV_OUTBOX === "1";

/** 시험 번호(01000000000~01000009999, scripts/test-order.mjs·샘플 데이터). 미리보기도 운영 DB를 쓰므로 실제 번호의 링크는 화면에 보이지 않게 한다 */
export const isTestPhone = (phone: string) => /^0100000\d{4}$/.test(phone);

/** 보내고(지금은 기록만) 미리보기에서는 링크를 돌려준다 */
export async function sendAlimtalk(m: Outgoing): Promise<{ devLink?: string }> {
  const sent = false; // TODO(솔라피 연결): 버튼은 '외부 브라우저로 열기', 링크는 변수 #{링크}
  const { error } = await db().from("notifications").insert({
    template: m.template,
    recipient: m.recipient,
    sent_to_phone: m.to,
    guardian_id: m.guardianId ?? null,
    student_id: m.studentId ?? null,
    result: sent ? "sent" : "not_sent(솔라피 미연결)",
  });
  if (error) throw error;
  return devOutbox() && isTestPhone(m.to) ? { devLink: m.link } : {};
}
