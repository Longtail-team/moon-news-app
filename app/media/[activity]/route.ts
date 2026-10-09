// 녹음·사진 열기: 화면에는 이 앱 주소만 싣고, 누를 때마다 주인(지금 학습자의 지금 수강 기록)을 확인한 뒤 짧은 저장소 주소로 보낸다.
// 아이 녹음·사진 주소가 화면 코드(개발자 도구)에 미리 남지 않는다.
import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireLearner } from "@/lib/server/learner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ activity: string }> }) {
  const { activity } = await ctx.params;
  const learner = await requireLearner();
  if (!learner || !UUID.test(activity)) return new NextResponse(null, { status: 404 });
  const { data: key } = await db().rpc("activity_media", { p_student: learner.student_id, p_activity: activity });
  if (typeof key !== "string") return new NextResponse(null, { status: 404 });
  const { data: s, error } = await db().storage.from("media").createSignedUrl(key, 60);
  if (error || !s) return new NextResponse(null, { status: 404 });
  const res = NextResponse.redirect(s.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
