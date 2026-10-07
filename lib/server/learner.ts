import "server-only";
import { currentLearner, getSession, type Learner } from "./session";

/** API에서 쓰는 지금 학습자. 세션이 없거나 프로필을 고르지 않았으면 null */
export async function requireLearner(): Promise<Learner | null> {
  const session = await getSession();
  if (!session) return null;
  return currentLearner(session);
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
