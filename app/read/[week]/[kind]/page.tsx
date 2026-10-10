// VOCA 단어 낭독(spec 6장: 사진 대신 고를 수 있음). 한국어·영어 기사 읽기는 합친 기사 화면으로 옮김(T07 PR C, 2026-10-10)
import { notFound, redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getWorkMaterial } from "@/lib/server/reading";
import { ReadingFlow } from "@/components/reading/ReadingFlow";
import { MAX_RECORDING_SEC } from "@/lib/video";
import { articleHref } from "@/lib/article/mode";
import "../../../student.css";

export default async function ReadPage({ params }: { params: Promise<{ week: string; kind: string }> }) {
  const { week: w, kind } = await params;
  const week = Number(w);
  // 예전 주소(알림톡·바로가기)는 새 화면으로
  if (kind === "en" || kind === "kr") redirect(articleHref(week, "read", kind));
  if (kind !== "voca") notFound();
  const { learner } = await pageLearner();
  const m = await getWorkMaterial(learner.student_id, week, "VOCA");
  if (!m || m.vocab.length === 0) redirect(`/write/${week}/voca`);
  return (
    <ReadingFlow
      material={{
        week_no: m.week_no,
        weekly_target: m.weekly_target,
        deadline: m.deadline,
        week_completed: m.week_completed,
        title: m.title,
        sentences: m.vocab.map((v) => ({ para_no: v.no, sent_no: v.no, en: v.word, ko: v.meaning })),
      }}
      vocaAudio={m.vocaAudio}
      maxSec={MAX_RECORDING_SEC}
    />
  );
}
