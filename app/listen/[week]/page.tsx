// 청독 (2026-10-09): 그 주차의 영어 기사 음원·한영 구간반복을 듣고 청독 완료 → 카드 (VOCA 구간반복은 VOCA 탭에서)
import { redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getMaterial } from "@/lib/server/reading";
import { ListenView, type ListenAudio } from "@/components/listen/ListenView";
import "../../student.css";

export default async function ListenPage({ params }: { params: Promise<{ week: string }> }) {
  const week = Number((await params).week);
  const { learner } = await pageLearner();
  const m = await getMaterial(learner.student_id, week);
  if (!m) redirect("/activity");
  const audios: ListenAudio[] = [];
  if (m.article) audios.push({ type: "article_audio", label: "영어 기사 음원", src: m.article });
  if (m.krEn) audios.push({ type: "kr_en_repeat_audio", label: "새벽달 한영 구간반복", src: m.krEn });
  return <ListenView week={week} title={m.title} audios={audios} weeklyTarget={m.weekly_target} weekCompleted={m.week_completed} />;
}
