// 완주 상장 PDF (spec 5장): 이름(확인 화면에서 고친 이름), 과정·기수, 기간, 완주일, 발급 기관 "새벽달"(임시)
// 제때·유예·늦은 완주의 디자인 차이는 미정(spec 18장)이라 한 가지 양식
import "server-only";
import path from "node:path";
import { Circle, Document, Font, Page, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";

const FONT_DIR = path.join(process.cwd(), "lib", "pdf", "fonts");
Font.register({
  family: "Pretendard",
  fonts: [
    { src: path.join(FONT_DIR, "Pretendard-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Pretendard-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const C = { main: "#76D4CC", deep: "#1F7F77", ink: "#2D2D2D", sub: "#5A5A5A" };
const ISSUER = "새벽달";

const s = StyleSheet.create({
  page: { fontFamily: "Pretendard", color: C.ink, padding: 28 },
  outer: { flex: 1, borderWidth: 3, borderColor: C.main, borderRadius: 18, padding: 10 },
  inner: { flex: 1, borderWidth: 0.8, borderColor: C.deep, borderRadius: 12, alignItems: "center", paddingTop: 70, paddingHorizontal: 60, paddingBottom: 56 },
});

export type CertInput = { name: string; courseTitle: string; cohortNo: number; startDate: string; deadline: string; completedAt: string };

const ymd = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600e3); // 한국 날짜
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};
const ymdDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
};

function CertificateDoc({ c }: { c: CertInput }) {
  return (
    <Document title={`${c.name} 완주 상장`} author={ISSUER} language="ko">
      <Page size="A4" style={s.page}>
        <View style={s.outer}>
          <View style={s.inner}>
            {/* 새벽달: 초승달 */}
            <Svg width={46} height={46} viewBox="0 0 46 46">
              <Circle cx="23" cy="23" r="20" fill={C.main} />
              <Circle cx="31" cy="17" r="17" fill="#FFFFFF" />
            </Svg>
            <Text style={{ fontSize: 12, fontWeight: 700, color: C.deep, letterSpacing: 4, marginTop: 14 }}>
              {c.courseTitle} {c.cohortNo}기
            </Text>
            <Text style={{ fontSize: 46, fontWeight: 700, letterSpacing: 22, marginTop: 34, marginLeft: 22 }}>완주상</Text>
            <View style={{ width: 60, height: 2, backgroundColor: C.main, marginTop: 28 }} />
            <Text style={{ fontSize: 40, fontWeight: 700, letterSpacing: 6, marginTop: 52 }}>{c.name}</Text>
            <Text style={{ fontSize: 13, color: C.sub, marginTop: 14 }}>
              {ymdDate(c.startDate)} – {ymdDate(c.deadline)} · 12주 과정
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.9, textAlign: "center", marginTop: 54 }}>
              {"12주 동안 영어 뉴스를 읽고 소리 내어 낭독하며\n60번의 학습을 모두 마쳤기에\n이 상장을 드립니다."}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 14, color: C.sub }}>{ymd(c.completedAt)}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16 }}>
              <Text style={{ fontSize: 22, fontWeight: 700, letterSpacing: 6 }}>{ISSUER}</Text>
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  borderWidth: 2,
                  borderColor: C.deep,
                  marginLeft: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: "rotate(-10deg)",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: 700, color: C.deep }}>{ISSUER}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function renderCertificate(c: CertInput): Promise<Buffer> {
  return renderToBuffer(<CertificateDoc c={c} />);
}
