// 청독 완료(기존 ListenView에서 옮김): 서버에 청독 기록 → 카드 두 가지(앱·뉴스북용 보관, 인스타용 저장) 그리기 → 보관용 올리기 → 학습 1회
import { post, uploadMedia } from "@/lib/client-api";
import { drawListeningCard, type ListeningCardData } from "@/lib/cards/listening";
import { givenName } from "@/lib/format";
import type { AudioType } from "@/lib/listening";

export type ListenDone = { url: string; file: File; weekCompleted: number };

export async function finishListening(week: number, plays: Partial<Record<AudioType, number>>, sessionSeconds: number): Promise<ListenDone> {
  const r = await post<{ card: Omit<ListeningCardData, "reporter"> }>("/api/listening/start", { week, plays, sessionSeconds: Math.round(sessionSeconds) });
  const card: ListeningCardData = { ...r.card, reporter: givenName(r.card.name) };
  // 저사양 휴대폰: 두 장을 차례로 그린다(동시에 그리면 메모리를 두 배로 씀)
  const appBlob = await drawListeningCard(card, "app");
  const instaBlob = await drawListeningCard(card, "insta");
  const path = await uploadMedia(card.activity_id, appBlob, "image/png", "card");
  const c = await post<{ weekCompleted: number }>("/api/activity/complete", { activityId: card.activity_id, path });
  const file = new File([instaBlob], `새벽달영어뉴스_${week}주차_청독.png`, { type: "image/png" });
  return { url: URL.createObjectURL(instaBlob), file, weekCompleted: c.weekCompleted };
}
