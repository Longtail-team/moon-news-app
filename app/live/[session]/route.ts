// 라이브 입장·다시보기: 누름을 기록하고(입장만) 줌·다시보기 주소로 보낸다. 줌 주소는 화면에 싣지 않는다(spec 12·13장).
import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireLearner } from "@/lib/server/learner";

export async function GET(req: Request, ctx: { params: Promise<{ session: string }> }) {
  const { session } = await ctx.params;
  const replay = new URL(req.url).searchParams.get("replay") === "1";
  const learner = await requireLearner();
  if (!learner) return NextResponse.redirect(new URL("/", req.url), 303);
  const { data } = await db().rpc("live_click", { p_student: learner.student_id, p_session: session, p_replay: replay });
  const url = typeof data === "string" && /^https:\/\//.test(data) ? data : null;
  return NextResponse.redirect(url ?? new URL("/materials", req.url), 303);
}
