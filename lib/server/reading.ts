import "server-only";
import { db } from "./db";
import { activityMediaUrl, courseFileUrl } from "./media";
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
  deadline: string;
  week_completed: number;
  title: string;
  sentences: Sentence[];
};

export type AudioSrc = { key: string; label: string; src: string | null; highlight?: "en" | "kren" };

type Asset = { type: string; storage_key: string; file_name?: string };

/** 낭독 화면 자료와 음원·기사 PDF(앱 주소) */
export async function getMaterial(
  studentId: string,
  week: number,
): Promise<(Material & { article: string | null; krEn: string | null; articlePdf: string | null; preQuestion: string | null }) | null> {
  const { data, error } = await db().rpc("reading_material", { p_student: studentId, p_week: week });
  if (error) throw error;
  if (!data) return null;
  const m = data as Material & { assets: Asset[]; pre_question: string | null };
  const url = (t: string) => courseFileUrl(week, t, m.assets.find((x) => x.type === t)?.storage_key);
  return {
    week_no: m.week_no,
    weekly_target: m.weekly_target,
    deadline: m.deadline,
    week_completed: m.week_completed,
    title: m.title,
    sentences: m.sentences,
    article: url("article_audio"),
    krEn: url("kr_en_repeat_audio"),
    articlePdf: url("article_pdf"),
    preQuestion: m.pre_question,
  };
}

export type Tally = { agree: number; disagree: number; mine: "agree" | "disagree" };
export type Note = { title: string | null; body: string | null; stance: "agree" | "disagree" | null; reason: string | null; ocr_left: number };

export type WorkMaterial = {
  week_no: number;
  weekly_target: number;
  deadline: string;
  vote_open: boolean; // 찬반토론 의견은 그 주차 일요일 자정까지만
  ocr_consent: boolean; // 보호자가 사진 글자 읽기(외부 AI)에 동의함
  tally: Tally | null; // 찬반 결과: 이 주차에 내 의견을 골랐을 때만
  week_completed: number;
  title: string;
  vocab: { no: number; word: string; meaning: string }[];
  articlePdf: string | null;
  vocaPdf: string | null;
  vocaAudio: string | null;
  draft: { activityId: string; photoUrl: string | null; note: Note | null } | null;
};

/** 작성 활동 자료: 작성지 PDF, VOCA 단어·음원, 이어서 할 작성 중 기록(사진 미리보기는 앱 주소) */
export async function getWorkMaterial(studentId: string, week: number, type: ActType): Promise<WorkMaterial | null> {
  const { data, error } = await db().rpc("work_material", { p_student: studentId, p_week: week, p_type: type });
  if (error) throw error;
  if (!data) return null;
  const m = data as Omit<WorkMaterial, "articlePdf" | "vocaPdf" | "vocaAudio" | "draft"> & {
    assets: Asset[];
    draft: { activity_id: string; media_key: string | null; note: Note | null } | null;
  };
  const url = (t: string) => courseFileUrl(week, t, m.assets.find((x) => x.type === t)?.storage_key);
  const photoKey = m.draft?.media_key?.startsWith("photos/") ? m.draft.media_key : null;
  return {
    week_no: m.week_no,
    weekly_target: m.weekly_target,
    deadline: m.deadline,
    vote_open: m.vote_open,
    ocr_consent: m.ocr_consent,
    tally: m.tally ?? null,
    week_completed: m.week_completed,
    title: m.title,
    vocab: m.vocab,
    articlePdf: url("article_pdf"),
    vocaPdf: url("voca_pdf"),
    vocaAudio: url("voca_repeat_audio"),
    draft: m.draft ? { activityId: m.draft.activity_id, photoUrl: activityMediaUrl(m.draft.activity_id, photoKey), note: m.draft.note } : null,
  };
}

export type QueueItem = {
  activity_id: string;
  week_no: number;
  activity_type: ActType;
  completed_at: string;
  kind: "video" | "photo";
  mediaUrl: string | null; // 사진 저장·영상 재료 (앱 주소 /media/활동, 누를 때 짧은 주소로)
  templateUrl: string | null; // 영상 화면 (2단계)
  // 청독: 인스타용 카드(제목 100px)를 휴대폰에서 다시 그릴 값
  card: { activity_id: string; week_no: number; title: string | null; cohort_no: number; name: string; date: string; plays: Record<string, number>; session_seconds: number; total_seconds: number } | null;
};
export type Queue = { deadline: string; total_target: number; verified_count: number; items: QueueItem[] };

/** 인스타 올리기 목록 */
export async function getQueue(studentId: string): Promise<Queue | null> {
  const { data, error } = await db().rpc("upload_queue", { p_student: studentId });
  if (error) throw error;
  if (!data) return null;
  const q = data as Omit<Queue, "items"> & { items: (Omit<QueueItem, "mediaUrl" | "templateUrl"> & { media_key: string; template_key: string | null })[] };
  const items = q.items.map(({ media_key, template_key, ...it }) => ({
    ...it,
    mediaUrl: activityMediaUrl(it.activity_id, media_key),
    templateUrl: courseFileUrl(it.week_no, "insta_template", template_key),
  }));
  return { deadline: q.deadline, total_target: q.total_target, verified_count: q.verified_count, items };
}
