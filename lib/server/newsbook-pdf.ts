// 뉴스북 PDF 만들기·보관(2026-10-10, T07 4-1 저사양 기준).
// - PDF에 넣는 그림은 보이는 크기로 줄인다(lib/pdf/images)
// - 서버가 PDF를 바로 돌려주면 응답 크기 제한(Vercel 약 4.5MB)에 걸릴 수 있어, 만든 PDF는 비공개 저장소에 두고 짧은 주소로 내려받게 한다
// - 내용이 같으면 다시 만들지 않는다(내용 해시가 파일 이름). 내용이 바뀌면 새로 만들고 예전 파일은 지운다
// 보관: media 버킷 books/<수강id>/<해시>.pdf — 종강 후 3개월 삭제 대상(사진·녹음과 같이)
import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { bookPages, type Newsbook } from "./newsbook";
import { renderNewsbook, type PdfPhoto } from "@/lib/pdf/newsbook";
import { pdfImage } from "@/lib/pdf/images";

const BUCKET = "media";
const VERSION = "2"; // PDF 모양을 바꾸면 올려서 예전 파일을 다시 만들게

// 손글씨 사진·카드 그림: 보관 기간 안에 남아 있고 PDF에 넣을 수 있는 형식(JPEG·PNG)일 때만, 보이는 크기로 줄여서
async function image(activityId: string, studentId: string, kind: "photo" | "card"): Promise<PdfPhoto | null> {
  const { data: key } = await db().rpc("activity_media", { p_student: studentId, p_activity: activityId });
  if (typeof key !== "string") return null;
  const { data: file } = await db().storage.from(BUCKET).download(key);
  if (!file) return null;
  const format = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : null;
  return format ? pdfImage({ data: Buffer.from(await file.arrayBuffer()), format }, kind) : null;
}

// 내려받는 파일 이름은 영문: 저장소가 한글 이름을 두 번 인코딩해 휴대폰에 "%EC%83…"처럼 저장되는 문제가 있어서(아이 이름도 파일 이름에 남지 않음)
export const bookFileName = (b: Newsbook) => `saebyeokdal-news-${b.cohort.cohort_no}-newsbook.pdf`;

/** PDF 내용이 바뀌었는지 가리는 해시(그림은 활동 id로 대신, 사진이 지워지면 has_photo가 바뀜) */
export function bookHash(b: Newsbook): string {
  const pages = bookPages(b);
  const body = JSON.stringify({ v: VERSION, s: b.student.name, c: b.cohort, st: b.stats, p: pages });
  return createHash("sha256").update(body).digest("hex").slice(0, 24);
}

/** 이 뉴스북 PDF를 저장소에 준비하고(없으면 만들어 올림) 1분짜리 내려받기 주소를 돌려준다 */
export async function newsbookPdfUrl(b: Newsbook, studentId: string): Promise<string> {
  const folder = `books/${b.enrollment_id}`;
  const name = `${bookHash(b)}.pdf`;
  const path = `${folder}/${name}`;
  const store = db().storage.from(BUCKET);

  const { data: list } = await store.list(folder);
  if (!list?.some((f) => f.name === name)) {
    const pages = bookPages(b);
    const photos: Record<string, PdfPhoto> = {};
    const jobs = pages.flatMap((w) => [
      ...(w.summary?.has_photo ? [[w.summary.activity_id, "photo"] as const] : []),
      ...w.cards.map((c) => [c.activity_id, "card"] as const),
    ]);
    // 한꺼번에 너무 많이 열지 않게 6개씩
    for (let i = 0; i < jobs.length; i += 6) {
      await Promise.all(
        jobs.slice(i, i + 6).map(async ([id, kind]) => {
          const p = await image(id, studentId, kind);
          if (p) photos[id] = p;
        }),
      );
    }
    const pdf = await renderNewsbook(b, pages, photos);
    const { error } = await store.upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (error) throw error;
    // 예전 내용의 PDF는 지운다
    const old = (list ?? []).filter((f) => f.name !== name).map((f) => `${folder}/${f.name}`);
    if (old.length) await store.remove(old);
  }

  const { data: s, error } = await store.createSignedUrl(path, 60, { download: bookFileName(b) });
  if (error || !s) throw error ?? new Error("signed url");
  return s.signedUrl;
}
