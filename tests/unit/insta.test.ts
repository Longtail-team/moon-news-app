import { describe, expect, it } from "vitest";
import { normalizeInstaUrl } from "@/lib/insta";

describe("인스타 링크 정리", () => {
  it.each([
    ["https://www.instagram.com/p/DAbc123_-x/", "https://www.instagram.com/p/DAbc123_-x/"],
    ["https://www.instagram.com/p/DAbc123/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==", "https://www.instagram.com/p/DAbc123/"],
    ["instagram 링크 https://instagram.com/reel/C9xYz/?igsh=abc 확인", "https://www.instagram.com/reel/C9xYz/"],
    ["https://www.instagram.com/reels/C9xYz/", "https://www.instagram.com/reel/C9xYz/"],
    ["https://www.instagram.com/sample_jiwoo/p/DAbc123/", "https://www.instagram.com/p/DAbc123/"],
    ["https://m.instagram.com/tv/B1/", "https://www.instagram.com/p/B1/"],
  ])("%s", (input, out) => expect(normalizeInstaUrl(input)).toBe(out));

  it.each(["https://www.instagram.com/sample_jiwoo/", "https://example.com/p/abc/", "그냥 글자", ""])("게시물이 아님: %s", (input) =>
    expect(normalizeInstaUrl(input)).toBeNull(),
  );
});
