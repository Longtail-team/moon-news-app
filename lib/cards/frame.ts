// 활동 카드 공통 틀 (2026-10-10, T07 PR A). 청독·읽기 완료·기사 요약·VOCA·토론 카드가 같은 신문 스크랩 모양에 도장만 다르다.
// 휴대폰에서 1080×1350(인스타 4:5) PNG로 그린다. 그림 순서·값은 기존 청독 카드(시안 C)와 같다.
import { fitTitle, stampSpot, type TitleStep } from "./layout";

export const W = 1080;
export const H = 1350;
export const C = { bg: "#F6F8F8", line: "#E3E9E8", main: "#76D4CC", tint: "#E2F6F3", deep: "#1F7F77", ink: "#2D2D2D", sub: "#5A5A5A", faint: "#D3DCDB" };
export const SANS = "Pretendard, 'Noto Sans KR', sans-serif";
export const SERIF = "'Noto Serif KR', serif";
export const STAMP = 300; // 도장 크기(px)
export const X0 = 132; // 종이 안쪽 왼쪽
export const MAX_W = W - 264; // 종이 안쪽 폭
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 카드마다 같은 머리글에 쓰는 값 */
export type CardHead = {
  activity_id: string; // 도장 자리·각도를 정하는 씨앗(같은 기록이면 다시 그려도 같은 모양)
  cohort_no: number;
  week_no: number;
  date: string; // "2026-10-09"
  reporter: string; // 기자 이름(부르는 이름)
};

/** 도장 종류: 가운데 글자와 둘레 영어 */
export type StampKind = "listen" | "read" | "summary" | "voca" | "debate";
const STAMP_TEXT: Record<StampKind, { label: string; ring: string }> = {
  listen: { label: "청독", ring: "LISTENED" },
  read: { label: "낭독", ring: "READ ALOUD" },
  summary: { label: "요약", ring: "SUMMARIZED" },
  voca: { label: "단어", ring: "WORDS LEARNED" },
  debate: { label: "토론", ring: "DEBATED" },
};

// 같은 id면 같은 값 (FNV-1a → mulberry32)
export function rng(seedText: string) {
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

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function dateLabel(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return `${m}월 ${day}일(${DOW[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]})`;
}

/** 서체를 미리 불러온다(실패해도 대체 서체로 그림) */
export async function loadFonts(specs: [font: string, text: string][]) {
  try {
    await Promise.all(specs.map(([f, t]) => document.fonts.load(f, t)));
  } catch {}
}

/** 배경·종이·머리글(새벽달 영어뉴스 / 기수·주차·날짜)·굵은 줄. 머리글 아래 y를 돌려준다 */
export function startCard(head: CardHead) {
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

  let y = 124;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.ink;
  ctx.font = `900 42px ${SERIF}`;
  ctx.textAlign = "left";
  ctx.fillText("새벽달 영어뉴스", X0, y + 44);
  ctx.font = `400 27px ${SANS}`;
  ctx.fillStyle = C.sub;
  ctx.textAlign = "right";
  ctx.fillText(`${head.cohort_no}기 · ${head.week_no}주차 · ${dateLabel(head.date)}`, X0 + MAX_W, y + 40);
  y += 66;
  ctx.fillStyle = C.ink;
  ctx.fillRect(X0, y, MAX_W, 4);
  y += 4 + 22;
  ctx.textAlign = "left";
  return { canvas, ctx, y };
}

/** 작은 머리말(예: "이번 주 토론"). 다음 y를 돌려준다 */
export function drawKicker(ctx: CanvasRenderingContext2D, text: string, y: number) {
  ctx.fillStyle = C.deep;
  ctx.font = `800 28px ${SANS}`;
  ctx.fillText(text, X0, y + 30);
  return y + 30 + 14;
}

/** 큰 제목: 크기 단계에 맞춰 줄바꿈. 제목 아래 y를 돌려준다 */
export function drawTitle(ctx: CanvasRenderingContext2D, text: string, steps: TitleStep[], y: number, maxW = MAX_W) {
  const { size, lines } = fitTitle(
    (s, t) => {
      ctx.font = `900 ${s}px ${SERIF}`;
      return ctx.measureText(t).width;
    },
    text,
    steps,
    maxW,
  );
  ctx.font = `900 ${size}px ${SERIF}`;
  ctx.fillStyle = C.ink;
  for (const l of lines) {
    y += size * 1.2;
    ctx.fillText(l, X0, y - size * 0.22);
  }
  return y;
}

/** 회색 작은 줄(기자 이름 등). 다음 y를 돌려준다 */
export function drawSubLine(ctx: CanvasRenderingContext2D, text: string, y: number, size = 30) {
  ctx.font = `400 ${size}px ${SANS}`;
  ctx.fillStyle = C.sub;
  y += 22 + 34;
  ctx.fillText(text, X0, y);
  return y;
}

/** 테두리 알약들(라벨 + 굵은 값). 넘치면 다음 줄. 마지막 줄 아래 y를 돌려준다 */
export function drawPills(ctx: CanvasRenderingContext2D, pills: { label: string; value?: string }[], y: number, maxW = MAX_W) {
  let cx = X0;
  let rowY = y;
  for (const p of pills) {
    ctx.font = `700 30px ${SANS}`;
    const lw = ctx.measureText(p.label).width;
    ctx.font = `900 34px ${SANS}`;
    const cw = p.value ? ctx.measureText(p.value).width : 0;
    const pw = 24 + lw + (p.value ? 10 + cw : 0) + 24;
    if (cx + pw > X0 + maxW && cx > X0) {
      cx = X0;
      rowY += 66 + 14;
    }
    rr(ctx, cx, rowY, pw, 66, 33);
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = `700 30px ${SANS}`;
    ctx.fillText(p.label, cx + 24, rowY + 44);
    if (p.value) {
      ctx.font = `900 34px ${SANS}`;
      ctx.fillText(p.value, cx + 24 + lw + 10, rowY + 45);
    }
    cx += pw + 14;
  }
  return rowY + 66;
}

export const BOX_H = 322;
export const BOX_Y = H - 64 - 56 - BOX_H;

/** 활동 아이콘(앱 12주 기록·활동 고르기와 같은 그림, components/student/icons.tsx). 이모지는 기기마다 달라 쓰지 않음 */
export type ActivityIcon = "listen" | "read-en" | "read-kr";
export function drawActivityIcon(ctx: CanvasRenderingContext2D, icon: ActivityIcon, x: number, y: number, size: number) {
  const k = size / 24; // 아이콘은 24×24 기준
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.strokeStyle = C.deep;
  ctx.fillStyle = C.deep;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (icon === "listen") {
    ctx.stroke(new Path2D("M4 15v-3a8 8 0 0 1 16 0v3"));
    ctx.beginPath();
    ctx.roundRect(3, 14, 4.5, 6.5, 1.8);
    ctx.roundRect(16.5, 14, 4.5, 6.5, 1.8);
    ctx.stroke();
  } else {
    ctx.stroke(new Path2D("M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-8l-4 3.5V17H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"));
    const en = icon === "read-en";
    ctx.font = `800 ${en ? 9 : 8}px ${SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(en ? "A" : "가", 12, 13.6);
  }
  ctx.restore();
}

/** 아래 숫자 칸: 위 라벨 + 큰 값(옆에 활동 아이콘) / 줄 / 아래 라벨 + 값 */
export function drawStatBox(ctx: CanvasRenderingContext2D, s: { label: string; big: string; footLabel: string; footValue: string; icon?: ActivityIcon }) {
  rr(ctx, X0, BOX_Y, MAX_W, BOX_H, 24);
  ctx.fillStyle = C.tint;
  ctx.fill();
  const bx = X0 + 40;
  ctx.fillStyle = C.deep;
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText(s.label, bx, BOX_Y + 32 + 32);
  ctx.fillStyle = C.ink;
  ctx.font = `900 112px ${SANS}`;
  ctx.fillText(s.big, bx, BOX_Y + 32 + 45 + 8 + 96);
  // 큰 숫자 바로 옆에 활동 아이콘(뉴스북의 작은 카드에서도 청독·낭독이 구분되게)
  // 크기 140px: 뉴스북 작은 카드(폭 약 75px)에서도 10px 정도로 보임
  if (s.icon) drawActivityIcon(ctx, s.icon, bx + ctx.measureText(s.big).width + 34, BOX_Y + 52, 140);
  ctx.fillStyle = C.main;
  ctx.fillRect(bx, BOX_Y + 228, MAX_W - 80, 2);
  ctx.fillStyle = C.deep;
  ctx.font = `700 32px ${SANS}`;
  ctx.fillText(s.footLabel, bx, BOX_Y + 288);
  ctx.fillStyle = C.ink;
  ctx.font = `900 56px ${SANS}`;
  ctx.textAlign = "right";
  ctx.fillText(s.footValue, X0 + MAX_W - 40, BOX_Y + 290);
  ctx.textAlign = "left";
}

/** 작성지 사진: 흰 테두리 + 그림자, 사진은 칸을 꽉 채우게(가운데 잘라냄). 사진이 없으면 그리지 않음 */
export function drawPhoto(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, deg: number) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.shadowColor = "rgba(45,45,45,0.18)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 10;
  rr(ctx, -w / 2, -h / 2, w, h, 10);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.line;
  ctx.stroke();
  const pad = 20;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const scale = Math.max(iw / img.width, ih / img.height);
  const sw = iw / scale;
  const sh = ih / scale;
  rr(ctx, -w / 2 + pad, -h / 2 + pad, iw, ih, 4);
  ctx.clip();
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, -w / 2 + pad, -h / 2 + pad, iw, ih);
  ctx.restore();
}

function drawStamp(rand: () => number, date: string, kind: StampKind): HTMLCanvasElement {
  const S = STAMP;
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
  const t = STAMP_TEXT[kind];
  const ringText = `SAEBYEOKDAL ENGLISH NEWS ★ ${t.ring} ★ `;
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
  g.fillText(t.label, 0, -6);
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

/**
 * 도장 찍기: top~bottom 사이 빈 곳의 아무 자리 + 각도 -25°~+25°.
 * 빈 곳이 좁으면 fallback 자리(카드마다 정함). 같은 activity_id면 같은 자리·각도·모양.
 */
export function placeStamp(ctx: CanvasRenderingContext2D, head: CardHead, kind: StampKind, area: { top: number; bottom: number; left?: number; width?: number; fallback: { x: number; y: number } }) {
  const rand = rng(head.activity_id);
  const spot = stampSpot(rand, { ...area, left: area.left ?? X0 - 40, width: area.width ?? MAX_W + 80, size: STAMP });
  const angle = ((rand() * 50 - 25) * Math.PI) / 180;
  const stamp = drawStamp(rand, head.date, kind);
  ctx.save();
  ctx.globalAlpha = 0.86;
  ctx.globalCompositeOperation = "multiply";
  ctx.translate(spot.x + STAMP / 2, spot.y + STAMP / 2);
  ctx.rotate(angle);
  ctx.drawImage(stamp, -150, -150);
  ctx.restore();
}

export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("card"))), "image/png"));
}
