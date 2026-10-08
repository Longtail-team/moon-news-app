import "server-only";
import { db } from "./db";
import { courseFileUrl } from "./media";

export type MaterialFile = { type: string; label: string; sub?: string; url: string | null };
export type WeekItem = { kind: "link" | "text"; title: string; url: string | null; body: string | null };
export type LiveSession = { session_id: string; session_no: number; starts_at: string; has_zoom: boolean; has_replay: boolean };
export type Materials = {
  current_week: number | null;
  opened: { week_no: number; title: string | null }[];
  next_open: { week_no: number; starts_at: string } | null;
  selected: {
    week_no: number;
    title_en: string | null;
    level: string | null;
    word_count: number | null;
    pdfs: MaterialFile[];
    audios: MaterialFile[];
    items: WeekItem[];
  } | null;
  live: LiveSession[];
};

const PDFS: [type: string, label: string, sub?: string][] = [
  ["article_pdf", "기사 PDF", "원문 · 요약 작성지 · 토론 질문지"],
  ["voca_pdf", "VOCA 정리 PDF"],
];
const AUDIOS: [type: string, label: string][] = [
  ["article_audio", "영어 기사 음원"],
  ["kr_en_repeat_audio", "한영 구간반복"],
  ["voca_repeat_audio", "VOCA 구간반복"],
];

/** 이번 주 자료. PDF·음원은 앱 주소(/files/…), 파일이 없으면 url = null(준비 중) */
export async function getMaterials(studentId: string, week: number | null): Promise<Materials | null> {
  const { data, error } = await db().rpc("materials", { p_student: studentId, p_week: week });
  if (error) throw error;
  if (!data) return null;
  type Raw = Omit<Materials, "selected"> & {
    selected: (Omit<NonNullable<Materials["selected"]>, "pdfs" | "audios"> & { assets: { type: string; storage_key: string; file_name: string }[] }) | null;
  };
  const r = data as Raw;
  let selected: Materials["selected"] = null;
  if (r.selected) {
    const s = r.selected;
    const url = (t: string) => courseFileUrl(s.week_no, t, s.assets.find((a) => a.type === t)?.storage_key);
    const pdfs = await Promise.all(PDFS.map(async ([t, label, sub]) => ({ type: t, label, sub, url: await url(t) })));
    const audios = await Promise.all(AUDIOS.map(async ([t, label]) => ({ type: t, label, url: await url(t) })));
    selected = { week_no: s.week_no, title_en: s.title_en, level: s.level, word_count: s.word_count, pdfs, audios, items: s.items };
  }
  return { current_week: r.current_week, opened: r.opened, next_open: r.next_open, selected, live: r.live };
}
