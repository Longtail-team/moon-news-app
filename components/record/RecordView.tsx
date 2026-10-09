"use client";

// 내 기록 탭 (2026-10-09): 학습자별. 이번 기수 뉴스북(진도 중간 열람, 종강 다음 날부터 PDF), 기록 숫자, 지난 기수, 설정
import Link from "next/link";
import { useState } from "react";
import type { Newsbook } from "@/lib/server/newsbook";
import { post } from "@/lib/client-api";
import { fmtDay, givenName } from "@/lib/format";
import { TabBar } from "@/components/student/TabBar";

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
  const stats: [string, string][] = [
    ["낭독", `${st.readings}회`],
    ["읽은 기사", `${st.articles}편`],
    ["쓴 요약", `${st.summaries}개`],
    ["낸 의견", `${st.opinions}개`],
    ["주간 목표 달성", `${b.cohort.weeks_total}주 중 ${st.weeks_met}주`],
  ];

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

          <div className="card stack" style={{ gap: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, paddingBottom: 6 }}>{b.is_current ? "이번 기수 기록" : "이 기수 기록"}</div>
            {stats.map(([k, v]) => (
              <div key={k} className="between" style={{ fontSize: 14, padding: "10px 0", borderTop: "1px solid var(--mute)" }}>
                <span className="meta">{k}</span>
                <b>{v}</b>
              </div>
            ))}
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
