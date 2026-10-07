"use client";

// 인스타 올리기 (spec.md 8장): 올릴 것마다 저장 → 인스타에 올리기 → 게시물 링크 붙여넣기 → 완료(인증)
// 낭독은 "영상 저장"(2단계 영상 모듈, lib/video), 작성지는 "사진 저장".
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Queue, QueueItem } from "@/lib/server/reading";
import { ACT, ActIcon } from "@/components/student/icons";
import { TabBar } from "@/components/student/TabBar";
import { post } from "@/lib/client-api";
import { fmtMonthDay } from "@/lib/format";
import { canMakeVideo, saveFile } from "@/lib/video";

function Item({ item, onVerified, onMessage }: { item: QueueItem; onVerified: (verifiedCount: number) => void; onMessage: (m: string) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const photo = item.kind === "photo";

  // 사진은 미리 받아 둔다: 공유 창은 버튼을 누른 바로 그 순간에 열어야 하는 기기가 있어서
  useEffect(() => {
    if (!photo || !item.mediaUrl) return;
    let alive = true;
    fetch(item.mediaUrl)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        if (!alive) return;
        const ext = b.type === "image/png" ? "png" : "jpg";
        fileRef.current = new File([b], `새벽달영어뉴스_${item.week_no}주차_${ACT[item.activity_type].short}.${ext}`, { type: b.type || "image/jpeg" });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [photo, item]);

  async function save() {
    if (photo) {
      if (!fileRef.current) return onMessage("사진을 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요.");
      const r = await saveFile(fileRef.current);
      if (r === "downloaded") onMessage("사진을 내려받았어요. 사진첩이나 파일에서 확인해 주세요.");
      return;
    }
    const can = await canMakeVideo();
    if (!can.ok) onMessage(can.reason ?? "이 기기에서는 영상을 만들 수 없어요.");
  }

  async function verify() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ verifiedCount: number }>("/api/activity/verify", { activityId: item.activity_id, url });
      onVerified(r.verifiedCount);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        code === "not_instagram"
          ? "인스타그램 게시물 링크를 붙여 넣어 주세요. 게시물의 ··· 메뉴에서 '링크 복사'를 누르면 돼요."
          : code === "duplicate"
            ? "이미 다른 학습에 쓴 게시물이에요. 이 학습으로 올린 게시물의 링크를 넣어 주세요."
            : "저장하지 못했어요. 다시 눌러 주세요.",
      );
      setBusy(false);
    }
  }

  const id = `u-${item.activity_id}`;
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="between">
        <div className="row" style={{ gap: 10 }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ActIcon type={item.activity_type} />
          </span>
          <span className="stack" style={{ gap: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>{ACT[item.activity_type].name}</span>
            <span className="meta">
              {item.week_no}주차 · {fmtMonthDay(item.completed_at)}
              {photo ? " · 작성지 사진" : " 녹음"}
            </span>
          </span>
        </div>
        <button
          onClick={() => void save()}
          style={{ flexShrink: 0, minHeight: 44, padding: "0 14px", borderRadius: 12, border: 0, background: "var(--ink)", color: "var(--white)", font: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
        >
          {photo ? "사진 저장" : "영상 저장"}
        </button>
      </div>
      <label className="label" style={{ color: "var(--sub)", fontSize: 13, fontWeight: 700 }} htmlFor={id}>
        올린 게시물 링크
      </label>
      <div className="row" style={{ gap: 8 }}>
        <input
          id={id}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="링크 붙여넣기"
          inputMode="url"
          autoComplete="off"
          style={{ height: 48, fontSize: 15, minWidth: 0, flex: 1, borderRadius: 12, border: "1px solid var(--faint)", padding: "0 12px", font: "inherit" }}
        />
        <button
          disabled={!url.trim() || busy}
          onClick={() => void verify()}
          style={{ height: 48, padding: "0 16px", borderRadius: 12, border: 0, background: url.trim() ? "var(--main)" : "var(--mute)", font: "inherit", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", cursor: "pointer", color: "var(--ink)" }}
        >
          {busy ? "…" : "완료"}
        </button>
      </div>
      {error && <div className="err">{error}</div>}
    </div>
  );
}

export function UploadQueue({ queue, deadline }: { queue: Queue; deadline: string }) {
  const [items, setItems] = useState(queue.items);
  const [verified, setVerified] = useState(queue.verified_count);
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null);
  const say = (text: string) => setMsg((m) => ({ text, n: (m?.n ?? 0) + 1 }));

  const steps = ["1. 저장하기", "2. 인스타에\n올리기", "3. 링크\n붙여넣기"];
  return (
    <div className="app">
      <div className="scroll">
        <div className="pad stack" style={{ paddingTop: 22 }}>
          <div className="between" style={{ alignItems: "baseline" }}>
            <h1 className="h1">인스타 올리기</h1>
            <span className="meta" style={{ fontSize: 14 }}>
              완주까지 {verified} / {queue.total_target}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {steps.map((t) => (
              <div key={t} style={{ padding: 10, borderRadius: 12, background: "var(--tint)", fontSize: 13, fontWeight: 700, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                {t}
              </div>
            ))}
          </div>
          {items.length ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>올릴 것 {items.length}개</div>
              {items.map((it) => (
                <Item
                  key={it.activity_id}
                  item={it}
                  onMessage={say}
                  onVerified={(n) => {
                    setVerified(n);
                    setItems((xs) => xs.filter((x) => x.activity_id !== it.activity_id));
                    say(`인스타 올리기 완료! 완주까지 ${n} / ${queue.total_target}`);
                  }}
                />
              ))}
              <div className="help">종강일 {deadline}까지 모두 올려 주세요.</div>
            </>
          ) : (
            <div className="card stack" style={{ alignItems: "center", textAlign: "center", padding: "28px 16px" }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>지금은 올릴 것이 없어요</div>
              <div className="help">오늘 학습하면 여기에 올릴 것이 생겨요.</div>
              <Link className="cta" href="/activity" style={{ marginTop: 6 }}>
                + 오늘 학습하기
              </Link>
            </div>
          )}
        </div>
      </div>
      <TabBar active="upload" uploadCount={items.length} />
      {msg && (
        <div key={msg.n} className="toast" role="status">
          {msg.text}
        </div>
      )}
    </div>
  );
}
