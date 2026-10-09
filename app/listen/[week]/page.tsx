// 청독 (2026-10-09): 그 주차의 음원 3종을 듣고 청독 완료 → 카드
import { redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getMaterial, getWorkMaterial } from "@/lib/server/reading";
import { ListenView, type ListenAudio } from "@/components/listen/ListenView";
import "../../student.css";

export default async function ListenPage({ params }: { params: Promise<{ week: string }> }) {
  const week = Number((await params).week);
  const { learner } = await pageLearner();
  const [m, voca] = await Promise.all([getMaterial(learner.student_id, week), getWorkMaterial(learner.student_id, week, "VOCA")]);
  if (!m) redirect("/activity");
  const audios: ListenAudio[] = [
    m.article ? { type: "article_audio" as const, label: "영어 기사 음원", src: m.article } : null,
    m.krEn ? { type: "kr_en_repeat_audio" as const, label: "새벽달 한영 구간반복", src: m.krEn } : null,
    voca?.vocaAudio ? { type: "voca_repeat_audio" as const, label: "VOCA 구간반복", src: voca.vocaAudio } : null,
  ].filter((a): a is ListenAudio => a !== null);
  return <ListenView week={week} title={m.title} audios={audios} weeklyTarget={m.weekly_target} weekCompleted={m.week_completed} />;
}
