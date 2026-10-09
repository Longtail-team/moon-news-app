// 지문(영어 끊어 읽기 구 + 한국어 문장)과 하이라이트. 기사 읽기와 청독이 함께 쓴다 (spec 8장)
import { chunksOf, enId, koId, paragraphs, type Sentence } from "@/lib/reading/text";

export function ArticleText({
  sentences,
  hl,
  en,
  slash,
  onlyMain,
  gap = 14,
}: {
  sentences: Sentence[];
  hl: string[]; // 칠할 조각 id
  en: boolean; // 영어가 주인(영어 먼저)
  slash: boolean; // 끊어 읽기 "/" 표시
  onlyMain: boolean; // 주인 언어만
  gap?: number;
}) {
  return (
    <div className={`txt${en ? "" : " koMain"}`}>
      {paragraphs(sentences).map((idx, pi) => {
        const E = (
          <div className="en" key="e">
            {idx.map((si) => (
              <span key={si}>
                {chunksOf(sentences[si]).map((c, ci, all) => (
                  <span key={ci}>
                    <span id={enId(si, ci)} className={`ck${hl.includes(enId(si, ci)) ? " hl" : ""}`}>
                      {c}
                    </span>
                    {ci < all.length - 1 ? slash ? <span className="sl">/</span> : " " : null}
                  </span>
                ))}{" "}
              </span>
            ))}
          </div>
        );
        const K = (
          <div className="ko" key="k">
            {idx.map((si) => (
              <span key={si}>
                <span id={koId(si)} className={`sk${hl.includes(koId(si)) ? " hl" : ""}`}>
                  {sentences[si].ko}
                </span>{" "}
              </span>
            ))}
          </div>
        );
        if (onlyMain) return <div key={pi} style={{ marginBottom: gap }}>{en ? E : K}</div>;
        return <div key={pi}>{en ? [E, K] : [K, E]}</div>;
      })}
    </div>
  );
}
