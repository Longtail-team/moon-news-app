// 작성 활동: VOCA·기사 요약·찬반토론 (spec.md 6장, 목업 worksheet)
import { notFound, redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getWorkMaterial } from "@/lib/server/reading";
import { WorksheetFlow } from "@/components/work/WorksheetFlow";
import { ocrEnabled } from "@/lib/server/ocr";
import type { ActType } from "@/components/student/icons";
import "../../../student.css";

const TYPES: Record<string, ActType> = { voca: "VOCA", summary: "SUMMARY", debate: "DEBATE" };

export default async function WritePage({ params }: { params: Promise<{ week: string; kind: string }> }) {
  const { week, kind } = await params;
  const type = TYPES[kind];
  if (!type) notFound();
  const { learner } = await pageLearner();
  const m = await getWorkMaterial(learner.student_id, Number(week), type);
  if (!m) redirect("/activity");
  return <WorksheetFlow kind={kind as "voca" | "summary" | "debate"} material={m} ocr={ocrEnabled()} />;
}
