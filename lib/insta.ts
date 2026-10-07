// 인스타그램 게시물 링크 정리: 붙여넣은 글에서 게시물 주소를 찾아 한 가지 모양으로 맞춘다.
// https://www.instagram.com/p|reel/<코드>/  (추적용 ?igsh= 등은 버린다)
// 실제 게시물이 있는지는 확인하지 않는다(spec 18장 미확정).
const RE = /https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]+)/i;

export function normalizeInstaUrl(input: string): string | null {
  const m = RE.exec(input.trim());
  if (!m) return null;
  const kind = m[1].toLowerCase().startsWith("reel") ? "reel" : "p";
  return `https://www.instagram.com/${kind}/${m[2]}/`;
}
