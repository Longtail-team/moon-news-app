// 뉴스북 PDF 받기: 종강 다음 날(한국 시간 0시)부터. 누를 때 만들고 서버에 남기지 않는다.
import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireLearner } from "@/lib/server/learner";
import { bookPages, getNewsbook } from "@/lib/server/newsbook";
import { renderNewsbook, type PdfPhoto } from "@/lib/pdf/newsbook";
import { givenName } from "@/lib/format";

export const maxDuration = 60;

// 손글씨 사진: 보관 기간 안에 남아 있고 PDF에 넣을 수 있는 형식(JPEG·PNG)일 때만
async function photo(activityId: string, studentId: string): Promise<PdfPhoto | null> {
  const { data: key } = await db().rpc("activity_media", { p_student: studentId, p_activity: activityId });
  if (typeof key !== "string") return null;
  const { data: file } = await db().storage.from("media").download(key);
  if (!file) return null;
  const format = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : null;
  return format ? { data: Buffer.from(await file.arrayBuffer()), format } : null;
}

export async function GET(req: Request) {
  const learner = await requireLearner();
  if (!learner) return new NextResponse(null, { status: 404 });
  const b = await getNewsbook(learner.student_id, new URL(req.url).searchParams.get("e"));
  if (!b) return new NextResponse(null, { status: 404 });
  if (!b.can_download) return new NextResponse("종강 다음 날부터 받을 수 있어요", { status: 403 });

  const pages = bookPages(b);
  const photos: Record<string, PdfPhoto> = {};
  // 손글씨 사진과 청독 카드 그림
  const ids = pages.flatMap((w) => [...(w.summary?.has_photo ? [w.summary.activity_id] : []), ...w.cards.map((c) => c.activity_id)]);
  await Promise.all(
    ids.map(async (id) => {
      const p = await photo(id, learner.student_id);
      if (p) photos[id] = p;
    }),
  );
  const pdf = await renderNewsbook(b, pages, photos);
  const name = `새벽달영어뉴스_${b.cohort.cohort_no}기_뉴스북_${givenName(b.student.name)}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="newsbook.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
