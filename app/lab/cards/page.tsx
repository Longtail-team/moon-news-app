"use client";

// 활동 카드 5종 미리보기(T07 PR A). 샘플 값으로만 그리고 서버로 보내지 않는다.
import { useEffect, useState } from "react";
import { drawListeningCard } from "@/lib/cards/listening";
import { drawReadingCard } from "@/lib/cards/reading";
import { drawSummaryCard } from "@/lib/cards/summary";
import { drawVocaCard } from "@/lib/cards/voca";
import { drawDebateCard } from "@/lib/cards/debate";
import type { CardStyle } from "@/lib/cards/listening";

const head = { activity_id: "sample-0001", cohort_no: 1, week_no: 4, date: "2026-10-09", reporter: "지우" };
const TITLE = "RM Opens His Art Collection to the World";

// 작성지 사진 대신 줄 친 종이 그림
function samplePaper(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 800;
  const g = c.getContext("2d")!;
  g.fillStyle = "#FBFCFC";
  g.fillRect(0, 0, 600, 800);
  for (let y = 60; y < 800; y += 48) {
    g.fillStyle = "#D3DCDB";
    g.fillRect(30, y, 540, 2);
    g.fillStyle = "rgba(90,90,90,.5)";
    g.fillRect(40, y - 26, 120 + ((y * 37) % 380), 8);
  }
  return c;
}

async function drawAll(style: CardStyle) {
  const photo = samplePaper();
  const items: [string, Promise<Blob>][] = [
    ["청독", drawListeningCard({ ...head, title: TITLE, name: "김지우", plays: { article_audio: 2, kr_en_repeat_audio: 1 }, session_seconds: 432, total_seconds: 4320 }, style)],
    ["읽기 완료(영어)", drawReadingCard({ ...head, activity_id: "sample-0002", title: TITLE, lang: "en", record_seconds: 102, words: 173, total_words: 519, total_reads: 3 }, style)],
    ["읽기 완료(한국어)", drawReadingCard({ ...head, activity_id: "sample-0003", title: TITLE, lang: "kr", record_seconds: 125, words: 173, total_words: 519, total_reads: 4 }, style)],
    [
      "기사 요약",
      drawSummaryCard(
        { ...head, activity_id: "sample-0004", article_title: TITLE, my_title: "RM's Long Self-Introduction", summary: "RM of BTS is sharing his art collection at SFMOMA. The show has 178 artworks, and half are by Korean artists. RM chose the works and wrote the wall texts himself.", photo },
        style,
      ),
    ],
    ["기사 요약(요약 없음)", drawSummaryCard({ ...head, activity_id: "sample-0005", article_title: TITLE, my_title: null, summary: null, photo }, style)],
    ["VOCA(사진)", drawVocaCard({ ...head, activity_id: "sample-0006", title: TITLE, words: ["collection", "exhibition", "personal", "artwork", "lend", "audio guide", "honestly", "collector"], method: "photo", photo, total_words: 32 }, style)],
    ["VOCA(단어 낭독)", drawVocaCard({ ...head, activity_id: "sample-0007", title: TITLE, words: ["collection", "exhibition", "personal", "artwork", "lend", "audio guide", "honestly", "collector"], method: "reading", photo: null, total_words: 32 }, style)],
    ["토론", drawDebateCard({ ...head, activity_id: "sample-0008", question: "유명인이 모은 미술품을 미술관에서 전시하는 것, 좋은 일일까요?", counts: { agree: 21, disagree: 17, unsure: 6 }, feel: "더 이야기하고 싶어요" }, style)],
  ];
  return Promise.all(items.map(async ([label, p]) => ({ label, url: URL.createObjectURL(await p) })));
}

export default function CardsLab() {
  const [style, setStyle] = useState<CardStyle>("insta");
  const [cards, setCards] = useState<{ label: string; url: string }[]>([]);
  useEffect(() => {
    let alive = true;
    drawAll(style).then((c) => alive && setCards(c));
    return () => {
      alive = false;
    };
  }, [style]);
  return (
    <main style={{ padding: 16, maxWidth: 1200, margin: "0 auto", fontFamily: "Pretendard, sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>활동 카드 미리보기</h1>
      <p style={{ fontSize: 13, color: "#5A5A5A" }}>샘플 값으로 그린 카드예요. 1080×1350 PNG.</p>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        {(["insta", "app"] as const).map((s) => (
          <button key={s} onClick={() => setStyle(s)} style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: style === s ? "2px solid #1F7F77" : "1px solid #D3DCDB", background: style === s ? "#E2F6F3" : "#fff" }}>
            {s === "insta" ? "인스타용" : "앱·뉴스북용"}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
        {cards.map((c) => (
          <figure key={c.label} style={{ margin: 0 }} data-card={c.label}>
            <img src={c.url} alt={`${c.label} 카드`} style={{ width: "100%", borderRadius: 4, boxShadow: "0 2px 10px rgba(31,127,119,.12)" }} />
            <figcaption style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{c.label}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
