// 합친 기사 화면(T07, 2026-10-10): 지문 하나 + 아래 청독 / 기사 읽기 / 찬반토론 시트. ?mode=listen|read|debate, ?lang=en|kr
import { redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getMaterial } from "@/lib/server/reading";
import { ratingNeeded } from "@/lib/server/rating";
import { getDebateBoard } from "@/lib/server/debate";
import { parseLang, parseMode } from "@/lib/article/mode";
import type { ListenAudio } from "@/lib/listen/useListening";
import { ArticleScreen } from "@/components/article/ArticleScreen";
import { MAX_RECORDING_SEC } from "@/lib/video";
import { fmtDay, givenName } from "@/lib/format";
import "../../student.css";
import "../../article.css";

export default async function ArticlePage({ params, searchParams }: { params: Promise<{ week: string }>; searchParams: Promise<{ mode?: string; lang?: string }> }) {
  const week = Number((await params).week);
  const q = await searchParams;
  const { learner } = await pageLearner();
  const [m, listenRatingRequired, debate, debateFeelRequired] = await Promise.all([
    getMaterial(learner.student_id, week),
    ratingNeeded(learner.student_id, week, "listen_understanding"),
    getDebateBoard(learner.student_id, week),
    ratingNeeded(learner.student_id, week, "debate_feel"),
  ]);
  if (!m) redirect("/activity");
  // 청독 음원: 영어 기사 음원·한영 구간반복(VOCA 구간반복은 VOCA 탭에서)
  const audios: ListenAudio[] = [];
  if (m.article) audios.push({ type: "article_audio", label: "영어 기사 음원", src: m.article });
  if (m.krEn) audios.push({ type: "kr_en_repeat_audio", label: "한영 구간반복", src: m.krEn });
  return (
    <ArticleScreen
      key={`${week}-${q.mode ?? ""}-${q.lang ?? ""}`}
      week={week}
      title={m.title}
      sentences={m.sentences}
      preQuestion={m.preQuestion}
      audios={audios}
      weeklyTarget={m.weekly_target}
      weekCompleted={m.week_completed}
      initialMode={parseMode(q.mode)}
      initialLang={parseLang(q.lang)}
      maxSec={MAX_RECORDING_SEC}
      learnerName={givenName(learner.name)}
      deadline={fmtDay(m.deadline)}
      listenRatingRequired={listenRatingRequired}
      debate={debate}
      debateFeelRequired={debateFeelRequired}
    />
  );
}
