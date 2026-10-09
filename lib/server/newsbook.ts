// 내 기록·뉴스북 데이터 (학습자별, 기수별). 진도 중간에는 화면 열람, 종강 다음 날부터 PDF 다운로드
import "server-only";
import { db } from "./db";

export type BookWeek = {
  week_no: number;
  starts_at: string;
  title_en: string | null;
  title_ko: string | null;
  summary: { activity_id: string; title: string | null; body: string | null; has_photo: boolean } | null;
  opinion: { stance: "agree" | "disagree"; reason: string | null } | null;
  tally: { agree: number; disagree: number; final: boolean } | null; // 의견을 골랐을 때만
};

export type Newsbook = {
  enrollment_id: string;
  is_current: boolean;
  student: { name: string; ai_consent: boolean };
  cohort: { course_title: string; cohort_no: number; start_date: string; deadline: string; weeks_total: number };
  download_from: string;
  can_download: boolean;
  pending_post_count: number; // 하단 탭의 올릴 것 수
  stats: { readings: number; articles: number; summaries: number; opinions: number; weeks_met: number };
  weeks: BookWeek[];
  others: { enrollment_id: string; course_title: string; cohort_no: number; deadline: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** enrollment가 없으면 지금 기수. 남의 수강·환불한 수강이면 null */
export async function getNewsbook(studentId: string, enrollment?: string | null): Promise<Newsbook | null> {
  const e = enrollment && UUID.test(enrollment) ? enrollment : null;
  if (enrollment && !e) return null;
  const { data, error } = await db().rpc("newsbook", { p_student: studentId, p_enrollment: e });
  if (error) throw error;
  return (data as Newsbook | null) ?? null;
}

/** 뉴스북에 실리는 기사 쪽: 기자수첩이나 의견이 있는 주차 */
export const bookPages = (b: Newsbook) => b.weeks.filter((w) => w.summary || w.opinion);
