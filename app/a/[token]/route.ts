// 접속 링크 열기: 확인 → 세션 쿠키 → 홈
// 주소에 링크(?k=)를 남겨 둔다: 홈 화면에 추가하면 아이콘이 링크를 품고, 열 때마다 다시 들어온다(spec 11장 2026-10-08).
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS, cookieOptions, openLink } from "@/lib/server/session";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const raw = await openLink(token);
  // again=1: 홈 화면 아이콘에서 세션 없이 다시 온 경우. 쿠키가 막힌 브라우저에서 무한 반복되지 않게 표시를 붙인다.
  const again = new URL(req.url).searchParams.get("again") === "1";
  const to = raw ? `/?k=${encodeURIComponent(token)}${again ? "&ok=1" : ""}` : "/?link=invalid";
  const res = NextResponse.redirect(new URL(to, req.url), 303);
  if (raw) {
    // 고른 프로필(형제)은 지우지 않는다: 홈 화면 아이콘으로 다시 들어와도 마지막 학습자로 바로 열린다.
    // 이 링크로 볼 수 없는 학습자라면 currentLearner가 무시한다.
    res.cookies.set(SESSION_COOKIE, raw, { ...cookieOptions, maxAge: SESSION_DAYS * 86400 });
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}
