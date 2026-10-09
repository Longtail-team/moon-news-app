// 뉴스북 PDF (뉴스북 구성안 2026-10-09, 기수별 1권): 표지 → 이번 기수의 기록 → 기사별 쪽 → 내가 붙인 제목 모아보기
// 서버에서만 만든다. 손글씨 사진은 보관 기간(종강 후 3개월) 안에만 들어간다.
import "server-only";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { BookWeek, Newsbook } from "@/lib/server/newsbook";
import { fmtDay, fmtMonthDay, givenName } from "@/lib/format";
import { withGa } from "@/lib/korean";

const FONT_DIR = path.join(process.cwd(), "lib", "pdf", "fonts");
Font.register({
  family: "Pretendard",
  fonts: [
    { src: path.join(FONT_DIR, "Pretendard-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Pretendard-Bold.ttf"), fontWeight: 700 },
  ],
});
// 한글 낱말을 하이픈으로 끊지 않는다
Font.registerHyphenationCallback((word) => [word]);

const C = { bg: "#F6F8F8", line: "#E3E9E8", main: "#76D4CC", tint: "#E2F6F3", deep: "#1F7F77", ink: "#2D2D2D", sub: "#5A5A5A", mute: "#EEF2F2" };

const s = StyleSheet.create({
  page: { fontFamily: "Pretendard", fontSize: 11, color: C.ink, padding: 48, lineHeight: 1.6 },
  cover: { fontFamily: "Pretendard", color: C.ink, padding: 56, backgroundColor: C.tint, justifyContent: "center" },
  h1: { fontSize: 30, fontWeight: 700, lineHeight: 1.3 },
  h2: { fontSize: 18, fontWeight: 700, marginBottom: 14 },
  meta: { fontSize: 11, color: C.sub },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 16, marginBottom: 14, backgroundColor: "#FFFFFF" },
  label: { fontSize: 9, fontWeight: 700, color: C.deep, marginBottom: 6 },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.mute },
  bar: { height: 10, borderRadius: 5, backgroundColor: C.mute, flexDirection: "row", overflow: "hidden", marginVertical: 6 },
  foot: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 8, color: C.sub, textAlign: "center" },
});

export type PdfPhoto = { data: Buffer; format: "jpg" | "png" };

function ArticlePage({ w, reporter, photo, cards }: { w: BookWeek; reporter: string; photo?: PdfPhoto; cards: PdfPhoto[] }) {
  const t = w.tally;
  const total = t ? t.agree + t.disagree : 0;
  const pct = t && total ? Math.round((t.agree / total) * 100) : 0;
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.meta}>
        {w.week_no}주차 · {fmtMonthDay(w.starts_at)} 주
      </Text>
      <Text style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>{w.title_en ?? `${w.week_no}주차 기사`}</Text>

      {w.summary && (
        <View style={s.card}>
          <Text style={s.label}>뉴스 카드</Text>
          {w.summary.title ? <Text style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{w.summary.title}</Text> : null}
          {w.summary.body ? <Text style={{ fontSize: 11.5 }}>{w.summary.body}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
            <Text style={{ fontSize: 10, color: C.sub }}>기자 {reporter}</Text>
            {photo ? <Image src={photo} style={{ width: 90, height: 120, objectFit: "cover", borderRadius: 6 }} /> : null}
          </View>
        </View>
      )}

      {w.opinion && (
        <View style={s.card}>
          <Text style={s.label}>의견 카드</Text>
          <Text style={{ fontSize: 14, fontWeight: 700 }}>내 입장: {w.opinion.stance === "agree" ? "찬성" : "반대"}</Text>
          {w.opinion.reason ? <Text style={{ marginTop: 6 }}>{w.opinion.reason}</Text> : null}
        </View>
      )}

      {t && total > 0 && (
        <View style={{ marginTop: 4 }}>
          <Text style={s.label}>찬반 결과{t.final ? "" : " (집계 중)"}</Text>
          <View style={s.bar}>
            <View style={{ width: `${pct}%`, backgroundColor: C.main }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 10 }}>찬성 {pct}%</Text>
            <Text style={{ fontSize: 10 }}>
              반대 {100 - pct}% · {total}명
            </Text>
          </View>
        </View>
      )}
      {cards.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={s.label}>청독 카드 {cards.length}장</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 }}>
            {cards.map((c, i) => (
              // 4열 (인스타 4:5 그대로)
              <View key={i} style={{ width: "25%", padding: 3 }}>
                <Image src={c} style={{ width: "100%", height: 149, objectFit: "cover", borderRadius: 4 }} />
              </View>
            ))}
          </View>
        </View>
      )}
      <Text style={s.foot} fixed>
        새벽달 영어뉴스
      </Text>
    </Page>
  );
}

function NewsbookDoc({ b, pages, photos }: { b: Newsbook; pages: BookWeek[]; photos: Record<string, PdfPhoto> }) {
  const name = b.student.name;
  const titles = pages.filter((w) => w.summary?.title);
  const st = b.stats;
  return (
    <Document title={`${name}의 영어 뉴스북`} author="새벽달 영어뉴스" language="ko">
      <Page size="A4" style={s.cover}>
        <Text style={{ fontSize: 12, color: C.deep, fontWeight: 700, marginBottom: 12 }}>
          {b.cohort.course_title} {b.cohort.cohort_no}기
        </Text>
        <Text style={s.h1}>{name}의</Text>
        <Text style={[s.h1, { marginBottom: 20 }]}>영어 뉴스북</Text>
        <Text style={s.meta}>
          {fmtDay(b.cohort.start_date)} – {fmtDay(b.cohort.deadline)} · 12주
        </Text>
        <Text style={[s.meta, { marginTop: 4 }]}>읽은 기사 {st.articles}편</Text>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>이번 기수의 기록</Text>
        {(
          [
            ["낭독", `${st.readings}회`],
            ["읽은 기사", `${st.articles}편`],
            ["쓴 요약", `${st.summaries}개`],
            ["낸 의견", `${st.opinions}개`],
            ["주간 목표 달성", `${b.cohort.weeks_total}주 중 ${st.weeks_met}주`],
          ] as const
        ).map(([k, v]) => (
          <View key={k} style={s.statRow}>
            <Text>{k}</Text>
            <Text style={{ fontWeight: 700 }}>{v}</Text>
          </View>
        ))}
      </Page>

      {pages.map((w) => (
        <ArticlePage
          key={w.week_no}
          w={w}
          reporter={name}
          photo={w.summary ? photos[w.summary.activity_id] : undefined}
          cards={w.cards.flatMap((c) => (photos[c.activity_id] ? [photos[c.activity_id]] : []))}
        />
      ))}

      {titles.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.h2}>{withGa(givenName(name))} 붙인 제목</Text>
          {titles.map((w) => (
            <View key={w.week_no} style={s.statRow}>
              <Text style={{ fontSize: 10, color: C.sub, width: 50 }}>{w.week_no}주차</Text>
              <Text style={{ flex: 1, fontWeight: 700 }}>{w.summary!.title}</Text>
            </View>
          ))}
        </Page>
      )}
    </Document>
  );
}

export function renderNewsbook(b: Newsbook, pages: BookWeek[], photos: Record<string, PdfPhoto>): Promise<Buffer> {
  return renderToBuffer(<NewsbookDoc b={b} pages={pages} photos={photos} />);
}
