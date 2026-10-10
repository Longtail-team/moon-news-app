// 작성 활동: VOCA·기사 요약 (spec.md 6장, 목업 worksheet). 찬반토론은 합친 기사 화면으로 옮김(T07 PR E, 2026-10-10)
import { notFound, redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getWorkMaterial } from "@/lib/server/reading";
import { WorksheetFlow } from "@/components/work/WorksheetFlow";
import { ocrEnabled } from "@/lib/server/ocr";
import { articleHref } from "@/lib/article/mode";
import type { ActType } from "@/components/student/icons";
import "../../../student.css";

const TYPES: Record<string, ActType> = { voca: "VOCA", summary: "SUMMARY" };

export default async function WritePage({ params }: { params: Promise<{ week: string; kind: string }> }) {
  const { week, kind } = await params;
  // 예전 찬반토론 주소(알림톡·바로가기)는 새 화면으로
  if (kind === "debate") redirect(articleHref(Number(week), "debate"));
  const type = TYPES[kind];
  if (!type) notFound();
  const { learner } = await pageLearner();
  const m = await getWorkMaterial(learner.student_id, Number(week), type);
  if (!m) redirect("/activity");
  return <WorksheetFlow kind={kind as "voca" | "summary"} material={m} ocr={ocrEnabled()} />;
}
