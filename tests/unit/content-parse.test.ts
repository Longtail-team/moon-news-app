// 콘텐츠 시트 검사 규칙
import { describe, expect, it } from "vitest";
// @ts-expect-error 순수 JS 모듈(GitHub Actions에서 바로 실행)
import { buildSync, storageKey } from "@/lib/content/parse.mjs";

const weeks = Array.from({ length: 12 }, (_, i) => ({ week_no: i + 1, starts_at: new Date(Date.UTC(2026, 8, 13, 15) + i * 7 * 864e5).toISOString() }));
const ctx = (now = "2026-10-07T03:00:00Z", files = new Map()) => ({ weeks, now: new Date(now), files });
const head = {
  기사: ["주차", "영어 제목", "부제", "한국어 제목", "단어 수", "렉사일", "AR", "상태", "자료 PDF", "영어 음원", "한영 구간반복", "VOCA 구간반복", "인스타 템플릿", "메모"],
  문장: ["주차", "문단", "문장", '영어 (끊어 읽기 " / ")', "한국어", "검수 메모"],
  단어: ["주차", "번호", "단어", "뜻", "예문"],
  "추가 자료": ["주차", "순서", "종류", "제목", "링크 (https)", "내용"],
  라이브: ["회차", "일시 (예: 2026-10-24 20:00)", "줌 링크", "다시보기 링크"],
};
const tabs = (over: Partial<Record<keyof typeof head, string[][]>> = {}) =>
  Object.fromEntries(Object.entries(head).map(([k, h]) => [k, [h, ...((over as Record<string, string[][]>)[k] ?? [])]]));

describe("콘텐츠 시트 반영 검사", () => {
  it("공개 주차가 온전하면 반영, 머리글 이름으로 열을 찾는다", () => {
    const r = buildSync(
      tabs({
        기사: [["1", "RM Opens", "“Sub”", "", "173", "780L", "", "공개", "", "", "", "", "", ""]],
        문장: [["1", "1", "1", "For RM of BTS, / the answer is art.", "방탄소년단의 RM에게", ""]],
        "추가 자료": [["1", "1", "링크", "SFMOMA", "https://www.sfmoma.org/", ""]],
        라이브: [["1", "2026-10-24 20:00", "https://zoom.us/j/1", ""]],
      }),
      ctx(),
    );
    expect(r.globalErrors).toEqual([]);
    expect(r.weeks[0]).toMatchObject({ week_no: 1, status: "published", skip: false, errors: [] });
    expect(r.weeks[0].payload).toMatchObject({ title_en: "RM Opens", subtitle: "“Sub”", word_count: 173, level: "780L" });
    expect(r.weeks[0].payload.sentences).toEqual([{ para_no: 1, sent_no: 1, en: "For RM of BTS, / the answer is art.", ko: "방탄소년단의 RM에게" }]);
    expect(r.live).toEqual([{ session_no: 1, starts_at: "2026-10-24T20:00:00+09:00", zoom_url: "https://zoom.us/j/1", replay_url: "" }]);
  });

  it("공개 주차에 빈 한국어가 있으면 그 주차는 반영하지 않는다", () => {
    const r = buildSync(tabs({ 기사: [["2", "Cash", "", "", "190", "", "", "공개"]], 문장: [["2", "1", "1", "Imagine opening a trash bag.", ""]] }), ctx());
    expect(r.weeks[0].skip).toBe(true);
    expect(r.weeks[0].errors.join()).toContain("한국어가 비어 있어요");
  });

  it("초안 주차는 문제가 있어도 반영하고 경고로 남긴다(학생에게 안 보임)", () => {
    const r = buildSync(tabs({ 기사: [["2", "Cash", "", "", "190", "", "", "초안"]], 문장: [["2", "1", "1", "Imagine opening a trash bag.", ""]] }), ctx());
    expect(r.weeks[0]).toMatchObject({ skip: false, errors: [] });
    expect(r.weeks[0].warnings.join()).toContain("한국어가 비어 있어요");
    // 2주차는 9/21 시작 → 이미 시작했는데 초안이라는 경고
    expect(r.weeks[0].warnings.join()).toContain("이미 시작됐지만");
  });

  it("폴더에 없는 파일, http 링크, 잘못된 끊어 읽기, 겹치는 문장 번호", () => {
    const r = buildSync(
      tabs({
        기사: [["3", "T", "", "", "", "", "", "공개", "week03.pdf"]],
        문장: [["3", "1", "1", "A/B test", "가"], ["3", "1", "1", "C", "나"]],
        "추가 자료": [["3", "1", "링크", "X", "http://a.b", ""]],
      }),
      ctx(),
    );
    const e = r.weeks[0].errors.join("\n");
    expect(e).toContain("week03.pdf");
    expect(e).toContain("https://");
    expect(e).toContain("겹쳐요");
    expect(r.weeks[0].warnings.join()).toContain("앞뒤를 띄운");
  });

  it("폴더에 있는 파일은 원본 id·md5와 함께 넘긴다", () => {
    const files = new Map([["week01.pdf", { id: "F1", md5: "abcdef1234567890", mimeType: "application/pdf" }]]);
    const r = buildSync(tabs({ 기사: [["1", "T", "", "", "", "", "", "공개", "week01.pdf"]], 문장: [["1", "1", "1", "A", "가"]] }), ctx(undefined, files));
    expect(r.weeks[0].files).toEqual([{ type: "article_pdf", file_name: "week01.pdf", source_file_id: "F1", source_md5: "abcdef1234567890", mime: "application/pdf" }]);
    expect(storageKey(1, 1, "article_pdf", "week01.pdf", "abcdef1234567890")).toBe("cohort-1/week01/article_pdf-abcdef123456.pdf");
  });

  it("이름 규칙(news01_week01_voca.mp3)으로 시트 칸이 비어 있어도 자동 연결, 칸에 쓴 이름이 우선", () => {
    const f = (id: string) => ({ id, md5: id + "md5", mimeType: "x" });
    const files = new Map([
      ["news01_week01_pdf.pdf", f("P")],
      ["news01_week01_article.mp3", f("A")],
      ["news01_week01_voca.mp3", f("V")],
      ["news01_week01_tem.png", f("T")],
      ["news02_week01_voca.mp3", f("OTHER")], // 다른 기수
      ["news01_week1_kren.mp3", f("BAD")], // 규칙과 다름
      ["special.mp3", f("S")],
    ]);
    const r = buildSync(
      tabs({ 기사: [["1", "T", "", "", "", "", "", "공개", "", "", "", "special.mp3"]], 문장: [["1", "1", "1", "A", "가"]] }),
      { ...ctx(undefined, files), cohortNo: 1 },
    );
    const got = Object.fromEntries(r.weeks[0].files.map((x: { type: string; source_file_id: string }) => [x.type, x.source_file_id]));
    expect(got).toEqual({ article_pdf: "P", article_audio: "A", voca_repeat_audio: "S", insta_template: "T" });
    expect(r.fileWarnings.join()).toContain("news01_week1_kren.mp3");
  });

  it("주차 숫자·중복·없는 주차는 전체 오류", () => {
    const r = buildSync(tabs({ 기사: [["x", "A"], ["1", "A"], ["1", "B"], ["13", "C"]] }), ctx());
    expect(r.globalErrors).toHaveLength(3);
  });
});
