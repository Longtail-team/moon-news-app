// 학생 홈 (spec.md 7장, 목업 home 화면)
import Link from "next/link";
import type { HomeData } from "@/lib/server/home";
import type { Learner } from "@/lib/server/session";
import { fmtDay, fmtLive, fmtWeekRange, givenName } from "@/lib/format";
import { CheckIcon } from "./icons";
import { RecordCard } from "./RecordCard";
import { TabBar } from "./TabBar";
import { Toast } from "./Toast";

export function HomeView({
  home,
  learner,
  canSwitch,
  now,
  toast,
}: {
  home: HomeData;
  learner: Learner;
  canSwitch: boolean;
  now: number;
  toast?: string | null;
}) {
  const { cohort, progress, weeks, live } = home;
  const totalWeeks = weeks.length;
  // 기준 주차: 기수 시작 전 0, 종강 뒤 totalWeeks + 1
  const cw = progress.current_week ?? (now < Date.parse(weeks[0]?.starts_at ?? "") ? 0 : totalWeeks + 1);
  const week = weeks.find((w) => w.week_no === cw);
  const weeksLeft = cw >= 1 && cw <= totalWeeks ? totalWeeks - cw + 1 : cw === 0 ? totalWeeks : 0;
  const pct = Math.min(100, Math.round((progress.verified_count / cohort.total_target) * 100));
  const first = givenName(learner.name);
  const liveDays = live ? Math.ceil((Date.parse(live.starts_at) - now) / 864e5) : 0;
  const profileLabel = `${first}${learner.grade ? ` · ${learner.grade}` : ""}`;

  return (
    <div className="app">
      <div className="scroll">
        <div className="topbar">
          <div style={{ fontSize: 18, fontWeight: 800 }}>안녕, {first}!</div>
          {canSwitch ? (
            <Link className="chip" href="/profiles">
              {profileLabel} ▾
            </Link>
          ) : (
            <span className="meta" style={{ fontWeight: 700 }}>
              {profileLabel}
            </span>
          )}
        </div>

        {live && (
          <Link href="/materials" className="row" style={{ margin: "0 16px 12px", padding: "12px 14px", borderRadius: 14, background: "var(--tint)" }}>
            <span
              style={{
                width: 48,
                height: 48,
                flexShrink: 0,
                borderRadius: 12,
                background: "var(--white)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--deep)" }}>LIVE</span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{liveDays > 0 ? `D-${liveDays}` : "오늘"}</span>
            </span>
            <span className="stack" style={{ gap: 2, flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>새벽달 Zoom Live {live.session_no}회차</span>
              <span className="meta">{fmtLive(live.starts_at)}</span>
            </span>
            <span style={{ fontSize: 18, fontWeight: 800 }}>›</span>
          </Link>
        )}

        <div className="pad">
          <div className="card lift stack" style={{ padding: 20 }}>
            {week ? (
              <>
                <div className="between">
                  <span className="pill">{week.week_no}주차</span>
                  <span className="meta">{fmtWeekRange(week.starts_at, week.ends_at)}</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>{week.title ?? "이번 주 기사를 준비하고 있어요"}</div>
                <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{progress.this_week_completed}</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: "var(--sub)" }}>/ {cohort.weekly_target}</span>
                  <span style={{ fontSize: 14, color: "var(--sub)", marginLeft: 4 }}>이번 주 학습</span>
                </div>
                <div className="dots">
                  {Array.from({ length: cohort.weekly_target }, (_, i) => (
                    <div key={i} className={`dot${i < progress.this_week_completed ? " done" : ""}`}>
                      {i < progress.this_week_completed ? <CheckIcon /> : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <span className="pill" style={{ alignSelf: "flex-start" }}>
                  {cohort.course_title} {cohort.cohort_no}기
                </span>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  {cw === 0 ? `${fmtDay(cohort.start_date)}에 시작해요` : "12주 과정이 끝났어요"}
                </div>
              </>
            )}
          </div>
        </div>

        {cw >= 1 && (
          <div className="pad" style={{ paddingTop: 12 }}>
            <Link className="cta" href="/activity">
              + 오늘 학습하기
            </Link>
          </div>
        )}

        <div className="pad" style={{ paddingTop: 12 }}>
          <div className="card stack" style={{ gap: 10 }}>
            <div className="between">
              <div style={{ fontSize: 17, fontWeight: 800 }}>종강 {fmtDay(cohort.deadline)}</div>
              {weeksLeft > 0 && (
                <span className="pill" style={{ borderRadius: 10 }}>
                  {weeksLeft}주 남음
                </span>
              )}
            </div>
            <div className="between" style={{ alignItems: "baseline" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--sub)" }}>완주까지 인스타 올리기</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {progress.verified_count} <span style={{ fontWeight: 500, color: "var(--sub)" }}>/ {cohort.total_target}</span>
              </div>
            </div>
            <div className="bar">
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="pad" style={{ paddingTop: 12 }}>
          <RecordCard
            weeks={weeks.map((w) => ({ week_no: w.week_no, acts: w.acts }))}
            currentWeek={cw}
            weeklyTarget={cohort.weekly_target}
            totalTarget={cohort.total_target}
            totalCompleted={progress.total_completed}
            readingWords={progress.reading_words}
          />
        </div>
      </div>
      <TabBar active="home" uploadCount={progress.pending_post_count} />
      {toast && <Toast message={toast} />}
    </div>
  );
}
