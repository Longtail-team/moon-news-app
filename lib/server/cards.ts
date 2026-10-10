// 활동 카드(T07 PR C): 읽기 완료 카드 값, 카드 그림 붙이기. 청독 카드는 listening(start_listening)
import "server-only";
import { db } from "./db";
import { fileExists } from "./media";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReadingCardValues = {
  activity_id: string;
  week_no: number;
  title: string | null;
  cohort_no: number;
  name: string;
  date: string;
  lang: "en" | "kr";
  words: number;
  total_words: number;
  total_reads: number;
};

/** 내 읽기 활동의 카드 값(이번 낭독 포함 누적). 남의 활동·읽기가 아니면 null */
export async function readingCardValues(studentId: string, activityId: string): Promise<ReadingCardValues | null> {
  if (!UUID.test(activityId)) return null;
  const { data, error } = await db().rpc("reading_card", { p_student: studentId, p_activity: activityId });
  if (error) throw error;
  return (data as ReadingCardValues | null) ?? null;
}

/** 올린 카드 그림을 활동에 붙인다(파일이 실제로 있을 때만) */
export async function attachCard(studentId: string, activityId: string, path: string): Promise<"ok" | "missing" | "invalid"> {
  if (!UUID.test(activityId)) return "invalid";
  if (!(await fileExists("media", path))) return "missing";
  const { error } = await db().rpc("attach_card", { p_student: studentId, p_activity: activityId, p_card_key: path });
  return error ? "invalid" : "ok";
}

/** 기사 요약·VOCA 카드 머리글 값. 남의 활동·다른 종류면 null */
export async function workCardHead(studentId: string, activityId: string): Promise<Record<string, unknown> | null> {
  if (!UUID.test(activityId)) return null;
  const { data, error } = await db().rpc("card_head", { p_student: studentId, p_activity: activityId });
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? null;
}
