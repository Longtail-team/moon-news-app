// 청독 카드 (2026-10-09 확정 시안 C: 기사 스크랩 + 도장). 기존 lib/listening-card.ts를 공통 틀로 옮김(그림은 그대로).
// - 들은 음원만 표시, 오늘 들은 시간·누적 시간을 크게
// - 두 가지 스타일: "app" = 앱 화면·뉴스북(제목 2줄 68px, 3줄 58px), "insta" = 인스타 저장(제목 100px, 넘치면 84→68→58px)
//   앱·뉴스북용만 서버에 보관하고, 인스타용은 저장할 때 같은 값으로 다시 그린다
// - 도장: 음원 표시와 시간 칸 사이 빈 곳의 아무 자리 + 각도 -25°~+25° (빈 곳이 좁으면 시간 칸 오른쪽 위 모서리)
import { fmtListen, type AudioType } from "../listening";
import { BOX_Y, SANS, SERIF, STAMP, W, drawPills, drawStatBox, drawSubLine, drawTitle, loadFonts, placeStamp, startCard, toPng, type CardHead } from "./frame";
import type { TitleStep } from "./layout";

export type CardStyle = "app" | "insta";

export type ListeningCardData = CardHead & {
  title: string | null;
  name: string; // 학습자 이름 (기자 이름은 부르는 이름)
  plays: Partial<Record<AudioType, number>>;
  session_seconds: number;
  total_seconds: number;
};

const LABEL: Record<AudioType, string> = { article_audio: "영어 기사", kr_en_repeat_audio: "한영 구간반복", voca_repeat_audio: "VOCA 구간반복" };
const ORDER: AudioType[] = ["article_audio", "kr_en_repeat_audio", "voca_repeat_audio"];

/** 기사 제목 크기 단계(청독·읽기 완료·VOCA 카드가 같이 씀) */
export const TITLE_STEPS: Record<CardStyle, TitleStep[]> = {
  app: [
    [68, 2],
    [58, 3],
    [50, 99],
  ],
  insta: [
    [100, 3],
    [84, 3],
    [68, 4],
    [58, 99],
  ],
};

/** 서체를 불러온 뒤 카드를 PNG로 그린다 */
export async function drawListeningCard(d: ListeningCardData, style: CardStyle = "app"): Promise<Blob> {
  const title = d.title ?? `${d.week_no}주차 기사`;
  await loadFonts([
    [`900 ${TITLE_STEPS[style][0][0]}px ${SERIF}`, `새벽달 영어뉴스청독${title}`],
    [`900 112px ${SANS}`, "0123456789분초시간"],
    [`700 30px ${SANS}`, `오늘 들은 시간지금까지 누적새벽달 영어뉴스 기자${d.reporter}영어 기사한영 구간반복VOCA 회·월일기주차()`],
  ]);

  const { canvas, ctx, y: y0 } = startCard(d);
  const titleBottom = drawTitle(ctx, title, TITLE_STEPS[style], y0);
  let y = drawSubLine(ctx, `새벽달 영어뉴스 기자 ${d.reporter}`, titleBottom);
  y += 22 + 12;

  // 들은 음원만
  drawPills(
    ctx,
    ORDER.filter((t) => (d.plays[t] ?? 0) > 0).map((t) => ({ label: LABEL[t], value: `${d.plays[t]}회` })),
    y,
  );

  drawStatBox(ctx, { label: "오늘 들은 시간", big: fmtListen(d.session_seconds), footLabel: "지금까지 누적", footValue: fmtListen(d.total_seconds) });

  // 도장: 제목 아래 ~ 시간 칸 위(기자 이름·음원 표시와는 겹쳐도 됨, 제목·시간 숫자는 가리지 않게), 좁으면 시간 칸 오른쪽 위 모서리
  placeStamp(ctx, d, "listen", {
    top: titleBottom - 10,
    bottom: BOX_Y + 40 - STAMP,
    fallback: { x: W - 64 - STAMP + 20, y: BOX_Y - 150 },
  });

  return toPng(canvas);
}
