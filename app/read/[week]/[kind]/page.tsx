// 낭독 화면 (spec.md 8장, 목업 reading·recording·review)
// en = 영어 기사 낭독, kr = 한국어 기사 낭독, voca = VOCA 단어 낭독(사진 대신 고를 수 있음, spec 6장)
import { notFound, redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getMaterial, getWorkMaterial, type AudioSrc, type Material } from "@/lib/server/reading";
import { ReadingFlow } from "@/components/reading/ReadingFlow";
import { MAX_RECORDING_SEC } from "@/lib/video";
import { fmtDay, givenName } from "@/lib/format";
import "../../../student.css";

export default async function ReadPage({ params }: { params: Promise<{ week: string; kind: string }> }) {
  const { week: w, kind } = await params;
  if (kind !== "en" && kind !== "kr" && kind !== "voca") notFound();
  const week = Number(w);
  const { learner } = await pageLearner();

  let material: Material;
  let audios: AudioSrc[];
  let articlePdf: string | null = null;
  let preQuestion: string | null = null;
  if (kind === "voca") {
    const m = await getWorkMaterial(learner.student_id, week, "VOCA");
    if (!m || m.vocab.length === 0) redirect(`/write/${week}/voca`);
    material = {
      week_no: m.week_no,
      weekly_target: m.weekly_target,
      deadline: m.deadline,
      week_completed: m.week_completed,
      title: m.title,
      sentences: m.vocab.map((v) => ({ para_no: v.no, sent_no: v.no, en: v.word, ko: v.meaning })),
    };
    audios = [{ key: "voca", label: "VOCA 구간반복 음원", src: m.vocaAudio }];
  } else {
    const m = await getMaterial(learner.student_id, week);
    if (!m) redirect("/activity");
    material = m;
    articlePdf = m.articlePdf;
    preQuestion = m.preQuestion;
    audios = [
      ...(kind === "en" ? [{ key: "article", label: "영어 기사 음원", src: m.article, highlight: "en" as const }] : []),
      { key: "krEn", label: "새벽달 한영 구간반복", src: m.krEn, highlight: "kren" as const },
    ];
  }

  return (
    <ReadingFlow
      kind={kind}
      material={material}
      audios={audios}
      maxSec={MAX_RECORDING_SEC}
      learnerName={givenName(learner.name)}
      deadline={fmtDay(material.deadline)}
      articlePdf={articlePdf}
      preQuestion={preQuestion}
    />
  );
}
