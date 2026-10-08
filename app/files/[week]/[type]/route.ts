// 학습 자료 파일 열기: 화면에는 이 앱 주소만 싣고, 누를 때마다 수강·주차 공개를 확인한 뒤 짧은 저장소 주소로 보낸다.
// 저장소 주소가 화면 코드(개발자 도구)에 남지 않고, 남더라도 금방 만료된다.
import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireLearner } from "@/lib/server/learner";

const TYPES = ["article_pdf", "voca_pdf", "article_audio", "kr_en_repeat_audio", "voca_repeat_audio", "insta_template"];

export async function GET(req: Request, ctx: { params: Promise<{ week: string; type: string }> }) {
  const { week, type } = await ctx.params;
  const learner = await requireLearner();
  if (!learner || !TYPES.includes(type) || !/^\d{1,2}$/.test(week)) return new NextResponse(null, { status: 404 });
  const { data } = await db().rpc("course_asset", { p_student: learner.student_id, p_week: Number(week), p_type: type });
  const a = data as { storage_key: string; file_name: string } | null;
  if (!a) return new NextResponse(null, { status: 404 });

  const pdf = type.endsWith("_pdf");
  const audio = type.endsWith("_audio");
  // PDF는 바로 내려받으므로 1분, 음원은 재생 중 구간 이동(범위 요청)이 이어지므로 2시간, 템플릿 이미지는 1분
  const { data: s, error } = await db()
    .storage.from("course")
    .createSignedUrl(a.storage_key, audio ? 2 * 3600 : 60, pdf ? { download: a.file_name } : undefined);
  if (error || !s) return new NextResponse(null, { status: 404 });
  const res = NextResponse.redirect(s.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
