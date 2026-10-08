import "server-only";
import { db } from "./db";

export type OnboardingOrder = { order_id: string; course_title: string; cohort_no: number; start_date: string; deadline: string; registered: number };
export type Onboarding = {
  step: "welcome" | "learners" | "access" | "done";
  open_seats: number; // 최근 주문에 더 등록할 수 있는 학습자 수 (주문 1건당 최대 4명)
  guardian: { name: string | null; phone: string };
  orders: OnboardingOrder[];
  returning: { student_id: string; name: string; birth_ym: string | null; instagram_id: string | null }[];
  pending: { student_id: string; name: string; grade: string | null }[];
  liveCount: number;
};

export async function getOnboarding(guardianId: string): Promise<Onboarding> {
  const { data, error } = await db().rpc("onboarding_state", { p_guardian: guardianId });
  if (error) throw error;
  const o = data as Omit<Onboarding, "liveCount">;
  let liveCount = 0;
  if (o.orders[0]) {
    const { data: c } = await db().from("orders").select("cohort_id").eq("order_id", o.orders[0].order_id).single();
    const { count } = await db().from("live_sessions").select("session_id", { count: "exact", head: true }).eq("cohort_id", c?.cohort_id);
    liveCount = count ?? 0;
  }
  return { ...o, liveCount };
}
