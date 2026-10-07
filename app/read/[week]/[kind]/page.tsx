// 낭독 화면 (spec.md 8장, 목업 reading·recording·review)
import { notFound, redirect } from "next/navigation";
import { currentLearner, getSession } from "@/lib/server/session";
import { getMaterial } from "@/lib/server/reading";
import { getHome } from "@/lib/server/home";
import { ReadingFlow } from "@/components/reading/ReadingFlow";
import { MAX_RECORDING_SEC } from "@/lib/video";
import { fmtDay, givenName } from "@/lib/format";
import "../../../student.css";

export default async function ReadPage({ params }: { params: Promise<{ week: string; kind: string }> }) {
  const { week, kind } = await params;
  if (kind !== "en" && kind !== "kr") notFound();
  const session = await getSession();
  if (!session) redirect("/");
  const learner = await currentLearner(session);
  if (!learner) redirect("/profiles");
  const [material, home] = await Promise.all([getMaterial(learner.student_id, Number(week)), getHome(learner.student_id)]);
  if (!material || !home) redirect("/activity");

  return (
    <ReadingFlow
      kind={kind}
      material={material}
      maxSec={MAX_RECORDING_SEC}
      learnerName={givenName(learner.name)}
      deadline={fmtDay(home.cohort.deadline)}
    />
  );
}
