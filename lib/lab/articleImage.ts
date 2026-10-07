// 검사 2. 기사 이미지 (1080×1350, 4:5). 검사 3의 영상 화면으로 쓴다.

export const IMAGE_W = 1080;
export const IMAGE_H = 1350;

const TITLE = "RM Opens His Art Collection to the World";
const COURSE = "새벽달 영어뉴스 1주차";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function drawArticleImage(canvas: HTMLCanvasElement, learnerName: string): Promise<{ fontLoaded: boolean }> {
  let fontLoaded = false;
  try {
    const sample = `${TITLE}${COURSE}${learnerName}영어 기사 낭독`;
    const faces = await Promise.all([
      document.fonts.load("700 84px Pretendard", sample),
      document.fonts.load("600 44px Pretendard", sample),
      document.fonts.load("500 36px Pretendard", sample),
    ]);
    fontLoaded = faces.every((f) => f.length > 0);
  } catch {
    fontLoaded = false;
  }

  canvas.width = IMAGE_W;
  canvas.height = IMAGE_H;
  const ctx = canvas.getContext("2d")!;
  const pad = 96;

  ctx.fillStyle = "#E2F6F3";
  ctx.fillRect(0, 0, IMAGE_W, IMAGE_H);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#1F7F77";
  ctx.font = "600 44px Pretendard, sans-serif";
  ctx.fillText(COURSE, pad, 220);

  ctx.fillStyle = "#2D2D2D";
  ctx.font = "700 84px Pretendard, sans-serif";
  let y = 360;
  for (const line of wrap(ctx, TITLE, IMAGE_W - pad * 2)) {
    ctx.fillText(line, pad, y);
    y += 108;
  }

  ctx.fillStyle = "#2D2D2D";
  ctx.font = "600 52px Pretendard, sans-serif";
  ctx.fillText(learnerName, pad, IMAGE_H - 200);
  ctx.fillStyle = "#5A5A5A";
  ctx.font = "500 36px Pretendard, sans-serif";
  ctx.fillText("영어 기사 낭독", pad, IMAGE_H - 140);

  return { fontLoaded };
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob 실패"))), "image/png"),
  );
}
