// 내 기록 탭 (2026-10-09): 학습자별 기록과 뉴스북, 지난 기수, 설정
import { notFound } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getNewsbook } from "@/lib/server/newsbook";
import { RecordView } from "@/components/record/RecordView";
import { givenName } from "@/lib/format";
import "../student.css";

export default async function RecordPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { session, learner } = await pageLearner();
  const b = await getNewsbook(learner.student_id, (await searchParams).e);
  if (!b) notFound();
  return (
    <RecordView
      b={b}
      profileLabel={`${givenName(learner.name)}${learner.grade ? ` · ${learner.grade}` : ""}`}
      canSwitch={session.holder === "guardian" || session.learners.length > 1}
      isGuardian={session.holder === "guardian"}
    />
  );
}
