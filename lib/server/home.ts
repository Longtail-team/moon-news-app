import "server-only";
import { cache } from "react";
import { db } from "./db";
import type { ActType } from "@/components/student/icons";

export type HomeWeek = { week_no: number; starts_at: string; ends_at: string; title: string | null; acts: ActType[] };
export type HomeData = {
  student: { student_id: string; name: string };
  cohort: {
    course_title: string;
    cohort_no: number;
    deadline: string;
    start_date: string;
    weekly_target: number;
    total_target: number;
    grace_until: string; // 유예 마감(종강 + 7일)
    grace_open: boolean; // 유예 기간 안
    retention_until: string; // 녹음·사진 보관 기한(종강 + 3개월)
  };
  progress: {
    current_week: number | null;
    this_week_completed: number;
    total_completed: number;
    verified_count: number;
    pending_post_count: number;
    reading_words: number;
    completion_tier: "on_time" | "grace" | "late" | null;
  };
  weeks: HomeWeek[];
  live: { session_id: string; session_no: number; starts_at: string; has_zoom: boolean } | null;
};

/** 학생 홈 데이터. 환불하지 않은 가장 최근 기수 기준. 수강이 없으면 null. */
export const getHome = cache(async (studentId: string): Promise<HomeData | null> => {
  const { data, error } = await db().rpc("student_home", { p_student: studentId });
  if (error) throw error;
  return (data as HomeData | null) ?? null;
});
