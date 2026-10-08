"use client";

// 다시 들어가기 (목업 reentry): 등록한 번호로 새 접속 링크를 받는다
import Link from "next/link";
import { useState } from "react";
import { post } from "@/lib/client-api";

export function ReentryForm() {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      const r = await post<{ devLink?: string }>("/api/reentry", { phone });
      setDevLink(r.devLink ?? null);
      setSent(true);
    } catch (e) {
      setErr((e as { code?: string }).code === "bad_phone" ? "휴대폰 번호를 다시 확인해 주세요." : "잠시 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href="/">
            ‹ 처음으로
          </Link>
        </div>
        <div className="pad stack" style={{ paddingTop: 24, gap: 22 }}>
          <div className="stack" style={{ gap: 8 }}>
            <h1 className="h1" style={{ fontSize: 26 }}>
              다시 들어가기
            </h1>
            <div className="help" style={{ fontSize: 14 }}>
              알림톡 링크를 찾을 수 없거나 휴대폰을 바꿨나요?
              <br />
              등록한 번호로 새 접속 링크를 보내드려요.
            </div>
          </div>
          {!sent ? (
            <div className="stack" style={{ gap: 14 }}>
              <div className="stack" style={{ gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700 }} htmlFor="rphone">
                  등록한 휴대폰 번호
                </label>
                <input
                  id="rphone"
                  type="tel"
                  inputMode="tel"
                  placeholder="010-0000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: "100%", height: 52, borderRadius: 12, border: "1px solid var(--faint)", padding: "0 14px", fontSize: 16, font: "inherit" }}
                />
                <div className="help">보호자 번호와 자녀 번호 모두 사용할 수 있어요.</div>
              </div>
              {err && <div className="err">{err}</div>}
              <button className="cta" disabled={busy || !phone.trim()} onClick={() => void send()}>
                접속 링크 받기
              </button>
            </div>
          ) : (
            <div className="stack reveal" style={{ padding: 20, borderRadius: 16, background: "var(--tint)", gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>알림톡을 확인해 주세요</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                등록된 번호라면 곧 새 접속 링크가 도착해요. 링크를 누르면 바로 들어올 수 있어요. 홈 화면 아이콘이 열리지 않으면, 새 링크로 들어온 뒤 홈 화면에 다시 추가해 주세요.
              </div>
              {devLink && (
                <div className="card stack" style={{ gap: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>시험용 (미리보기에서만 보여요)</div>
                  <a href={devLink} style={{ fontSize: 12, wordBreak: "break-all", textDecoration: "underline" }}>
                    {devLink}
                  </a>
                </div>
              )}
              <button className="btn2" style={{ width: "auto", alignSelf: "flex-start", padding: "0 14px", minHeight: 44 }} onClick={() => setSent(false)}>
                다른 번호로 받기
              </button>
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: 20, textAlign: "center" }}>
        <div className="help">번호가 바뀌었거나 알림톡이 오지 않나요? 운영팀에 문의해 주세요.</div>
      </div>
    </div>
  );
}
