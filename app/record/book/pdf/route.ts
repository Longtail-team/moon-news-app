// 뉴스북 PDF 받기: 종강 다음 날(한국 시간 0시)부터. 누르면 저장소에 준비된 PDF(없으면 만들어 둠)의 1분짜리 주소로 보낸다.
// PDF를 서버 응답으로 바로 보내지 않는 이유: 응답 크기 제한(Vercel 약 4.5MB). lib/server/newsbook-pdf 참고
import { NextResponse } from "next/server";
import { requireLearner } from "@/lib/server/learner";
import { getNewsbook } from "@/lib/server/newsbook";
import { newsbookPdfUrl } from "@/lib/server/newsbook-pdf";

export const maxDuration = 60;

export async function GET(req: Request) {
  const learner = await requireLearner();
  if (!learner) return new NextResponse(null, { status: 404 });
  const b = await getNewsbook(learner.student_id, new URL(req.url).searchParams.get("e"));
  if (!b) return new NextResponse(null, { status: 404 });
  if (!b.can_download) return new NextResponse("종강 다음 날부터 받을 수 있어요", { status: 403 });

  const url = await newsbookPdfUrl(b, learner.student_id);
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
