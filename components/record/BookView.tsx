// 뉴스북 보기 (화면): PDF와 같은 구성. 진도 중간에도 열람, PDF 받기는 종강 다음 날부터.
// 기록이 없는 주차는 "아직 비어 있어요"로 보여 주어 이번 주에 채우도록 한다(PDF에서는 뺀다).
import Link from "next/link";
import type { BookWeek, Newsbook } from "@/lib/server/newsbook";
import { fmtDay, fmtMonthDay, givenName } from "@/lib/format";
import { withGa } from "@/lib/korean";

function WeekCard({ w, reporter }: { w: BookWeek; reporter: string }) {
  const t = w.tally;
  const total = t ? t.agree + t.disagree : 0;
  const pct = t && total ? Math.round((t.agree / total) * 100) : 0;
  const empty = !w.summary && !w.opinion;
  return (
    <div className="card stack" style={{ gap: 10, ...(empty ? { background: "var(--bg)", borderStyle: "dashed" } : {}) }}>
      <span className="meta">
        {w.week_no}주차 · {fmtMonthDay(w.starts_at)} 주
      </span>
      <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.4 }}>{w.title_en ?? `${w.week_no}주차 기사`}</div>
      {empty && <div className="help" style={{ fontSize: 13 }}>아직 비어 있어요. 기사 요약이나 찬반토론을 하면 이 쪽이 채워져요.</div>}
      {w.summary && (
        <div className="stack" style={{ gap: 6, padding: 12, borderRadius: 12, background: "var(--tint)" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--deep)" }}>뉴스 카드</span>
          {w.summary.title && <div style={{ fontSize: 17, fontWeight: 800 }}>{w.summary.title}</div>}
          {w.summary.body && <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{w.summary.body}</div>}
          <div className="between" style={{ alignItems: "flex-end" }}>
            <span className="meta">기자 {reporter}</span>
            {w.summary.has_photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/media/${w.summary.activity_id}`} alt="손글씨 작성지" style={{ width: 56, height: 72, objectFit: "cover", borderRadius: 8, background: "var(--white)" }} />
            )}
          </div>
        </div>
      )}
      {w.opinion && (
        <div className="stack" style={{ gap: 4, padding: 12, borderRadius: 12, border: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--deep)" }}>의견 카드</span>
          <b style={{ fontSize: 15 }}>내 입장: {w.opinion.stance === "agree" ? "찬성" : "반대"}</b>
          {w.opinion.reason && <span style={{ fontSize: 14 }}>{w.opinion.reason}</span>}
        </div>
      )}
      {t && total > 0 && (
        <div className="stack" style={{ gap: 4 }}>
          <div className="between" style={{ fontSize: 13, fontWeight: 800 }}>
            <span>찬성 {pct}%</span>
            <span>반대 {100 - pct}%</span>
          </div>
          <div className="bar">
            <i style={{ width: `${pct}%` }} />
          </div>
          <span className="meta">
            {t.final ? "최종 결과" : "지금까지"} {total}명
          </span>
        </div>
      )}
    </div>
  );
}

export function BookView({ b }: { b: Newsbook }) {
  const name = b.student.name;
  const titles = b.weeks.filter((w) => w.summary?.title);
  const q = b.is_current ? "" : `?e=${b.enrollment_id}`;
  return (
    <div className="app">
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href={`/record${q}`}>
            ‹ 내 기록
          </Link>
        </div>
        <div className="pad stack" style={{ gap: 12 }}>
          <div className="card lift stack" style={{ gap: 6, background: "var(--tint)", border: 0, padding: 24 }}>
            <span className="meta" style={{ fontWeight: 700, color: "var(--deep)" }}>
              {b.cohort.course_title} {b.cohort.cohort_no}기
            </span>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.3 }}>
              {name}의
              <br />
              영어 뉴스북
            </div>
            <span className="meta">
              {fmtDay(b.cohort.start_date)} – {fmtDay(b.cohort.deadline)} · 읽은 기사 {b.stats.articles}편
            </span>
          </div>

          {b.weeks.map((w) => (
            <WeekCard key={w.week_no} w={w} reporter={name} />
          ))}

          {titles.length > 0 && (
            <div className="card stack" style={{ gap: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, paddingBottom: 6 }}>{withGa(givenName(name))} 붙인 제목</div>
              {titles.map((w) => (
                <div key={w.week_no} className="row" style={{ gap: 12, fontSize: 14, padding: "10px 0", borderTop: "1px solid var(--mute)" }}>
                  <span className="meta" style={{ width: 44, flexShrink: 0 }}>
                    {w.week_no}주차
                  </span>
                  <b>{w.summary!.title}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="bottom stack" style={{ gap: 6 }}>
        {b.can_download ? (
          <a className="cta" href={`/record/book/pdf${q}`}>
            PDF로 받기
          </a>
        ) : (
          <button className="cta" disabled>
            PDF는 {fmtDay(b.download_from)}부터 받을 수 있어요
          </button>
        )}
      </div>
    </div>
  );
}
