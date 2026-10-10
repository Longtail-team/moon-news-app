// PDF에 넣는 그림 줄이기(2026-10-10, T07 4-1 저사양 기준). 작성지 사진(긴 변 2048px)·청독 카드(1080×1350 PNG)를
// 원본 그대로 넣으면 12주 뉴스북이 수십 MB가 된다. PDF에 보이는 크기의 3배(인쇄해도 선명) JPEG로 줄인다.
import "server-only";
import sharp from "sharp";
import type { PdfPhoto } from "./newsbook";

// PDF에 보이는 크기(pt) × 3
const BOX = {
  photo: { width: 90 * 3, height: 120 * 3, fit: "cover" as const }, // 뉴스 카드 손글씨 사진 90×120pt
  card: { width: 120 * 3, height: 150 * 3, fit: "inside" as const }, // 활동 카드 4열(약 120×149pt, 4:5)
};

/** 그림을 PDF용 JPEG로 줄인다. 실패하면 원본(그래도 PDF는 만들어지게) */
export async function pdfImage(p: PdfPhoto, kind: keyof typeof BOX): Promise<PdfPhoto> {
  try {
    const b = BOX[kind];
    const data = await sharp(p.data)
      .rotate() // 휴대폰 사진 방향 정보 반영
      .resize({ width: b.width, height: b.height, fit: b.fit, withoutEnlargement: true })
      .flatten({ background: "#FFFFFF" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return { data, format: "jpg" };
  } catch {
    return p;
  }
}
