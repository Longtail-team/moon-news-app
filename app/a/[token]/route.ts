// 접속 링크 열기: 확인 → 세션 쿠키 → 링크 문자열이 없는 주소로 이동
import { NextResponse } from "next/server";
import { PROFILE_COOKIE, SESSION_COOKIE, SESSION_DAYS, cookieOptions, openLink } from "@/lib/server/session";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const raw = await openLink(token);
  const res = NextResponse.redirect(new URL(raw ? "/" : "/?link=invalid", req.url), 303);
  if (raw) {
    res.cookies.set(SESSION_COOKIE, raw, { ...cookieOptions, maxAge: SESSION_DAYS * 86400 });
    res.cookies.delete(PROFILE_COOKIE);
  }
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
