// 완주 상장 PDF 받기: 이름을 확인해 발급한 뒤에만. 누를 때 만들고 서버에 남기지 않는다.
import { NextResponse } from "next/server";
import { requireLearner } from "@/lib/server/learner";
import { getFinish } from "@/lib/server/finish";
import { renderCertificate } from "@/lib/pdf/certificate";

export const maxDuration = 30;

export async function GET(req: Request) {
  const learner = await requireLearner();
  if (!learner) return new NextResponse(null, { status: 404 });
  const f = await getFinish(learner.student_id, new URL(req.url).searchParams.get("e"));
  if (!f || !f.tier || !f.certificate_name || !f.completed_at) return new NextResponse(null, { status: 404 });
  const pdf = await renderCertificate({
    name: f.certificate_name,
    courseTitle: f.cohort.course_title,
    cohortNo: f.cohort.cohort_no,
    startDate: f.cohort.start_date,
    deadline: f.cohort.deadline,
    completedAt: f.completed_at,
  });
  const file = `새벽달영어뉴스_${f.cohort.cohort_no}기_완주상장_${f.certificate_name}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate.pdf"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
