"use client";

// 내 기록 탭 (2026-10-09): 학습자별. 이번 기수 뉴스북(진도 중간 열람, 종강 다음 날부터 PDF), 기록 숫자, 지난 기수, 설정
import Link from "next/link";
import { useState } from "react";
import type { Newsbook } from "@/lib/server/newsbook";
import { post } from "@/lib/client-api";
import { fmtDay, givenName } from "@/lib/format";
import { TabBar } from "@/components/student/TabBar";
import { fmtListen } from "@/lib/listening";
import { ACT_ORDER, ActIcon, type ActType } from "@/components/student/icons";

// 활동 칸 이름(좁은 칸이라 두 줄)
const TILE: Record<ActType, [string, string]> = {
  LISTENING: ["청독", ""],
  KR_READING: ["한국어", "기사 읽기"],
  EN_READING: ["영어", "기사 읽기"],
  VOCA: ["VOCA", ""],
  SUMMARY: ["기사", "요약"],
  DEBATE: ["찬반", "토론"],
};

export function RecordView({ b, profileLabel, canSwitch, isGuardian }: { b: Newsbook; profileLabel: string; canSwitch: boolean; isGuardian: boolean }) {
  const first = givenName(b.student.name);
  const filled = b.weeks.filter((w) => w.summary || w.opinion).length;
  const [ai, setAi] = useState(b.student.ai_consent);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggleAi(on: boolean) {
    setSaving(true);
    setMsg(null);
    try {
      await post("/api/settings/ai-consent", { on });
      setAi(on);
      setMsg(on ? "사진 글자 읽기를 쓸 수 있어요." : "사진 글자 읽기를 쓰지 않아요. 요약은 직접 입력할 수 있어요.");
    } catch {
      setMsg("바꾸지 못했어요. 다시 눌러 주세요.");
    } finally {
      setSaving(false);
    }
  }

  const st = b.stats;
  const target = b.cohort.total_target;
  const pct = Math.min(100, Math.round((st.verified / target) * 100));

  return (
    <div className="app">
      <div className="scroll">
        <div className="topbar">
          <div style={{ fontSize: 18, fontWeight: 800 }}>내 기록</div>
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
        <div className="pad stack" style={{ gap: 12 }}>
          {st.verified >= target && (
            <Link href={`/finish${b.is_current ? "" : `?e=${b.enrollment_id}`}`} className="card lift row" style={{ background: "var(--tint)", border: 0, padding: 18 }}>
              <span className="stack" style={{ gap: 2, flex: 1 }}>
                <b style={{ fontSize: 17 }}>12주 완주!</b>
                <span className="meta">완주 화면에서 첫·마지막 낭독과 상장을 확인해요</span>
              </span>
              <span style={{ fontSize: 18, fontWeight: 800 }}>›</span>
            </Link>
          )}
          {/* 이번 기수 기록: 완주 화면과 같은 모양(진행 중 버전). 첫·마지막 낭독 비교와 상장은 완주 뒤 완주 화면에서 */}
          <div className="card lift stack" style={{ gap: 14 }}>
            <span className="meta" style={{ fontWeight: 700 }}>
              {b.cohort.course_title} {b.cohort.cohort_no}기 · {b.is_current ? "이번 기수 기록" : "기수 기록"}
            </span>
            <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}>{st.verified}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--sub)" }}>/ {target}</span>
              <span style={{ fontSize: 14, color: "var(--sub)", marginLeft: 4 }}>인스타 올리기</span>
            </div>
            <div className="bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <span className="meta">
              학습 완료 {st.completed}회 · 주간 목표 {b.cohort.weeks_total}주 중 {st.weeks_met}주 달성
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {ACT_ORDER.map((k) => (
                <div key={k} className="stack" style={{ gap: 4, alignItems: "center", padding: "10px 2px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--deep)" }}>
                    <ActIcon type={k} size={20} />
                  </span>
                  <b style={{ fontSize: 17 }}>{st.acts[k] ?? 0}</b>
                  <span style={{ fontSize: 13, color: "var(--sub)", textAlign: "center", lineHeight: 1.3, minHeight: 34 }}>
                    {TILE[k][0]}
                    {TILE[k][1] && <br />}
                    {TILE[k][1]}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.8, padding: "12px 14px", borderRadius: 12, background: "var(--bg)" }}>
              지금까지 소리 내어 읽은 영어 단어 <b style={{ color: "var(--deep)" }}>{st.reading_words.toLocaleString()}</b>개
              <br />
              지금까지 청독한 시간 <b style={{ color: "var(--deep)" }}>{fmtListen(st.listening_seconds)}</b>
            </div>
          </div>

          <div className="card lift stack" style={{ gap: 10, background: "var(--tint)", border: 0 }}>
            <span className="meta" style={{ fontWeight: 700, color: "var(--deep)" }}>
              {b.cohort.course_title} {b.cohort.cohort_no}기
            </span>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{first}의 영어 뉴스북</div>
            <div className="meta">
              기사 {filled} / {b.cohort.weeks_total} 실림 · 기사 요약이나 찬반토론을 하면 한 쪽씩 채워져요
            </div>
            <Link className="cta" href={`/record/book${b.is_current ? "" : `?e=${b.enrollment_id}`}`}>
              뉴스북 보기
            </Link>
            <div className="help" style={{ fontSize: 13, textAlign: "center" }}>
              {b.can_download ? "뉴스북 보기에서 PDF로 받을 수 있어요" : `PDF는 ${fmtDay(b.download_from)}부터 받을 수 있어요`}
            </div>
          </div>

          {b.others.length > 0 && (
            <div className="card stack" style={{ gap: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, paddingBottom: 6 }}>{b.is_current ? "지난 기수" : "다른 기수"}</div>
              {b.others.map((o) => (
                <Link key={o.enrollment_id} href={`/record?e=${o.enrollment_id}`} className="between" style={{ fontSize: 14, padding: "12px 0", borderTop: "1px solid var(--mute)", minHeight: 44 }}>
                  <span>
                    {o.course_title} {o.cohort_no}기 <span className="meta">· 종강 {fmtDay(o.deadline)}</span>
                  </span>
                  <span style={{ fontWeight: 800 }}>›</span>
                </Link>
              ))}
            </div>
          )}

          {b.is_current && (
            <div className="card stack" style={{ gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>설정</div>
              <div className="between" style={{ gap: 12 }}>
                <span style={{ fontSize: 14 }}>사진 글자 읽기 (외부 AI)</span>
                {isGuardian ? (
                  <button className={`chip${ai ? " on" : ""}`} disabled={saving} aria-pressed={ai} onClick={() => void toggleAi(!ai)}>
                    {ai ? "동의함" : "동의 안 함"}
                  </button>
                ) : (
                  <span className="meta" style={{ fontWeight: 700 }}>
                    {ai ? "동의함" : "동의 안 함"}
                  </span>
                )}
              </div>
              <div className="help" style={{ fontSize: 13 }}>
                {isGuardian
                  ? "작성지 사진의 손글씨를 글자로 읽기 위해 사진을 외부 AI 서비스(Anthropic)로 보내요. 누를 때마다 바뀌어요."
                  : "보호자가 보호자 링크로 들어와 바꿀 수 있어요."}
              </div>
              {msg && <div className="help" style={{ fontSize: 13 }}>{msg}</div>}
            </div>
          )}
        </div>
      </div>
      <TabBar active="record" uploadCount={b.pending_post_count} />
    </div>
  );
}
