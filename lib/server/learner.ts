import "server-only";
import { redirect } from "next/navigation";
import { currentLearner, getSession, type Learner, type Session } from "./session";

/** API에서 쓰는 지금 학습자. 세션이 없거나 프로필을 고르지 않았으면 null */
export async function requireLearner(): Promise<Learner | null> {
  const session = await getSession();
  if (!session) return null;
  return currentLearner(session);
}

/** 학습자 화면에서 쓰는 지금 학습자. 세션이 없으면 홈(안내), 프로필을 고르지 않았으면 프로필 고르기로 보낸다 */
export async function pageLearner(): Promise<{ session: Session; learner: Learner }> {
  const session = await getSession();
  if (!session) redirect("/");
  const learner = await currentLearner(session);
  if (!learner) redirect("/profiles");
  return { session, learner };
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
