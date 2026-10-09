// 상장 이름 확인 (spec 5·12장): 완주 알림톡 링크도 여기로
import { notFound, redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getFinish } from "@/lib/server/finish";
import { CertificateForm } from "@/components/finish/CertificateForm";
import "../../student.css";

export default async function CertificatePage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { learner } = await pageLearner();
  const e = (await searchParams).e;
  const f = await getFinish(learner.student_id, e);
  if (!f) notFound();
  if (!f.tier) redirect(e ? `/record?e=${e}` : "/record");
  return <CertificateForm f={f} />;
}
