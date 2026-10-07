// 형제 프로필 고르기: 세션 범위 안의 학습자만 고를 수 있다
import { NextResponse } from "next/server";
import { PROFILE_COOKIE, SESSION_DAYS, cookieOptions, getSession } from "@/lib/server/session";

export async function GET(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  const session = await getSession();
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  if (session?.learners.some((l) => l.student_id === sid)) {
    res.cookies.set(PROFILE_COOKIE, sid, { ...cookieOptions, maxAge: SESSION_DAYS * 86400 });
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}
