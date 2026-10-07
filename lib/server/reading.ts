import "server-only";
import { db } from "./db";
import type { ActType } from "@/components/student/icons";
import type { Sentence } from "@/lib/reading/text";

export type PickerWeek = { week_no: number; title: string | null; completed: number; counts: Partial<Record<ActType, number>>; in_progress: ActType[] };
export type Picker = { weekly_target: number; current_week: number | null; weeks: PickerWeek[] };

export async function getPicker(studentId: string): Promise<Picker | null> {
  const { data, error } = await db().rpc("activity_picker", { p_student: studentId });
  if (error) throw error;
  return (data as Picker | null) ?? null;
}

export type Material = {
  week_no: number;
  weekly_target: number;
  week_completed: number;
  title: string;
  word_count: number | null;
  sentences: Sentence[];
  audio: { article: string | null; krEn: string | null };
};

/** 낭독 화면 자료. 음원은 파일이 실제로 있을 때만 짧은 유효시간 주소를 준다. */
export async function getMaterial(studentId: string, week: number): Promise<Material | null> {
  const { data, error } = await db().rpc("reading_material", { p_student: studentId, p_week: week });
  if (error) throw error;
  if (!data) return null;
  const m = data as Omit<Material, "audio"> & { assets: { type: string; storage_key: string }[] };
  const sign = async (type: string) => {
    const a = m.assets.find((x) => x.type === type);
    if (!a) return null;
    const { data: s, error: e } = await db().storage.from("course").createSignedUrl(a.storage_key, 60 * 60);
    return e || !s ? null : s.signedUrl;
  };
  const [article, krEn] = await Promise.all([sign("article_audio"), sign("kr_en_repeat_audio")]);
  return { week_no: m.week_no, weekly_target: m.weekly_target, week_completed: m.week_completed, title: m.title, word_count: m.word_count, sentences: m.sentences, audio: { article, krEn } };
}
