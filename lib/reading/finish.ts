// 기사 읽기 완료(T07 PR C): 녹음 올리기 → 읽기 완료 카드(앱·뉴스북용) 그려 올리기 → 학습 1회 → 카드 붙이기 → 인스타용 카드
// 카드를 만들지 못해도 학습 완료는 막지 않는다(녹음이 학습의 기준).
import { post, uploadMedia } from "@/lib/client-api";
import { drawReadingCard, type ReadingCardData } from "@/lib/cards/reading";
import { givenName } from "@/lib/format";
import type { RecResult } from "./useRecording";

type CardValues = Omit<ReadingCardData, "reporter" | "record_seconds"> & { name: string };
export type ReadDone = { weekNo: number; weekCompleted: number; firstEn: boolean; card: { url: string; file: File } | null };

export async function finishReading(activityId: string, result: RecResult): Promise<ReadDone> {
  const path = await uploadMedia(activityId, result.blob, result.mime);

  // 카드(앱·뉴스북용 보관): 실패해도 계속
  let card: ReadingCardData | null = null;
  let cardPath: string | null = null;
  try {
    const r = await post<{ card: CardValues }>("/api/reading/card", { activityId });
    card = { ...r.card, reporter: givenName(r.card.name), record_seconds: result.sec };
    cardPath = await uploadMedia(activityId, await drawReadingCard(card, "app"), "image/png", "card");
  } catch {}

  const c = await post<{ weekNo: number; weekCompleted: number; firstEn: boolean }>("/api/activity/complete", { activityId, path });
  if (cardPath) await post("/api/activity/card", { activityId, path: cardPath }).catch(() => {});

  // 인스타용(제목 크게): 저장할 때 쓰도록 미리 그려 둔다(앱용을 다 그린 뒤 차례로)
  let insta: ReadDone["card"] = null;
  if (card) {
    try {
      const blob = await drawReadingCard(card, "insta");
      const name = `새벽달영어뉴스_${card.week_no}주차_${card.lang === "en" ? "영어" : "한국어"}낭독.png`;
      insta = { url: URL.createObjectURL(blob), file: new File([blob], name, { type: "image/png" }) };
    } catch {}
  }
  return { ...c, card: insta };
}
