import "server-only";
import { db } from "./db";
import { signedUrl } from "./media";
import type { ActType } from "@/components/student/icons";
import type { Sentence } from "@/lib/reading/text";

export type PickerWeek = { week_no: number; title: string | null; completed: number; counts: Partial<Record<ActType, number>>; in_progress: ActType[] };
export type Picker = { weekly_target: number; current_week: number | null; weeks: PickerWeek[] };

export async function getPicker(studentId: string): Promise<Picker | null> {
  const { data, error } = await db().rpc("activity_picker", { p_student: studentId });
  if (error) throw error;
  return (data as Picker | null) ?? null;
}

/** 낭독 화면에 넘기는 자료 (브라우저로 가는 값만) */
export type Material = {
  week_no: number;
  weekly_target: number;
  week_completed: number;
  title: string;
  sentences: Sentence[];
};

export type AudioSrc = { key: string; label: string; src: string | null; highlight?: "en" | "kren" };

type Asset = { type: string; storage_key: string; file_name?: string };

/** 낭독 화면 자료와 음원(파일이 실제로 있을 때만 짧은 유효시간 주소) */
export async function getMaterial(studentId: string, week: number): Promise<(Material & { article: string | null; krEn: string | null }) | null> {
  const { data, error } = await db().rpc("reading_material", { p_student: studentId, p_week: week });
  if (error) throw error;
  if (!data) return null;
  const m = data as Material & { assets: Asset[] };
  const key = (t: string) => m.assets.find((x) => x.type === t)?.storage_key;
  const [article, krEn] = await Promise.all([signedUrl("course", key("article_audio")), signedUrl("course", key("kr_en_repeat_audio"))]);
  return { week_no: m.week_no, weekly_target: m.weekly_target, week_completed: m.week_completed, title: m.title, sentences: m.sentences, article, krEn };
}

export type WorkMaterial = {
  week_no: number;
  weekly_target: number;
  week_completed: number;
  title: string;
  vocab: { no: number; word: string; meaning: string }[];
  articlePdf: string | null;
  vocaPdf: string | null;
  vocaAudio: string | null;
  draft: { activityId: string; photoUrl: string | null } | null;
};

/** 작성 활동 자료: 작성지 PDF, VOCA 단어·음원, 이어서 할 작성 중 기록(사진 미리보기 주소) */
export async function getWorkMaterial(studentId: string, week: number, type: ActType): Promise<WorkMaterial | null> {
  const { data, error } = await db().rpc("work_material", { p_student: studentId, p_week: week, p_type: type });
  if (error) throw error;
  if (!data) return null;
  const m = data as Omit<WorkMaterial, "articlePdf" | "vocaPdf" | "vocaAudio" | "draft"> & {
    assets: Asset[];
    draft: { activity_id: string; media_key: string | null } | null;
  };
  const key = (t: string) => m.assets.find((x) => x.type === t)?.storage_key;
  const photoKey = m.draft?.media_key?.startsWith("photos/") ? m.draft.media_key : null;
  const [articlePdf, vocaPdf, vocaAudio, photoUrl] = await Promise.all([
    signedUrl("course", key("article_pdf")),
    signedUrl("course", key("voca_pdf")),
    signedUrl("course", key("voca_repeat_audio")),
    signedUrl("media", photoKey),
  ]);
  return {
    week_no: m.week_no,
    weekly_target: m.weekly_target,
    week_completed: m.week_completed,
    title: m.title,
    vocab: m.vocab,
    articlePdf,
    vocaPdf,
    vocaAudio,
    draft: m.draft ? { activityId: m.draft.activity_id, photoUrl } : null,
  };
}

export type QueueItem = {
  activity_id: string;
  week_no: number;
  activity_type: ActType;
  completed_at: string;
  kind: "video" | "photo";
  mediaUrl: string | null; // 사진 저장·영상 재료 (짧은 유효시간)
  templateUrl: string | null; // 영상 화면 (2단계)
};
export type Queue = { deadline: string; total_target: number; verified_count: number; items: QueueItem[] };

/** 인스타 올리기 목록 */
export async function getQueue(studentId: string): Promise<Queue | null> {
  const { data, error } = await db().rpc("upload_queue", { p_student: studentId });
  if (error) throw error;
  if (!data) return null;
  const q = data as Omit<Queue, "items"> & { items: (Omit<QueueItem, "mediaUrl" | "templateUrl"> & { media_key: string; template_key: string | null })[] };
  const items = await Promise.all(
    q.items.map(async ({ media_key, template_key, ...it }) => ({
      ...it,
      mediaUrl: await signedUrl("media", media_key),
      templateUrl: await signedUrl("course", template_key),
    })),
  );
  return { deadline: q.deadline, total_target: q.total_target, verified_count: q.verified_count, items };
}
