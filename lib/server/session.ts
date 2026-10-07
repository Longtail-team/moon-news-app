// 접속 링크(열쇠)와 세션(출입증). docs/tasks/T03-접속-링크와-세션.md
// 링크·세션 원문은 저장하거나 로그에 남기지 않는다. DB에는 해시만 둔다.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export const SESSION_COOKIE = "nd_s";
export const PROFILE_COOKIE = "nd_p";
export const SESSION_DAYS = 180; // T03 결정 4 (임시 적용)

export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export type Learner = { student_id: string; name: string; grade: string | null };
export type Session = { sessionId: string; holder: "guardian" | "child"; learners: Learner[] };

/** 접속 링크를 확인하고 새 세션 값을 돌려준다. 쓸 수 없는 링크면 null. */
export async function openLink(rawToken: string): Promise<string | null> {
  if (!rawToken || rawToken.length > 200) return null;
  const { data: tok, error } = await db()
    .from("access_tokens")
    .select("token_id, revoked_at, expires_at")
    .eq("token_hash", sha256(rawToken))
    .maybeSingle();
  if (error) throw error;
  if (!tok || tok.revoked_at || (tok.expires_at && Date.parse(tok.expires_at) <= Date.now())) return null;

  const raw = randomBytes(32).toString("base64url");
  const now = new Date();
  const { error: e1 } = await db()
    .from("sessions")
    .insert({ session_hash: sha256(raw), token_id: tok.token_id, expires_at: new Date(now.getTime() + SESSION_DAYS * 864e5).toISOString() });
  if (e1) throw e1;
  await db().from("access_tokens").update({ last_used_at: now.toISOString() }).eq("token_id", tok.token_id);
  return raw;
}

/** 지금 요청의 세션. 없거나 막힌 세션이면 null. 한 요청 안에서는 한 번만 조회한다. */
export const getSession = cache(async (): Promise<Session | null> => {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const { data, error } = await db().rpc("session_scope", { p_session_hash: sha256(raw) });
  if (error) throw error;
  const rows = (data ?? []) as { session_id: string; holder: "guardian" | "child"; student_id: string; student_name: string; grade: string | null }[];
  if (rows.length === 0) return null;
  return {
    sessionId: rows[0].session_id,
    holder: rows[0].holder,
    learners: rows.map((r) => ({ student_id: r.student_id, name: r.student_name, grade: r.grade })),
  };
});

/** 지금 고른 학습자. 한 명이면 그 학습자, 여럿이면 고른 프로필(없으면 null → 프로필 고르기). */
export async function currentLearner(session: Session): Promise<Learner | null> {
  if (session.learners.length === 1) return session.learners[0];
  const picked = (await cookies()).get(PROFILE_COOKIE)?.value;
  return session.learners.find((l) => l.student_id === picked) ?? null;
}

export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};
