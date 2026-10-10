// VOCA 카드 (2026-10-10 시안 "활동 카드 모음"): 이번 주 단어 + 작성지 사진(단어 낭독이면 사진 없이) + 익힌 단어 수 + "단어" 도장.
import { BOX_Y, MAX_W, SANS, SERIF, STAMP, W, X0, drawKicker, drawPhoto, drawPills, drawStatBox, drawSubLine, drawTitle, loadFonts, placeStamp, startCard, toPng, type CardHead } from "./frame";
import type { TitleStep } from "./layout";
import type { CardStyle } from "./listening";

export type VocaCardData = CardHead & {
  title: string | null;
  words: string[]; // 이번 주 단어
  method: "photo" | "reading"; // 작성지 사진 / 단어 낭독
  photo: (CanvasImageSource & { width: number; height: number }) | null;
  total_words: number; // 지금까지 익힌 단어(이번 주 포함)
};

const STEPS: Record<CardStyle, TitleStep[]> = {
  app: [
    [60, 2],
    [50, 3],
    [44, 99],
  ],
  insta: [
    [72, 2],
    [60, 3],
    [50, 99],
  ],
};
const MAX_CHIPS = 12;
const PHOTO = { w: 330, h: 400 };

export async function drawVocaCard(d: VocaCardData, style: CardStyle = "app"): Promise<Blob> {
  const title = d.title ?? `${d.week_no}주차 기사`;
  const shown = d.words.slice(0, MAX_CHIPS);
  const more = d.words.length - shown.length;
  const photo = d.method === "photo" ? d.photo : null;
  await loadFonts([
    [`900 ${STEPS[style][0][0]}px ${SERIF}`, `새벽달 영어뉴스단어${title}`],
    [`700 30px ${SANS}`, `${shown.join("")}이번 주 VOCA오늘 익힌 단어지금까지 누적새벽달 영어뉴스 기자${d.reporter}작성지로 익혔어요소리 내어 읽었어요개·월일기주차()+`],
    [`900 112px ${SANS}`, "0123456789개"],
  ]);

  const { canvas, ctx, y: y0 } = startCard(d);
  let y = drawKicker(ctx, "이번 주 VOCA", y0 + 10);
  const titleBottom = drawTitle(ctx, title, STEPS[style], y);
  y = drawSubLine(ctx, `새벽달 영어뉴스 기자 ${d.reporter} · ${d.method === "photo" ? "작성지로 익혔어요" : "소리 내어 읽었어요"}`, titleBottom);
  y += 34;

  const chipW = photo ? MAX_W - PHOTO.w - 40 : MAX_W;
  const chipsBottom = drawPills(ctx, [...shown.map((w) => ({ label: w })), ...(more > 0 ? [{ label: `+${more}` }] : [])], y, chipW);

  drawStatBox(ctx, { label: "오늘 익힌 단어", big: `${d.words.length}개`, footLabel: "지금까지 누적", footValue: `${d.total_words}개` });

  if (photo) {
    const px = X0 + MAX_W - PHOTO.w + 10;
    const py = Math.max(y, BOX_Y - PHOTO.h - 20);
    drawPhoto(ctx, photo, px, py, PHOTO.w, PHOTO.h, 5);
    // 도장은 작성지 사진 위쪽 모서리에 걸쳐서
    placeStamp(ctx, d, "voca", { top: py - 90, bottom: py - 10, left: px - 120, width: STAMP + 160, fallback: { x: px - 60, y: py - 60 } });
  } else {
    placeStamp(ctx, d, "voca", { top: chipsBottom - 20, bottom: BOX_Y + 40 - STAMP, fallback: { x: W - 64 - STAMP + 20, y: BOX_Y - 150 } });
  }
  return toPng(canvas);
}
