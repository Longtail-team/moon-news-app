// 청독 카드 그리기 (2026-10-09 확정 시안 C: 기사 스크랩 + 도장). 휴대폰에서 1080×1350(인스타 4:5) PNG로 그린다.
// - 들은 음원만 표시, 오늘 들은 시간·누적 시간을 크게
// - 두 가지 스타일(2026-10-09): "app" = 앱 화면·뉴스북(제목 2줄 68px, 3줄 58px), "insta" = 인스타 저장(제목 100px, 넘치면 84→68→58px)
//   앱·뉴스북용만 서버에 보관하고, 인스타용은 저장할 때 같은 값으로 다시 그린다
// - 도장: 음원 표시와 시간 칸 사이 빈 곳의 아무 자리 + 각도 -25°~+25° (빈 곳이 좁으면 시간 칸 오른쪽 위 모서리), 기록 id로 정해서 다시 그려도 같은 모양
import { fmtListen, type AudioType } from "./listening";

export type CardData = {
  activity_id: string;
  week_no: number;
  title: string | null;
  cohort_no: number;
  name: string; // 학습자 이름 (기자 이름은 부르는 이름)
  reporter: string;
  date: string; // "2026-10-09"
  plays: Partial<Record<AudioType, number>>;
  session_seconds: number;
  total_seconds: number;
};

const W = 1080;
const H = 1350;
const C = { bg: "#F6F8F8", line: "#E3E9E8", main: "#76D4CC", tint: "#E2F6F3", deep: "#1F7F77", ink: "#2D2D2D", sub: "#5A5A5A" };
const SANS = "Pretendard, 'Noto Sans KR', sans-serif";
const SERIF = "'Noto Serif KR', serif";
const LABEL: Record<AudioType, string> = { article_audio: "영어 기사", kr_en_repeat_audio: "한영 구간반복", voca_repeat_audio: "VOCA 구간반복" };
const ORDER: AudioType[] = ["article_audio", "kr_en_repeat_audio", "voca_repeat_audio"];
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const STAMP = 300; // 도장 크기(px)

// 같은 id면 같은 값 (FNV-1a → mulberry32)
function rng(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function dateLabel(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return `${m}월 ${day}일(${DOW[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]})`;
}

function drawStamp(rand: () => number, date: string): HTMLCanvasElement {
  const S = 300;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.translate(S / 2, S / 2);
  g.strokeStyle = C.deep;
  g.fillStyle = C.deep;
  // 손으로 찍은 듯 살짝 울퉁불퉁한 원
  const ring = (r: number, w: number) => {
    g.lineWidth = w;
    g.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const rr2 = r + (rand() - 0.5) * 1.6;
      const x = Math.cos(a) * rr2;
      const y = Math.sin(a) * rr2;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.stroke();
  };
  ring(138, 8);
  ring(126, 2.5);
  ring(80, 2.5);
  // 둘레 글자
  const ringText = "SAEBYEOKDAL ENGLISH NEWS ★ LISTENED ★ ";
  g.font = `900 21px ${SANS}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const step = (Math.PI * 2) / ringText.length;
  for (let i = 0; i < ringText.length; i++) {
    g.save();
    g.rotate(-Math.PI / 2 + i * step);
    g.translate(0, -104);
    g.fillText(ringText[i], 0, 0);
    g.restore();
  }
  g.font = `900 52px ${SERIF}`;
  g.fillText("청독", 0, -6);
  g.font = `700 22px ${SANS}`;
  g.fillText(date.replaceAll("-", "."), 0, 34);
  // 잉크가 군데군데 빠진 자국
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 420; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 145;
    g.globalAlpha = 0.35 + rand() * 0.65;
    g.beginPath();
    g.arc(Math.cos(a) * r, Math.sin(a) * r, 0.6 + rand() * 2.4, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export type CardStyle = "app" | "insta";

// 제목 크기 단계: [크기, 그 크기에서 허용하는 최대 줄 수]
const TITLE_STEPS: Record<CardStyle, [number, number][]> = {
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
export async function drawListeningCard(d: CardData, style: CardStyle = "app"): Promise<Blob> {
  const title = d.title ?? `${d.week_no}주차 기사`;
  try {
    await Promise.all([
      document.fonts.load(`900 ${TITLE_STEPS[style][0][0]}px ${SERIF}`, `새벽달 영어뉴스청독${title}`),
      document.fonts.load(`900 112px ${SANS}`, "0123456789분초시간"),
      document.fonts.load(`700 30px ${SANS}`, `오늘 들은 시간지금까지 누적새벽달 영어뉴스 기자${d.reporter}영어 기사한영 구간반복VOCA 회·월일기주차()`),
    ]);
  } catch {}

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  // 종이
  rr(ctx, 64, 64, W - 128, H - 128, 28);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.line;
  ctx.stroke();

  const x0 = 132;
  const maxW = W - 264;
  let y = 124;
  ctx.textBaseline = "alphabetic";
  // 머리
  ctx.fillStyle = C.ink;
  ctx.font = `900 42px ${SERIF}`;
  ctx.textAlign = "left";
  ctx.fillText("새벽달 영어뉴스", x0, y + 44);
  ctx.font = `400 27px ${SANS}`;
  ctx.fillStyle = C.sub;
  ctx.textAlign = "right";
  ctx.fillText(`${d.cohort_no}기 · ${d.week_no}주차 · ${dateLabel(d.date)}`, x0 + maxW, y + 40);
  y += 66;
  ctx.fillStyle = C.ink;
  ctx.fillRect(x0, y, maxW, 4);
  y += 4 + 22;

  // 제목: 스타일별 크기 단계(앱 68→58→50, 인스타 100→84→68→58)
  ctx.textAlign = "left";
  let size = TITLE_STEPS[style][0][0];
  let lines: string[] = [];
  for (const [s, max] of TITLE_STEPS[style]) {
    size = s;
    ctx.font = `900 ${s}px ${SERIF}`;
    lines = wrap(ctx, title, maxW);
    if (lines.length <= max) break;
  }
  ctx.fillStyle = C.ink;
  for (const l of lines) {
    y += size * 1.2;
    ctx.fillText(l, x0, y - size * 0.22);
  }
  const titleBottom = y;
  y += 22;
  ctx.font = `400 30px ${SANS}`;
  ctx.fillStyle = C.sub;
  y += 34;
  ctx.fillText(`새벽달 영어뉴스 기자 ${d.reporter}`, x0, y);
  y += 22 + 12;

  // 들은 음원만
  let cx = x0;
  let rowY = y;
  for (const t of ORDER) {
    const n = d.plays[t] ?? 0;
    if (n <= 0) continue;
    ctx.font = `700 30px ${SANS}`;
    const lw = ctx.measureText(LABEL[t]).width;
    ctx.font = `900 34px ${SANS}`;
    const cnt = `${n}회`;
    const cw = ctx.measureText(cnt).width;
    const pw = 24 + lw + 10 + cw + 24;
    if (cx + pw > x0 + maxW && cx > x0) {
      cx = x0;
      rowY += 66 + 14;
    }
    rr(ctx, cx, rowY, pw, 66, 33);
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = `700 30px ${SANS}`;
    ctx.fillText(LABEL[t], cx + 24, rowY + 44);
    ctx.font = `900 34px ${SANS}`;
    ctx.fillText(cnt, cx + 24 + lw + 10, rowY + 45);
    cx += pw + 14;
  }

  // 시간 칸 (아래)
  const boxH = 322;
  const boxY = H - 64 - 56 - boxH;
  rr(ctx, x0, boxY, maxW, boxH, 24);
  ctx.fillStyle = C.tint;
  ctx.fill();
  const bx = x0 + 40;
  ctx.fillStyle = C.deep;
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText("오늘 들은 시간", bx, boxY + 32 + 32);
  ctx.fillStyle = C.ink;
  ctx.font = `900 112px ${SANS}`;
  ctx.fillText(fmtListen(d.session_seconds), bx, boxY + 32 + 45 + 8 + 96);
  ctx.fillStyle = C.main;
  ctx.fillRect(bx, boxY + 228, maxW - 80, 2);
  ctx.fillStyle = C.deep;
  ctx.font = `700 32px ${SANS}`;
  ctx.fillText("지금까지 누적", bx, boxY + 288);
  ctx.fillStyle = C.ink;
  ctx.font = `900 56px ${SANS}`;
  ctx.textAlign = "right";
  ctx.fillText(fmtListen(d.total_seconds), x0 + maxW - 40, boxY + 290);
  ctx.textAlign = "left";

  // 도장: 제목 아래 ~ 시간 칸 위(기자 이름·음원 표시와는 겹쳐도 됨, 제목·시간 숫자는 가리지 않게), 좁으면 시간 칸 오른쪽 위 모서리
  const rand = rng(d.activity_id);
  const top = titleBottom - 10;
  const bottom = boxY + 40 - STAMP;
  const spot =
    bottom >= top
      ? { x: x0 - 40 + rand() * (maxW + 80 - STAMP), y: top + rand() * (bottom - top) }
      : { x: W - 64 - STAMP + 20, y: boxY - 150 }; // 빈 곳이 좁으면 시간 칸 오른쪽 위 모서리에 걸쳐서
  const angle = ((rand() * 50 - 25) * Math.PI) / 180;
  const stamp = drawStamp(rand, d.date);
  ctx.save();
  ctx.globalAlpha = 0.86;
  ctx.globalCompositeOperation = "multiply";
  ctx.translate(spot.x + STAMP / 2, spot.y + STAMP / 2);
  ctx.rotate(angle);
  ctx.drawImage(stamp, -150, -150);
  ctx.restore();

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("card"))), "image/png"));
}
