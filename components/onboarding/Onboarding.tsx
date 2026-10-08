"use client";

// 첫 접속 3단계 (spec.md 11장, 목업 welcome·student·access)
// 이 화면은 홈 주소(/?k=<링크>)에서 보인다. 그래서 1단계에서 홈 화면에 추가하면 아이콘이 링크를 품는다.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Onboarding as State } from "@/lib/server/onboarding";
import { post } from "@/lib/client-api";
import { maskPhone } from "@/lib/phone";
import { fmtDay, givenName } from "@/lib/format";
import { GRADES, gradeLabel, withGa, withRo } from "@/lib/korean";

const YEARS = Array.from({ length: 13 }, (_, i) => 2008 + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function Progress({ n, label }: { n: number; label: string }) {
  return (
    <div className="stack" style={{ padding: "20px 20px 0", gap: 6 }}>
      <div className="row" style={{ gap: 6 }}>
        {[1, 2, 3].map((i) => (
          <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= n ? "var(--main)" : "var(--line)" }} />
        ))}
      </div>
      <div className="meta" style={{ fontSize: 12, fontWeight: 700 }}>
        {n} / 3 · {label}
      </div>
    </div>
  );
}

const kv = (k: string, v: string) => (
  <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--mute)", fontSize: 14 }}>
    <span style={{ color: "var(--sub)" }}>{k}</span>
    <span style={{ fontWeight: 700, textAlign: "right" }}>{v}</span>
  </div>
);
const item = (t: string) => (
  <div key={t} style={{ padding: "8px 0", borderBottom: "1px solid var(--mute)", fontSize: 14, fontWeight: 700 }}>
    {t}
  </div>
);
const input: React.CSSProperties = { width: "100%", height: 52, borderRadius: 12, border: "1px solid var(--faint)", background: "var(--white)", padding: "0 14px", fontSize: 16, font: "inherit" };

// ───────── 1 환영 ─────────
function Welcome({ s, onDone }: { s: State; onDone: () => void }) {
  const o = s.orders[0];
  const [name, setName] = useState(s.guardian.name ?? "");
  const [agree, setAgree] = useState(true);
  const [os, setOs] = useState<"ios" | "and">(typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent) ? "and" : "ios");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function next() {
    if (!name.trim()) return setErr("보호자 이름을 입력해 주세요.");
    if (!agree) return setErr("학습 안내 알림톡 받기에 동의해 주세요.");
    setBusy(true);
    try {
      await post("/api/onboarding/welcome", { name, agree });
      onDone();
    } catch {
      setErr("저장하지 못했어요. 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  const ios = os === "ios";
  return (
    <div className="scroll">
      <Progress n={1} label="정보 확인" />
      <div className="pad stack" style={{ paddingTop: 22, gap: 20 }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="pill" style={{ alignSelf: "flex-start" }}>
            {o.course_title} {o.cohort_no}기
          </span>
          <h1 className="h1" style={{ fontSize: 26 }}>
            12주 챌린지에
            <br />
            오신 걸 환영해요
          </h1>
          <div className="help">신청 정보를 확인하고 보호자 정보를 입력해 주세요.</div>
        </div>
        <div className="card lift">
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>신청 정보</div>
          {kv("과정", `${o.course_title} ${o.cohort_no}기`)}
          {kv("기간", "12주")}
          {kv("시작", fmtDay(o.start_date))}
          {o.quantity > 1 && kv("학습자", `${o.quantity}명`)}
          {kv("신청 연락처", maskPhone(s.guardian.phone))}
          <div className="help" style={{ fontSize: 13, marginTop: 8 }}>
            정보가 다르면 운영팀에 문의해 주세요.
          </div>
        </div>
        <div className="card lift">
          <div style={{ fontSize: 14, fontWeight: 800 }}>제공 자료</div>
          <div className="meta" style={{ color: "var(--deep)", fontSize: 12, fontWeight: 800, marginTop: 10 }}>
            PDF 2종
          </div>
          {item("기사 PDF (원문 · 요약 작성지 · 토론 질문지)")}
          {item("VOCA 정리 PDF")}
          <div className="meta" style={{ color: "var(--deep)", fontSize: 12, fontWeight: 800, marginTop: 10 }}>
            음원 3종
          </div>
          {item("영어 기사 음원")}
          {item("새벽달 한영 구간반복")}
          {item("VOCA 구간반복")}
          {s.liveCount > 0 && (
            <>
              <div className="meta" style={{ color: "var(--deep)", fontSize: 12, fontWeight: 800, marginTop: 10 }}>
                라이브
              </div>
              {item(`새벽달 Zoom Live ${s.liveCount}회`)}
            </>
          )}
          <div className="help" style={{ marginTop: 10 }}>
            매주 월요일에 새 자료가 열려요.
          </div>
        </div>
        <div className="stack" style={{ gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>보호자 정보</div>
          <div className="stack" style={{ gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }} htmlFor="gname">
              보호자 이름
            </label>
            <input id="gname" style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 입력" autoComplete="name" />
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>알림 받을 연락처</label>
            <input style={{ ...input, background: "var(--mute)" }} value={maskPhone(s.guardian.phone)} readOnly />
            <div className="help">신청한 번호로 알림톡을 보내드려요.</div>
          </div>
          <label className="row" style={{ minHeight: 44, fontSize: 14, gap: 10 }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--deep)" }} />
            학습 안내 알림톡 받기 (필수)
          </label>
        </div>
        <div className="stack" style={{ padding: 18, borderRadius: 16, background: "var(--tint)" }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>홈 화면에 추가해 두세요</div>
          <div className="help" style={{ color: "var(--ink)" }}>
            지금 이 화면에서 추가하면 다음부터 알림톡을 찾지 않아도 아이콘으로 바로 열려요.
          </div>
          <div className="row" style={{ gap: 6, padding: 4, borderRadius: 12, background: "var(--white)" }}>
            {(["ios", "and"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setOs(k)}
                style={{ flex: 1, height: 40, borderRadius: 9, border: 0, font: "inherit", fontSize: 14, fontWeight: 700, background: os === k ? "var(--main)" : "var(--white)", color: "var(--ink)", cursor: "pointer" }}
              >
                {k === "ios" ? "아이폰" : "안드로이드"}
              </button>
            ))}
          </div>
          <div className="stack" style={{ gap: 8, fontSize: 14, lineHeight: 1.5 }}>
            {ios ? (
              <>
                <div>1. Safari에서 이 페이지를 열어요</div>
                <div>2. 아래쪽 공유 버튼을 눌러요</div>
                <div>3. &apos;홈 화면에 추가&apos;를 눌러요</div>
              </>
            ) : (
              <>
                <div>1. Chrome에서 이 페이지를 열어요</div>
                <div>2. 오른쪽 위 메뉴(점 3개)를 눌러요</div>
                <div>3. &apos;홈 화면에 추가&apos;를 눌러요</div>
              </>
            )}
          </div>
          <div className="help">카카오톡 안에서 열렸다면 오른쪽 위 메뉴에서 &apos;다른 브라우저로 열기&apos;를 먼저 눌러 주세요.</div>
        </div>
        {err && <div className="err">{err}</div>}
        <button className="cta" disabled={busy} onClick={() => void next()}>
          다음 · 학습자 등록
        </button>
      </div>
    </div>
  );
}

// ───────── 2 학습자 등록 ─────────
type Form = { existing?: string; name: string; year: number; month: number; grade: string | null; gradeEdit: boolean; instagram: string };

function Learners({ s, onDone }: { s: State; onDone: () => void }) {
  const order = s.orders.find((o) => o.registered < o.quantity)!;
  const seats = order.quantity - order.registered;
  const [forms, setForms] = useState<Form[]>(() =>
    Array.from({ length: seats }, () => ({ name: "", year: 2015, month: 3, grade: null, gradeEdit: false, instagram: "" })),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const used = new Set(forms.map((f) => f.existing).filter(Boolean));
  const set = (i: number, patch: Partial<Form>) => setForms((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  async function next() {
    for (const f of forms) if (!f.existing && !f.name.trim()) return setErr("학습자 이름을 입력해 주세요.");
    setBusy(true);
    setErr(null);
    try {
      await post("/api/onboarding/learners", {
        orderId: order.order_id,
        learners: forms.map((f) =>
          f.existing
            ? { existing: f.existing, instagram: f.instagram }
            : { name: f.name, birth: `${f.year}-${String(f.month).padStart(2, "0")}`, grade: f.gradeEdit ? f.grade : null, instagram: f.instagram },
        ),
      });
      onDone();
    } catch {
      setErr("등록하지 못했어요. 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  return (
    <div className="scroll">
      <Progress n={2} label="학습자 등록" />
      <div className="pad stack" style={{ paddingTop: 22, gap: 22 }}>
        <h1 className="h1">
          함께할 학습자를
          <br />
          알려주세요
        </h1>
        {forms.map((f, i) => {
          const auto = gradeLabel(f.year);
          const returning = s.returning.filter((r) => !used.has(r.student_id) || r.student_id === f.existing);
          return (
            <div key={i} className={seats > 1 ? "card stack" : "stack"} style={{ gap: 18 }}>
              {seats > 1 && <div style={{ fontSize: 15, fontWeight: 800 }}>학습자 {i + 1}</div>}
              {returning.length > 0 && (
                <div className="stack" style={{ gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>지난 기수에 함께한 학습자</div>
                  <div className="chips">
                    {returning.map((r) => (
                      <button
                        key={r.student_id}
                        className={`chip${f.existing === r.student_id ? " on" : ""}`}
                        onClick={() => set(i, { existing: f.existing === r.student_id ? undefined : r.student_id, instagram: r.instagram_id ?? "" })}
                      >
                        {r.name} 이어서 하기
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!f.existing && (
                <>
                  <div className="stack" style={{ gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 700 }} htmlFor={`sn${i}`}>
                      학습자 이름
                    </label>
                    <input id={`sn${i}`} style={input} value={f.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="성과 이름 모두 (예: 김지우)" />
                    <div className="help">완주 상장에 이 이름이 그대로 들어가요. 성과 이름을 모두 써 주세요.</div>
                  </div>
                  <div className="stack" style={{ gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>출생 연월</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <select style={input} aria-label="출생 연도" value={f.year} onChange={(e) => set(i, { year: Number(e.target.value) })}>
                        {YEARS.map((y) => (
                          <option key={y} value={y}>
                            {y}년
                          </option>
                        ))}
                      </select>
                      <select style={input} aria-label="출생 월" value={f.month} onChange={(e) => set(i, { month: Number(e.target.value) })}>
                        {MONTHS.map((m) => (
                          <option key={m} value={m}>
                            {m}월
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="between" style={{ padding: "4px 4px 4px 12px", borderRadius: 12, background: "var(--tint)", fontSize: 13 }}>
                      {f.gradeEdit ? (
                        <select
                          value={f.grade ?? auto ?? "초5"}
                          onChange={(e) => set(i, { grade: e.target.value })}
                          style={{ height: 40, borderRadius: 10, border: "1px solid var(--line2)", font: "inherit", fontSize: 13 }}
                        >
                          {GRADES.map((g) => (
                            <option key={g}>{g}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{auto ? <>올해 <b>{withRo(auto)}</b> 표시돼요</> : "학년을 직접 골라 주세요"}</span>
                      )}
                      <button
                        onClick={() => set(i, { gradeEdit: !f.gradeEdit, grade: f.grade ?? auto })}
                        style={{ minHeight: 40, padding: "0 12px", borderRadius: 10, border: 0, background: "var(--white)", font: "inherit", fontSize: 12, fontWeight: 700, color: "var(--ink)", cursor: "pointer" }}
                      >
                        {f.gradeEdit ? "자동으로" : "학년이 다르면 바꾸기"}
                      </button>
                    </div>
                    <div className="help">학년 표시와 보호자 동의 확인에만 써요. 생일은 받지 않아요.</div>
                  </div>
                </>
              )}
              <div className="stack" style={{ gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700 }} htmlFor={`ig${i}`}>
                  인증할 인스타그램 계정
                </label>
                <div className="row" style={{ gap: 4, height: 52, borderRadius: 12, border: "1px solid var(--faint)", background: "var(--white)", padding: "0 14px" }}>
                  <span style={{ color: "var(--sub)" }}>@</span>
                  <input
                    id={`ig${i}`}
                    value={f.instagram}
                    onChange={(e) => set(i, { instagram: e.target.value })}
                    placeholder="계정 아이디"
                    autoCapitalize="off"
                    style={{ flex: 1, minWidth: 0, height: 48, border: 0, fontSize: 16, background: "transparent", font: "inherit" }}
                  />
                </div>
                <div className="help">낭독 영상과 작성지를 올릴 계정이에요. 보호자 계정도 괜찮아요.</div>
              </div>
            </div>
          );
        })}
        {err && <div className="err">{err}</div>}
        <button className="cta" disabled={busy} onClick={() => void next()}>
          다음
        </button>
      </div>
    </div>
  );
}

// ───────── 3 접속 방법과 동의 ─────────
function Access({ s, onDone, onDevLinks }: { s: State; onDone: () => void; onDevLinks: (l: { name: string; link: string }[]) => void }) {
  const [own, setOwn] = useState<Record<string, boolean>>({});
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    if (!consent) return setErr("음성·이미지 수집에 동의해야 시작할 수 있어요.");
    for (const p of s.pending) if (own[p.student_id] && !(phones[p.student_id] ?? "").replace(/\D/g, "")) return setErr(`${givenName(p.name)} 연락처를 입력해 주세요.`);
    setBusy(true);
    setErr(null);
    try {
      const r = await post<{ devLinks: { studentId: string; link: string }[] }>("/api/onboarding/access", {
        consent: true,
        items: s.pending.map((p) => ({ studentId: p.student_id, ownPhone: own[p.student_id] ? phones[p.student_id] : null })),
      });
      if (r.devLinks.length) onDevLinks(r.devLinks.map((d) => ({ name: s.pending.find((p) => p.student_id === d.studentId)?.name ?? "", link: d.link })));
      else onDone();
    } catch (e) {
      setErr((e as { code?: string }).code === "bad_phone" ? "휴대폰 번호를 다시 확인해 주세요." : "저장하지 못했어요. 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  const opt = (sid: string, yes: boolean, title: string, desc: string) => {
    const on = (own[sid] ?? false) === yes;
    return (
      <button
        onClick={() => setOwn((o) => ({ ...o, [sid]: yes }))}
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          width: "100%",
          padding: 16,
          borderRadius: 14,
          textAlign: "left",
          border: on ? "2px solid var(--deep)" : "1px solid var(--line2)",
          background: on ? "var(--tint)" : "var(--white)",
          font: "inherit",
          color: "var(--ink)",
          cursor: "pointer",
        }}
      >
        <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", marginTop: 1, border: on ? "7px solid var(--deep)" : "2px solid var(--faint)", background: "var(--white)" }} />
        <span className="stack" style={{ gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
          <span className="help" style={{ fontSize: 12 }}>
            {desc}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="scroll">
      <Progress n={3} label="접속 방법과 동의" />
      <div className="pad stack" style={{ paddingTop: 22, gap: 24 }}>
        {s.pending.map((p) => {
          const n = givenName(p.name);
          return (
            <div key={p.student_id} className="stack" style={{ gap: 12 }}>
              <h1 className="h1" style={{ fontSize: s.pending.length > 1 ? 20 : 24 }}>
                {withGa(n)} 본인 휴대폰으로
                <br />
                직접 진행하나요?
              </h1>
              {opt(p.student_id, true, `네, ${n} 휴대폰으로 해요`, `${n}에게 별도 접속 링크를 보내요. 보호자도 같은 기록을 볼 수 있어요.`)}
              {opt(p.student_id, false, "아니요, 보호자 휴대폰으로 해요", "지금 이 휴대폰에서 함께 진행해요.")}
              {own[p.student_id] && (
                <div className="stack reveal" style={{ gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700 }} htmlFor={`cp-${p.student_id}`}>
                    {n} 연락처
                  </label>
                  <input
                    id={`cp-${p.student_id}`}
                    style={input}
                    type="tel"
                    inputMode="tel"
                    placeholder="010-0000-0000"
                    value={phones[p.student_id] ?? ""}
                    onChange={(e) => setPhones((x) => ({ ...x, [p.student_id]: e.target.value }))}
                  />
                  <div className="help">이 번호로 {n} 전용 접속 링크를 보내드려요. 알림톡은 보호자와 {n} 모두에게 가요.</div>
                </div>
              )}
            </div>
          );
        })}
        <div className="card lift">
          <label className="row" style={{ alignItems: "flex-start", gap: 10, fontSize: 14, lineHeight: 1.5 }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, accentColor: "var(--deep)", flexShrink: 0 }} />
            자녀의 낭독 음성과 작성 이미지 수집·보관에 동의합니다 (필수, 만 14세 미만 보호자 동의)
          </label>
          <button className="textbtn" style={{ fontSize: 13, color: "var(--sub)" }} onClick={() => setShowPolicy(!showPolicy)}>
            보관 기간과 삭제 기준 보기
          </button>
          {showPolicy && <div className="help">녹음과 작성지 사진은 종강 후 3개월이 지나면 모두 지워요. 학습 기록(횟수·날짜)은 남아요.</div>}
        </div>
        {err && <div className="err">{err}</div>}
        <button className="cta" disabled={busy} onClick={() => void start()}>
          챌린지 시작하기
        </button>
      </div>
    </div>
  );
}

export function Onboarding({ state }: { state: State }) {
  const router = useRouter();
  const [devLinks, setDevLinks] = useState<{ name: string; link: string }[] | null>(null);
  // 다음 단계는 서버가 정한다. 주소(?k=)는 그대로 두고 화면만 다시 받는다.
  const refresh = () => router.refresh();

  if (devLinks)
    return (
      <div className="app">
        <div className="scroll">
          <div className="pad stack" style={{ paddingTop: 48, gap: 16 }}>
            <h1 className="h1">자녀 링크를 보냈어요</h1>
            <div className="card stack" style={{ gap: 8, background: "var(--tint)", border: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>시험용 (미리보기에서만 보여요)</div>
              {devLinks.map((d) => (
                <div key={d.link} className="stack" style={{ gap: 2 }}>
                  <b style={{ fontSize: 14 }}>{d.name}</b>
                  <span style={{ fontSize: 12, wordBreak: "break-all" }}>{d.link}</span>
                </div>
              ))}
            </div>
            <button className="cta" onClick={refresh}>
              홈으로
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="app">
      {state.step === "welcome" && <Welcome s={state} onDone={refresh} />}
      {state.step === "learners" && <Learners s={state} onDone={refresh} />}
      {state.step === "access" && <Access s={state} onDone={refresh} onDevLinks={setDevLinks} />}
    </div>
  );
}
