// 읽기 완료 카드 (2026-10-10 결정, T06 6장): 청독 카드와 같은 틀 + "낭독" 도장.
// 영어 낭독: 오늘 소리 내어 읽은 단어 / 지금까지 누적 단어. 한국어 낭독: 오늘 읽은 시간 / 지금까지 낭독 횟수.
// 인스타에는 이 카드에 녹음을 입힌 영상으로 올린다(영상 합성은 2단계 모듈 V01).
import { clock, fmtDuration } from "../reading/text";
import { BOX_Y, SANS, SERIF, STAMP, W, drawPills, drawStatBox, drawSubLine, drawTitle, loadFonts, placeStamp, startCard, toPng, type CardHead } from "./frame";
import { TITLE_STEPS, type CardStyle } from "./listening";

export type ReadingCardData = CardHead & {
  title: string | null;
  lang: "en" | "kr";
  record_seconds: number; // 녹음 길이
  words: number; // 이 기사 영어 단어 수(영어 낭독일 때)
  total_words: number; // 지금까지 소리 내어 읽은 영어 단어(이번 낭독 포함)
  total_reads: number; // 지금까지 한 낭독 횟수(한국어 카드에 씀, 이번 낭독 포함)
};

export async function drawReadingCard(d: ReadingCardData, style: CardStyle = "app"): Promise<Blob> {
  const title = d.title ?? `${d.week_no}주차 기사`;
  const en = d.lang === "en";
  await loadFonts([
    [`900 ${TITLE_STEPS[style][0][0]}px ${SERIF}`, `새벽달 영어뉴스낭독${title}`],
    [`900 112px ${SANS}`, "0123456789,분초개회"],
    [`700 30px ${SANS}`, `오늘 소리 내어 읽은 단어오늘 읽은 시간지금까지 누적낭독새벽달 영어뉴스 기자${d.reporter}영어 한국어 기사 읽기녹음:·월일기주차()`],
  ]);

  const { canvas, ctx, y: y0 } = startCard(d);
  const titleBottom = drawTitle(ctx, title, TITLE_STEPS[style], y0);
  let y = drawSubLine(ctx, `새벽달 영어뉴스 기자 ${d.reporter}`, titleBottom);
  y += 22 + 12;
  const pillsBottom = drawPills(ctx, [{ label: en ? "영어 기사 읽기" : "한국어 기사 읽기" }, { label: "녹음", value: clock(d.record_seconds) }], y);

  drawStatBox(
    ctx,
    en
      ? { label: "오늘 소리 내어 읽은 단어", big: `${d.words.toLocaleString()}개`, footLabel: "지금까지 누적", footValue: `${d.total_words.toLocaleString()}단어`, icon: "read-en" }
      : { label: "오늘 읽은 시간", big: fmtDuration(d.record_seconds), footLabel: "지금까지 낭독", footValue: `${d.total_reads}회`, icon: "read-kr" },
  );

  // 도장은 녹음 길이를 가리지 않게 알약 아래 ~ 숫자 칸 위
  placeStamp(ctx, d, "read", {
    top: pillsBottom - 20,
    bottom: BOX_Y + 40 - STAMP,
    fallback: { x: W - 64 - STAMP + 20, y: BOX_Y - 150 },
  });
  return toPng(canvas);
}
