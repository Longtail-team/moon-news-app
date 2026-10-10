// 활동 선택 (spec.md 4·6장, 목업 activity 화면)
// 활동·순서 자유, 반복 허용. 요일 추천은 안내일 뿐 체크리스트가 아니다.
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getPicker } from "@/lib/server/reading";
import { articleHref } from "@/lib/article/mode";
import { ACT, ActIcon, type ActType } from "@/components/student/icons";
import "../student.css";

const RECOMMEND: Record<number, ActType> = { 1: "KR_READING", 2: "VOCA", 3: "SUMMARY", 4: "DEBATE", 5: "EN_READING" };
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const DESC: Record<ActType, string> = {
  LISTENING: "음원을 끝까지 들으면 1회, 카드를 인스타에 올려요",
  KR_READING: "한글 해석을 소리 내어 읽고 녹음해요",
  EN_READING: "음원을 듣고 영어로 읽어 녹음해요",
  VOCA: "단어를 익히고 작성지 사진을 올려요",
  SUMMARY: "작성지 사진 1장을 올려요",
  DEBATE: "작성지 사진 1장을 올려요",
};
const ORDER: ActType[] = ["LISTENING", "KR_READING", "EN_READING", "VOCA", "SUMMARY", "DEBATE"];
const SLUG: Record<ActType, string> = { LISTENING: "", KR_READING: "kr", EN_READING: "en", VOCA: "voca", SUMMARY: "summary", DEBATE: "debate" };

function kstDow(): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { learner } = await pageLearner();
  const picker = await getPicker(learner.student_id);
  if (!picker || picker.weeks.length === 0) redirect("/");

  const target = picker.weekly_target;
  const current = picker.current_week ?? picker.weeks[0].week_no;
  // 고를 수 있는 주차: 이번 주 + 아직 다 채우지 못한 지난 주차
  const choices = picker.weeks.filter((w) => w.week_no === current || w.completed < target);
  const asked = Number((await searchParams).week);
  const sel = picker.weeks.find((w) => w.week_no === asked) ?? picker.weeks.find((w) => w.week_no === current) ?? picker.weeks[0];
  const dow = kstDow();
  const rec = RECOMMEND[dow];

  return (
    <div className="app">
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href="/">
            ‹ 홈
          </Link>
          <div className="meta">
            {sel.week_no}주차 학습 {sel.completed} / {target}
          </div>
        </div>
        <div className="pad stack" style={{ gap: 14 }}>
          <h1 className="h1">오늘은 무엇을 할까요?</h1>
          {choices.length > 1 && (
            <div className="chips">
              {choices.map((w) => (
                <Link key={w.week_no} className={`chip${w.week_no === sel.week_no ? " on" : ""}`} href={`/activity?week=${w.week_no}`} replace>
                  {w.week_no}주차 · {w.week_no === current ? "이번 주" : `${target - w.completed}회 남음`}
                </Link>
              ))}
            </div>
          )}
          {rec && (
            <div className="help">
              {DOW[dow]}요일 추천은 {ACT[rec].name}예요. 다른 활동을 골라도 괜찮아요.
            </div>
          )}
          <div className="stack" style={{ gap: 10 }}>
            {ORDER.map((k) => {
              const inProgress = sel.in_progress.includes(k);
              const n = sel.counts[k] ?? 0;
              return (
                <Link key={k} className="act" href={k === "LISTENING" ? articleHref(sel.week_no) : k.endsWith("READING") ? articleHref(sel.week_no, "read", k === "EN_READING" ? "en" : "kr") : `/write/${sel.week_no}/${SLUG[k]}`}>
                  <span className="ic">
                    <ActIcon type={k} />
                  </span>
                  <span className="stack" style={{ gap: 4, flex: 1 }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>
                      {ACT[k].name}
                      {k === rec && sel.week_no === current ? <span className="tag">오늘 추천</span> : null}
                    </span>
                    <span className="help" style={{ fontSize: 12 }}>
                      {DESC[k]}
                    </span>
                  </span>
                  <span className="meta" style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {inProgress ? "작성 중 · 이어서" : `${n}회`}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="help">같은 활동을 여러 번 해도 매번 1회로 인정돼요.</div>
        </div>
      </div>
    </div>
  );
}
