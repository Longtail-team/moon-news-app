// 찬반토론 의견 내기(T07 PR E): 시작 → 입장·이유 저장 → 토론 카드(개인 의견 없음) 그려 올리기 → 학습 1회(카드가 활동 파일)
// → 토론 주제 반응 저장 → 인스타용 카드. 내 입장·이유는 앱·뉴스북에만 남는다.
import { post, uploadMedia } from "@/lib/client-api";
import { drawDebateCard, type DebateCardData } from "@/lib/cards/debate";
import { DEBATE_FEELS } from "@/lib/rating/options";
import { countsWith, type DebateBoard, type Stance } from "./board";

export type DebateDone = { weekNo: number; weekCompleted: number; card: { url: string; file: File } };

/** 한국 날짜(YYYY-MM-DD) */
const kstToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

export async function finishDebate(o: { board: DebateBoard; stance: Stance; reason: string; feel: number | null; reporter: string }): Promise<DebateDone> {
  const week = o.board.week_no;
  const a = await post<{ activityId: string }>("/api/activity/start", { week, type: "DEBATE" });
  await post("/api/activity/note", { activityId: a.activityId, week, stance: o.stance, reason: o.reason.trim() });

  const card: DebateCardData = {
    activity_id: a.activityId,
    cohort_no: o.board.cohort_no,
    week_no: week,
    date: kstToday(),
    reporter: o.reporter,
    question: o.board.question ?? "",
    counts: countsWith(o.board, o.stance),
    feel: o.feel ? DEBATE_FEELS[o.feel - 1] : null, // 건너뛰면 카드에 반응을 넣지 않는다
  };
  const path = await uploadMedia(a.activityId, await drawDebateCard(card, "app"), "image/png", "card");
  const c = await post<{ weekNo: number; weekCompleted: number }>("/api/activity/complete", { activityId: a.activityId, path });
  if (o.feel) await post("/api/rating", { activityId: a.activityId, kind: "debate_feel", value: o.feel }).catch(() => {});
  const blob = await drawDebateCard(card, "insta");
  return { ...c, card: { url: URL.createObjectURL(blob), file: new File([blob], `새벽달영어뉴스_${week}주차_토론.png`, { type: "image/png" }) } };
}
