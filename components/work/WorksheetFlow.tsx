"use client";

// 작성 활동 (spec.md 6장, 목업 worksheet): 1 작성지 받기 → 2 쓰기 안내 → 3 사진 올리기 → 완료하기
// 사진은 고르자마자 줄여서 Storage 비공개 버킷에 올리고 붙여 둔다(작성 중). 나갔다 와도 이어서 할 수 있다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { WorkMaterial } from "@/lib/server/reading";
import { post, uploadMedia } from "@/lib/client-api";
import { shrinkPhoto } from "@/lib/image";

type Kind = "voca" | "summary" | "debate";
const TYPE: Record<Kind, string> = { voca: "VOCA", summary: "SUMMARY", debate: "DEBATE" };

const TEXT: Record<Kind, { title: string; pdf: string; pdfSub: string; step2: string; guide: string }> = {
  summary: { title: "기사 요약 쓰기", pdf: "이번 주 기사 PDF", pdfSub: "요약 작성지는 PDF 뒤쪽에 있어요", step2: "요약하기", guide: "기사의 핵심을 내 말로 3~5문장에 담아 보세요." },
  debate: {
    title: "찬반토론 쓰기",
    pdf: "이번 주 기사 PDF",
    pdfSub: "토론 질문지는 PDF 맨 뒤에 있어요",
    step2: "내 입장 쓰기",
    guide: "찬성과 반대 중 하나를 고르고, 이유 두 가지를 기사에서 찾아 써 보세요.",
  },
  voca: { title: "VOCA 공부", pdf: "VOCA 정리 PDF", pdfSub: "출력하거나 공책에 써도 돼요", step2: "단어 익히기", guide: "음원을 들으며 단어와 뜻을 따라 써 보세요." },
};

const svg = (d: React.ReactNode, size = 22) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const DlIcon = () => svg(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />, 18);
const CamIcon = () =>
  svg(
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>,
  );
const ImgIcon = () =>
  svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-9 9" />
    </>,
  );

export function WorksheetFlow({ kind, material }: { kind: Kind; material: WorkMaterial }) {
  const router = useRouter();
  const t = TEXT[kind];
  const pdfUrl = kind === "voca" ? material.vocaPdf : material.articlePdf;
  const [activityId, setActivityId] = useState<string | null>(material.draft?.activityId ?? null);
  const [photo, setPhoto] = useState<string | null>(material.draft?.photoUrl ?? null);
  const [busy, setBusy] = useState<"upload" | "complete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const camRef = useRef<HTMLInputElement | null>(null);
  const albumRef = useRef<HTMLInputElement | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy("upload");
    const local = URL.createObjectURL(file);
    try {
      const id = activityId ?? (await post<{ activityId: string }>("/api/activity/start", { week: material.week_no, type: TYPE[kind] })).activityId;
      setActivityId(id);
      const blob = await shrinkPhoto(file);
      const path = await uploadMedia(id, blob, blob.type || file.type);
      await post("/api/activity/attach", { activityId: id, path });
      setPhoto(local);
    } catch {
      URL.revokeObjectURL(local);
      setError("사진을 올리지 못했어요. 인터넷 연결을 확인하고 다시 골라 주세요.");
    } finally {
      setBusy(null);
    }
  }

  async function complete() {
    if (!activityId || !photo || busy) return;
    setBusy("complete");
    setError(null);
    try {
      const c = await post<{ weekNo: number; weekCompleted: number }>("/api/activity/complete", { activityId });
      router.push(`/?done=${c.weekNo}-${c.weekCompleted}`);
    } catch {
      setError("완료하지 못했어요. 다시 눌러 주세요.");
      setBusy(null);
    }
  }

  const step = (n: number, title: string, inner: React.ReactNode) => (
    <div className="card lift stack">
      <div className="row" style={{ gap: 10 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--tint)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 800,
            color: "var(--deep)",
          }}
        >
          {n}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
      </div>
      {inner}
    </div>
  );

  return (
    <div className="app">
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href={`/activity?week=${material.week_no}`}>
            ‹ 활동 선택
          </Link>
          <div className="meta">{material.week_no}주차</div>
        </div>
        <div className="pad stack">
          <h1 className="h1">{t.title}</h1>

          {step(
            1,
            "작성지 받기",
            <>
              <div className="row">
                <div className="stack" style={{ gap: 2, flex: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{t.pdf}</span>
                  <span className="help" style={{ fontSize: 12 }}>
                    {pdfUrl ? t.pdfSub : "자료를 준비하고 있어요"}
                  </span>
                </div>
                {pdfUrl ? (
                  <a className="chip" style={{ background: "var(--tint)", border: 0, gap: 4, borderRadius: 12, fontWeight: 800 }} href={pdfUrl} target="_blank" rel="noopener">
                    <DlIcon />
                    받기
                  </a>
                ) : null}
              </div>
              {kind === "voca" && (
                <div className="row" style={{ paddingTop: 10, borderTop: "1px solid var(--mute)" }}>
                  <button
                    className="play"
                    disabled={!material.vocaAudio}
                    aria-label={playing ? "VOCA 구간반복 멈춤" : "VOCA 구간반복 재생"}
                    onClick={() => {
                      const a = audioRef.current;
                      if (!a) return;
                      if (playing) {
                        a.pause();
                        setPlaying(false);
                      } else void a.play().then(() => setPlaying(true), () => setPlaying(false));
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                      {playing ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" /> : <path d="M7 4l14 8-14 8z" />}
                    </svg>
                  </button>
                  <span className="stack" style={{ gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>VOCA 구간반복 음원</span>
                    <span className="help" style={{ fontSize: 12 }}>
                      {material.vocaAudio ? "한국어–영어 3회" : "음원 준비 중"}
                    </span>
                  </span>
                  {material.vocaAudio && <audio ref={audioRef} src={material.vocaAudio} preload="metadata" onEnded={() => setPlaying(false)} />}
                </div>
              )}
            </>,
          )}

          {step(
            2,
            t.step2,
            <>
              <div className="help" style={{ fontSize: 13 }}>
                {t.guide}
              </div>
              {kind === "voca" && material.vocab.length > 0 && (
                <div className="stack" style={{ gap: 4 }}>
                  {material.vocab.map((v) => (
                    <div key={v.no} className="between" style={{ fontSize: 14, padding: "6px 0", borderBottom: "1px solid var(--mute)" }}>
                      <b>{v.word}</b>
                      <span className="meta">{v.meaning}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link className="textbtn" style={{ alignSelf: "flex-start", fontSize: 13 }} href={`/read/${material.week_no}/en`}>
                기사 원문 다시 보기
              </Link>
            </>,
          )}

          {step(
            3,
            "사진 올리기",
            <>
              {photo ? (
                <div className="row" style={{ padding: 10, borderRadius: 12, background: "var(--tint)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="올린 작성지 사진" style={{ width: 52, height: 64, objectFit: "cover", borderRadius: 8, background: "var(--white)" }} />
                  <span className="stack" style={{ gap: 2, flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>작성지 사진 1장</span>
                    <span className="help" style={{ fontSize: 12 }}>
                      올렸어요
                    </span>
                  </span>
                  <button className="textbtn" style={{ fontSize: 13 }} disabled={!!busy} onClick={() => albumRef.current?.click()}>
                    바꾸기
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button className="btn2" style={{ height: 72, borderStyle: "dashed", flexDirection: "column", gap: 4, fontSize: 14 }} disabled={!!busy} onClick={() => camRef.current?.click()}>
                    <CamIcon />
                    사진 찍기
                  </button>
                  <button className="btn2" style={{ height: 72, borderStyle: "dashed", flexDirection: "column", gap: 4, fontSize: 14 }} disabled={!!busy} onClick={() => albumRef.current?.click()}>
                    <ImgIcon />
                    앨범에서 고르기
                  </button>
                </div>
              )}
              {busy === "upload" && <div className="meta">사진을 올리는 중…</div>}
              {kind === "voca" && !photo && (
                <Link className="textbtn" style={{ fontSize: 13, alignSelf: "flex-start" }} href={`/read/${material.week_no}/voca`}>
                  사진 대신 단어 낭독으로 하기
                </Link>
              )}
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onPick(e)} />
              <input ref={albumRef} type="file" accept="image/*" hidden onChange={(e) => void onPick(e)} />
            </>,
          )}
          {error && <div className="err">{error}</div>}
        </div>
      </div>
      <div className="bottom">
        <button className="cta" disabled={!photo || !!busy} onClick={() => void complete()}>
          {busy === "complete" ? "완료하는 중…" : photo ? "완료하기" : "사진을 올리면 완료할 수 있어요"}
        </button>
      </div>
    </div>
  );
}
