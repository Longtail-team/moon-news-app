import "server-only";
import { getSession } from "./session";

/** 보호자 세션만 통과 (첫 접속 단계 API용) */
export async function requireGuardian(): Promise<string | null> {
  const s = await getSession();
  return s && s.holder === "guardian" ? s.guardianId : null;
}
