import { describe, expect, it } from "vitest";
import { articleHref, canSlash, defaultView, parseLang, parseMode, viewProps } from "@/lib/article/mode";

describe("합친 기사 화면 상태 규칙", () => {
  it("주소 값 읽기: 모르는 값은 청독·영어", () => {
    expect(parseMode("read")).toBe("read");
    expect(parseMode("debate")).toBe("debate");
    expect(parseMode("x")).toBe("listen");
    expect(parseMode(null)).toBe("listen");
    expect(parseLang("kr")).toBe("kr");
    expect(parseLang("zz")).toBe("en");
  });

  it("시트에 맞춘 기본 지문: 청독·찬반은 한·영, 읽기는 읽는 언어만", () => {
    expect(defaultView("listen", "en")).toBe("both");
    expect(defaultView("debate", "kr")).toBe("both");
    expect(defaultView("read", "en")).toBe("en");
    expect(defaultView("read", "kr")).toBe("ko");
  });

  it("지문 보기 → ArticleText 값, 끊어 읽기는 영어가 보일 때만", () => {
    expect(viewProps("en")).toEqual({ en: true, onlyMain: true });
    expect(viewProps("both")).toEqual({ en: true, onlyMain: false });
    expect(viewProps("ko")).toEqual({ en: false, onlyMain: true });
    expect(canSlash("ko")).toBe(false);
    expect(canSlash("both")).toBe(true);
  });

  it("화면 주소", () => {
    expect(articleHref(4)).toBe("/article/4");
    expect(articleHref(4, "read", "kr")).toBe("/article/4?mode=read&lang=kr");
    expect(articleHref(4, "debate")).toBe("/article/4?mode=debate");
  });
});
