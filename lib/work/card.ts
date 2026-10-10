// 기사 요약·VOCA 카드 만들기(T07 PR G): 학습 완료 직전에 그려 올리고, 완료 뒤 활동에 붙인다.
// 인스타에는 이 카드 한 장을 올린다(2026-10-10 결정). 실패해도 학습 완료는 막지 않는다.
import { post, uploadMedia } from "@/lib/client-api";
import { drawSummaryCard } from "@/lib/cards/summary";
import { drawVocaCard } from "@/lib/cards/voca";
import { loadThumb } from "@/lib/cards/thumb";
import { givenName } from "@/lib/format";

type Head = { activity_id: string; type: "SUMMARY" | "VOCA"; week_no: number; cohort_no: number; name: string; date: string; title: string | null; vocab: string[] | null; vocab_total: number | null };

/** 카드를 그려 올리고 저장 경로를 돌려준다(학습 완료 전에 불러야 함). 실패하면 null */
export async function makeWorkCard(o: { activityId: string; photo: Blob | string | null; myTitle?: string; summary?: string; method?: "photo" | "reading" }): Promise<string | null> {
  try {
    const { card: h } = await post<{ card: Head }>("/api/work/card", { activityId: o.activityId });
    const head = { activity_id: h.activity_id, cohort_no: h.cohort_no, week_no: h.week_no, date: h.date, reporter: givenName(h.name) };
    const photo = o.method === "reading" ? null : await loadThumb(o.photo);
    const blob =
      h.type === "SUMMARY"
        ? await drawSummaryCard({ ...head, article_title: h.title, my_title: o.myTitle?.trim() || null, summary: o.summary?.trim() || null, photo }, "insta")
        : await drawVocaCard({ ...head, title: h.title, words: h.vocab ?? [], method: o.method ?? "photo", photo, total_words: h.vocab_total ?? 0 }, "insta");
    if (photo && "close" in photo) (photo as ImageBitmap).close();
    return await uploadMedia(o.activityId, blob, "image/png", "card");
  } catch {
    return null;
  }
}

/** 학습 완료 뒤 카드 붙이기(실패해도 무시) */
export const attachWorkCard = (activityId: string, path: string | null) => (path ? post("/api/activity/card", { activityId, path }).catch(() => {}) : Promise.resolve());
