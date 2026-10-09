"use client";

// 상장 이름 확인 (spec 5장, 목업 cert): 미리보기와 이름 칸, "이 이름으로 상장 받기"를 눌러야 발급. 발급 뒤에도 고칠 수 있다
import Link from "next/link";
import { useState } from "react";
import { post } from "@/lib/client-api";
import type { Finish } from "@/lib/server/finish";

const ymd = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600e3);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

export function CertificateForm({ f }: { f: Finish }) {
  const q = f.is_current ? "" : `?e=${f.enrollment_id}`;
  const [name, setName] = useState(f.certificate_name ?? f.student.name);
  const [issued, setIssued] = useState<string | null>(f.certificate_name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function issue() {
    const v = name.trim();
    if (v.length < 2) return setErr("성과 이름을 모두 써 주세요.");
    setBusy(true);
    setErr(null);
    try {
      await post("/api/finish/certificate", { name: v, e: f.is_current ? null : f.enrollment_id });
      setIssued(v);
    } catch {
      setErr("상장을 만들지 못했어요. 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const changed = issued !== null && name.trim() !== issued;
  return (
    <div className="app">
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href={`/finish${q}`}>
            ‹ 완주
          </Link>
        </div>
        <div className="pad stack" style={{ gap: 18 }}>
          <h1 className="h1">
            상장에 들어갈 이름을
            <br />
            확인해 주세요
          </h1>
          <div className="stack" style={{ alignItems: "center", textAlign: "center", gap: 10, padding: "24px 20px", borderRadius: 16, background: "var(--white)", border: "2px solid var(--main)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 6, color: "var(--deep)" }}>완 주 상</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, minHeight: 40 }}>{name.trim() || " "}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {f.cohort.course_title} {f.cohort.cohort_no}기
            </div>
            <div className="meta">12주 과정</div>
            <div className="help">
              12주 동안 60번의 학습을
              <br />
              모두 마쳤기에 이 상장을 드립니다.
            </div>
            <div className="meta" style={{ fontSize: 13 }}>
              {f.completed_at ? ymd(f.completed_at) : ""} · 새벽달
            </div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }} htmlFor="cname">
              이름
            </label>
            <input
              id="cname"
              style={{ width: "100%", height: 52, borderRadius: 12, border: "1px solid var(--faint)", background: "var(--white)", padding: "0 14px", fontSize: 16, font: "inherit" }}
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="help" style={{ fontSize: 13 }}>
              한국어로 성과 이름을 모두 써 주세요. 받은 뒤에도 언제든 고칠 수 있어요.
            </div>
          </div>
          {issued && !changed && <div className="help" style={{ fontSize: 13, color: "var(--deep)", fontWeight: 700 }}>&apos;{issued}&apos; 이름으로 상장을 만들었어요.</div>}
          {err && <div className="err">{err}</div>}
        </div>
      </div>
      <div className="bottom stack" style={{ gap: 10 }}>
        {issued && !changed ? (
          <a className="cta" href={`/finish/certificate/pdf${q}`}>
            상장 PDF 받기
          </a>
        ) : (
          <button className="cta" disabled={busy} onClick={() => void issue()}>
            {busy ? "만드는 중…" : issued ? "이 이름으로 다시 받기" : "이 이름으로 상장 받기"}
          </button>
        )}
      </div>
    </div>
  );
}
