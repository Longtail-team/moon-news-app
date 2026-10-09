// 완주 화면 (spec 9장): 60번째 인증 직후, 홈 완주 카드, 내 기록에서 들어온다. 완주 전이면 내 기록으로
import { notFound, redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getFinish } from "@/lib/server/finish";
import { FinishView } from "@/components/finish/FinishView";
import "../student.css";

export default async function FinishPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { learner } = await pageLearner();
  const e = (await searchParams).e;
  const f = await getFinish(learner.student_id, e);
  if (!f) notFound();
  if (!f.tier) redirect(e ? `/record?e=${e}` : "/record");
  return <FinishView f={f} />;
}
