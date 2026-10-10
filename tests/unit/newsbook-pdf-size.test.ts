// 뉴스북 PDF 크기: 12주를 모두 채운 학습자도 받을 수 있는 크기여야 한다(저사양 휴대폰·모바일 데이터, T07 4-1).
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

const { renderNewsbook } = await import("@/lib/pdf/newsbook");
const { pdfImage } = await import("@/lib/pdf/images");
import type { Newsbook, BookWeek } from "@/lib/server/newsbook";

// 사진·카드 흉내: 그림마다 다르게(같은 그림은 PDF에 한 번만 들어가므로), 큰 무늬 + 약한 잡음
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
async function fake(w: number, h: number, format: "jpg" | "png", grain: number) {
  const sw = format === "png" ? 24 : 64;
  const sh = Math.round((64 * h) / w);
  const small = Buffer.alloc(sw * sh * 3);
  for (let i = 0; i < small.length; i++) small[i] = 120 + rnd() * 135;
  const base = await sharp(small, { raw: { width: sw, height: sh, channels: 3 } }).resize(w, h, { kernel: format === "png" ? "nearest" : "lanczos3" }).raw().toBuffer();
  for (let i = 0; i < base.length; i++) base[i] = Math.max(0, Math.min(255, base[i] + (rnd() - 0.5) * grain));
  const img = sharp(base, { raw: { width: w, height: h, channels: 3 } });
  return { data: await (format === "jpg" ? img.jpeg({ quality: 85 }) : img.png({ compressionLevel: 6 })).toBuffer(), format };
}

function book(): { b: Newsbook; pages: BookWeek[] } {
  const weeks: BookWeek[] = Array.from({ length: 12 }, (_, i) => ({
    week_no: i + 1,
    starts_at: `2026-09-${String(14 + (i % 2)).padStart(2, "0")}T00:00:00+09:00`,
    title_en: "RM Opens His Art Collection to the World",
    title_ko: null,
    summary: { activity_id: `s${i}`, title: "RM's Long Self-Introduction", body: "RM of BTS is sharing his art collection at SFMOMA. ".repeat(4), has_photo: true },
    opinion: { stance: "agree", reason: "It is a good way to share art." },
    cards: [0, 1, 2, 3].map((k) => ({ activity_id: `c${i}-${k}` })),
    tally: { agree: 20, disagree: 15, final: true },
  }));
  const b = {
    enrollment_id: "e1",
    is_current: true,
    student: { name: "김지우", ai_consent: false },
    cohort: { course_title: "새벽달 영어뉴스", cohort_no: 1, start_date: "2026-09-14", deadline: "2026-12-06", weeks_total: 12, total_target: 60 },
    download_from: "2026-12-07",
    can_download: true,
    pending_post_count: 0,
    stats: { readings: 24, articles: 12, summaries: 12, opinions: 12, weeks_met: 12, completed: 60, verified: 60, acts: {}, reading_words: 4000, listening_seconds: 20000 },
    weeks,
    others: [],
  } as Newsbook;
  return { b, pages: weeks };
}

describe("뉴스북 PDF 크기", () => {
  it("12주를 다 채워도(사진 12장 + 카드 48장) 4MB 아래", async () => {
    const { b, pages } = book();
    const raw: Record<string, { data: Buffer; format: "jpg" | "png" }> = {};
    for (const w of pages) {
      raw[w.summary!.activity_id] = (await fake(2048, 1536, "jpg", 24)) as { data: Buffer; format: "jpg" }; // 올린 작성지 사진(긴 변 2048px)
      for (const c of w.cards) raw[c.activity_id] = (await fake(1080, 1350, "png", 0)) as { data: Buffer; format: "png" }; // 보관된 청독 카드
    }
    const avg = (k: (id: string) => boolean) => {
      const v = Object.entries(raw).filter(([id]) => k(id)).map(([, p]) => p.data.length);
      return (v.reduce((a, b) => a + b, 0) / v.length / 1e3).toFixed(0);
    };
    console.log(`그림 한 장 평균: 사진 ${avg((id) => id.startsWith("s"))}KB, 카드 ${avg((id) => id.startsWith("c"))}KB`);
    const small: typeof raw = {};
    for (const w of pages) {
      small[w.summary!.activity_id] = await pdfImage(raw[w.summary!.activity_id], "photo");
      for (const c of w.cards) small[c.activity_id] = await pdfImage(raw[c.activity_id], "card");
    }
    const before = (await renderNewsbook(b, pages, raw)).length;
    const after = (await renderNewsbook(b, pages, small)).length;
    console.log(`뉴스북 PDF: 원본 그림 ${(before / 1e6).toFixed(1)}MB → 줄인 그림 ${(after / 1e6).toFixed(1)}MB`);
    expect(after).toBeLessThan(4_000_000);
  }, 120_000);
});
