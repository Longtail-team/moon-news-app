// 토론 카드 (2026-10-10 결정, T06 6장): 인스타에 올리는 찬반토론 인증 카드.
// 질문 + "N명이 함께 토론했어요" + 찬성/반대/잘 모르겠어요 비율(날짜 기준, 익명 집계) + 오늘 토론 주제 반응 + "토론" 도장.
// 아이의 입장·이유는 넣지 않는다(앱·뉴스북에만 저장).
import { C, H, MAX_W, SANS, SERIF, STAMP, W, X0, dateLabel, drawKicker, drawPills, drawSubLine, drawTitle, loadFonts, placeStamp, rr, startCard, toPng, type CardHead } from "./frame";
import { percents, type TitleStep } from "./layout";
import type { CardStyle } from "./listening";

export type DebateCounts = { agree: number; disagree: number; unsure: number };
export type DebateCardData = CardHead & {
  question: string;
  counts: DebateCounts; // 이 카드를 만든 시점의 투표 수
  feel: string; // 토론 주제 반응(예: "더 이야기하고 싶어요")
};

const STEPS: Record<CardStyle, TitleStep[]> = {
  app: [
    [60, 3],
    [50, 4],
    [44, 99],
  ],
  insta: [
    [72, 3],
    [60, 4],
    [50, 99],
  ],
};
const ROWS: [keyof DebateCounts, string][] = [
  ["agree", "찬성"],
  ["disagree", "반대"],
  ["unsure", "잘 모르겠어요"],
];
const BOX_H = 340;
const BOX_Y = H - 64 - 56 - BOX_H;

export async function drawDebateCard(d: DebateCardData, style: CardStyle = "app"): Promise<Blob> {
  await loadFonts([
    [`900 ${STEPS[style][0][0]}px ${SERIF}`, `새벽달 영어뉴스토론${d.question}`],
    [`900 40px ${SANS}`, "0123456789명이 함께 토론했어요%"],
    [`700 30px ${SANS}`, `이번 주 토론오늘 토론 주제:${d.feel}찬성반대잘 모르겠어요새벽달 영어뉴스 기자${d.reporter}기준·월일기주차()`],
  ]);

  const { canvas, ctx, y: y0 } = startCard(d);
  const y = drawKicker(ctx, "이번 주 토론", y0 + 10);
  const titleBottom = drawTitle(ctx, d.question, STEPS[style], y);
  const reporterY = drawSubLine(ctx, `새벽달 영어뉴스 기자 ${d.reporter}`, titleBottom);

  // 반응 알약은 숫자 칸 바로 위
  const pillY = BOX_Y - 66 - 28;
  drawPills(ctx, [{ label: `오늘 토론 주제: ${d.feel}` }], pillY);

  // 숫자 칸: 함께 토론한 사람 수 + 세 줄 막대
  const total = d.counts.agree + d.counts.disagree + d.counts.unsure;
  const pct = percents(d.counts);
  const top = Math.max(pct.agree, pct.disagree, pct.unsure);
  rr(ctx, X0, BOX_Y, MAX_W, BOX_H, 24);
  ctx.fillStyle = C.tint;
  ctx.fill();
  const bx = X0 + 44;
  const bw = MAX_W - 88;
  ctx.fillStyle = C.ink;
  ctx.font = `900 40px ${SANS}`;
  ctx.fillText(`${total}명이 함께 토론했어요`, bx, BOX_Y + 78);
  ctx.fillStyle = C.deep;
  ctx.font = `700 24px ${SANS}`;
  ctx.textAlign = "right";
  ctx.fillText(`${dateLabel(d.date).replace(/\(.\)$/, "")} 기준`, bx + bw, BOX_Y + 76);
  ROWS.forEach(([k, label], i) => {
    const ry = BOX_Y + 130 + i * 66;
    ctx.textAlign = "left";
    ctx.fillStyle = C.ink;
    ctx.font = `700 30px ${SANS}`;
    ctx.fillText(label, bx, ry + 26);
    const tx = bx + 250;
    const tw = bw - 250 - 120;
    rr(ctx, tx, ry + 4, tw, 22, 11);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    if (pct[k] > 0) {
      rr(ctx, tx, ry + 4, Math.max(22, (tw * pct[k]) / 100), 22, 11);
      ctx.fillStyle = pct[k] === top ? C.deep : C.main;
      ctx.fill();
    }
    ctx.textAlign = "right";
    ctx.fillStyle = C.ink;
    ctx.font = `900 32px ${SANS}`;
    ctx.fillText(`${pct[k]}%`, bx + bw, ry + 28);
  });
  ctx.textAlign = "left";

  // 도장: 기자 이름 아래 ~ 반응 알약 위 빈 곳
  placeStamp(ctx, d, "debate", {
    top: reporterY - 20,
    bottom: pillY + 30 - STAMP,
    fallback: { x: W - 64 - STAMP + 10, y: pillY - STAMP + 60 },
  });
  return toPng(canvas);
}
