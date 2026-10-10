// 기사 요약 카드 (2026-10-10 시안 "활동 카드 모음"): 기자수첩의 내가 붙인 제목 + 요약 앞부분 + 작성지 사진 + "요약" 도장.
// 요약을 안 썼으면 기사 제목과 작성지 사진만(사진을 크게).
import { C, H, MAX_W, SANS, SERIF, STAMP, X0, drawKicker, drawPhoto, drawSubLine, drawTitle, loadFonts, placeStamp, startCard, toPng, type CardHead } from "./frame";
import { clampLines, type TitleStep } from "./layout";
import type { CardStyle } from "./listening";

export type SummaryCardData = CardHead & {
  article_title: string | null;
  my_title: string | null; // 기자수첩 "내가 붙인 제목"
  summary: string | null; // 기자수첩 요약
  photo: (CanvasImageSource & { width: number; height: number }) | null; // 작성지 사진(불러온 이미지)
};

const STEPS: Record<CardStyle, TitleStep[]> = {
  app: [
    [64, 2],
    [54, 3],
    [46, 99],
  ],
  insta: [
    [84, 2],
    [68, 3],
    [58, 99],
  ],
};
const BOTTOM = H - 64 - 56; // 종이 안쪽 아래

export async function drawSummaryCard(d: SummaryCardData, style: CardStyle = "app"): Promise<Blob> {
  const article = d.article_title ?? `${d.week_no}주차 기사`;
  const title = d.my_title?.trim() || article;
  const text = d.summary?.trim() || "";
  await loadFonts([
    [`900 ${STEPS[style][0][0]}px ${SERIF}`, `새벽달 영어뉴스요약${title}`],
    [`400 31px ${SANS}`, text.slice(0, 200)],
    [`700 30px ${SANS}`, `기자수첩 내가 붙인 제목기사 요약원래 기사:새벽달 영어뉴스 기자${d.reporter}·월일기주차()`],
  ]);

  const { canvas, ctx, y: y0 } = startCard(d);
  let y = drawKicker(ctx, d.my_title?.trim() ? "기자수첩 · 내가 붙인 제목" : "기사 요약", y0 + 10);
  const titleBottom = drawTitle(ctx, title, STEPS[style], y);
  y = titleBottom;
  if (d.my_title?.trim()) y = drawSubLine(ctx, `원래 기사: ${article}`, y - 8, 26) - 10;
  y = drawSubLine(ctx, `새벽달 영어뉴스 기자 ${d.reporter}`, y);
  const top = y + 40;

  let stampTop = top;
  let stampLeft = X0 - 40;
  let stampW = MAX_W + 80;
  if (text) {
    // 왼쪽 요약 글, 오른쪽 사진
    const colW = d.photo ? 400 : MAX_W;
    ctx.font = `400 31px ${SANS}`;
    ctx.fillStyle = C.ink;
    const lh = 31 * 1.6;
    const maxLines = Math.max(1, Math.floor((BOTTOM - STAMP / 2 - top) / lh));
    const lines = clampLines((t) => ctx.measureText(t).width, text, colW, Math.min(maxLines, 9));
    lines.forEach((l, i) => ctx.fillText(l, X0, top + 31 + i * lh));
    stampTop = top + 31 + lines.length * lh - 40;
    if (d.photo) {
      drawPhoto(ctx, d.photo, X0 + MAX_W - 380, top, 380, Math.min(500, BOTTOM - top), 4);
      stampW = colW + 80;
    }
  } else if (d.photo) {
    // 요약이 없으면 사진을 가운데 크게
    const h = Math.min(640, BOTTOM - top);
    const w = Math.round(h * 0.78);
    drawPhoto(ctx, d.photo, X0 + (MAX_W - w) / 2, top, w, h, 3);
    stampTop = top + h - STAMP / 2;
    stampLeft = X0 - 40;
    stampW = (MAX_W - w) / 2 + 200;
  }

  placeStamp(ctx, d, "summary", {
    top: stampTop,
    bottom: BOTTOM - STAMP + 30,
    left: stampLeft,
    width: stampW,
    fallback: { x: X0 - 20, y: BOTTOM - STAMP + 20 },
  });
  return toPng(canvas);
}
