// 찬반토론 판(T07 PR E): 질문, 마감, 다른 친구들의 비율(나 빼고), 내 의견, 친구 의견(이름 없이)
import "server-only";
import { db } from "./db";
import type { DebateBoard } from "@/lib/debate/board";

export async function getDebateBoard(studentId: string, week: number): Promise<DebateBoard | null> {
  const { data, error } = await db().rpc("debate_board", { p_student: studentId, p_week: week });
  if (error) throw error;
  return (data as DebateBoard | null) ?? null;
}
