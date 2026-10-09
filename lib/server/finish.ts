// 완주 화면·상장 (spec 5·9장). 학습자별, 기수별
import "server-only";
import { db } from "./db";
import type { ActType } from "@/components/student/icons";

export type Reading = { activity_id: string; week_no: number; completed_at: string; post_url: string | null; has_audio: boolean };

export type Finish = {
  enrollment_id: string;
  is_current: boolean;
  student: { name: string };
  cohort: { course_title: string; cohort_no: number; start_date: string; deadline: string; grace_until: string; total_target: number };
  verified: number;
  completed_at: string | null; // total_target번째 인증 시각 = 완주일
  tier: "on_time" | "grace" | "late" | null; // 완주 전이면 null
  acts: Partial<Record<ActType, number>>;
  reading_words: number;
  listening_seconds: number; // 누적 청독 시간
  first_reading: Reading | null; // 제때·유예 완주만
  last_reading: Reading | null;
  certificate_name: string | null;
  certificate_sent_at: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getFinish(studentId: string, enrollment?: string | null): Promise<Finish | null> {
  if (enrollment && !UUID.test(enrollment)) return null;
  const { data, error } = await db().rpc("finish_data", { p_student: studentId, p_enrollment: enrollment || null });
  if (error) throw error;
  return (data as Finish | null) ?? null;
}
