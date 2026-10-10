"use client";

// 작성 활동 (spec.md 6장, 목업 worksheet): 1 작성지 받기 → 2 쓰기 안내 → 3 사진 올리기 → 완료하기
// 사진은 고르자마자 줄여서 Storage 비공개 버킷에 올리고 붙여 둔다(작성 중). 나갔다 와도 이어서 할 수 있다.
// 기사 요약은 기자수첩(내가 붙인 제목·요약, 사진 글자 읽기, 선택 입력). 찬반토론은 합친 기사 화면으로 옮김(T07 PR E).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { WorkMaterial } from "@/lib/server/reading";
import { post, uploadMedia } from "@/lib/client-api";
import { shrinkPhoto } from "@/lib/image";

type Kind = "voca" | "summary";
const TYPE: Record<Kind, string> = { voca: "VOCA", summary: "SUMMARY" };

const TEXT: Record<Kind, { title: string; pdf: string; pdfSub: string; step2: string; guide: string }> = {
  summary: { title: "기사 요약 쓰기", pdf: "이번 주 기사 PDF", pdfSub: "요약 작성지는 PDF 뒤쪽에 있어요", step2: "요약하기", guide: "기사의 핵심을 내 말로 3~5문장에 담아 보세요." },
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
const input: React.CSSProperties = { width: "100%", minHeight: 48, borderRadius: 12, border: "1px solid var(--faint)", background: "var(--white)", padding: "12px 14px", fontSize: 16, font: "inherit" };

const OCR_ERR: Record<string, string> = {
  limit: "글자 읽기는 3번까지 할 수 있어요. 직접 고쳐 주세요.",
  unsupported: "이 사진 형식은 읽을 수 없어요. 직접 입력해 주세요.",
  unavailable: "지금은 글자 읽기를 쓸 수 없어요. 직접 입력해 주세요.",
  no_consent: "보호자가 AI 글자 읽기에 동의해야 쓸 수 있어요. 직접 입력해 주세요.",
};

const ImgIcon = () =>
  svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-9 9" />
    </>,
  );

export function WorksheetFlow({ kind, material, ocr }: { kind: Kind; material: WorkMaterial; ocr: boolean }) {
  const router = useRouter();
  const t = TEXT[kind];
  const pdfUrl = kind === "voca" ? material.vocaPdf : material.articlePdf;
  const [activityId, setActivityId] = useState<string | null>(material.draft?.activityId ?? null);
  const [photo, setPhoto] = useState<string | null>(material.draft?.photoUrl ?? null);
  const [busy, setBusy] = useState<"upload" | "complete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const note = material.draft?.note;
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [ocrLeft, setOcrLeft] = useState(note?.ocr_left ?? 3);
  const [reading, setReading] = useState(false);
  const [ocrMsg, setOcrMsg] = useState<string | null>(null);
  // 사진에서 읽은 글자: 학생이 "이대로 저장 / 수정"을 고르기 전까지 여기 둔다
  const [ocrText, setOcrText] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
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

  async function readPhoto() {
    if (!activityId || reading) return;
    setReading(true);
    setOcrMsg(null);
    try {
      const r = await post<{ text: string }>("/api/activity/ocr", { activityId });
      setOcrLeft((n) => n - 1);
      if (!r.text) setOcrMsg("글자를 찾지 못했어요. 사진을 밝게 다시 찍거나 직접 입력해 주세요.");
      else setOcrText(r.text);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code === "limit") setOcrLeft(0);
      else if (code !== "unavailable" && code !== "unsupported") setOcrLeft((n) => Math.max(0, n - 1));
      setOcrMsg(OCR_ERR[code] ?? "글자를 읽지 못했어요. 잠시 뒤 다시 누르거나 직접 입력해 주세요.");
    } finally {
      setReading(false);
    }
  }

  // 읽은 글자 그대로: 요약에 넣고 바로 저장한다
  async function acceptOcr() {
    if (ocrText === null || !activityId) return;
    const text = ocrText;
    setBody(text);
    setOcrText(null);
    try {
      await post("/api/activity/note", { activityId, title, body: text });
      setOcrMsg("저장했어요. 완료하기를 누르면 이번 학습이 끝나요.");
    } catch {
      setOcrMsg("저장하지 못했어요. 완료하기를 누를 때 다시 저장할게요.");
    }
  }

  // 수정: 요약 칸에 넣고 고치게 한다(완료할 때 저장)
  function editOcr() {
    if (ocrText === null) return;
    setBody(ocrText);
    setOcrText(null);
    setOcrMsg("틀린 곳을 고쳐 주세요. 완료하기를 누르면 고친 내용으로 저장돼요.");
    setTimeout(() => bodyRef.current?.focus(), 0);
  }

  // 선택 입력이 있으면 학습 완료 직전에 저장한다
  async function saveNote(id: string) {
    if (kind === "summary" && (title.trim() || body.trim() || note)) await post("/api/activity/note", { activityId: id, title, body });
  }

  async function complete() {
    if (!activityId || !photo || busy) return;
    setBusy("complete");
    setError(null);
    try {
      try {
        await saveNote(activityId);
      } catch {
        setError("기록을 저장하지 못했어요. 다시 눌러 주세요.");
        setBusy(null);
        return;
      }
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
              <Link className="textbtn" style={{ alignSelf: "flex-start", fontSize: 13 }} href={`/article/${material.week_no}`}>
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
          {kind === "summary" &&
            step(
              4,
              "기자수첩 (선택)",
              <>
                <div className="help" style={{ fontSize: 13 }}>
                  기사에 내 제목을 붙이고 요약을 옮겨 두면, 12주 뒤 내 영어 뉴스북으로 모아 드려요.
                </div>
                <input style={input} value={title} maxLength={60} placeholder="내가 붙인 제목" aria-label="내가 붙인 제목" onChange={(e) => setTitle(e.target.value)} />
                {ocrText !== null && (
                  <div className="stack" style={{ gap: 10, padding: 14, borderRadius: 12, background: "var(--tint)" }}>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>사진에서 읽은 글자예요. 내가 쓴 것과 같나요?</span>
                    <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap", background: "var(--white)", borderRadius: 10, padding: 12 }}>{ocrText}</div>
                    <span className="help" style={{ fontSize: 13 }}>
                      수정하실래요? 이대로 저장하실래요?
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <button className="btn2" onClick={editOcr}>
                        수정할게요
                      </button>
                      <button className="cta" onClick={() => void acceptOcr()}>
                        이대로 저장
                      </button>
                    </div>
                  </div>
                )}
                <textarea
                  ref={bodyRef}
                  hidden={ocrText !== null}
                  style={{ ...input, minHeight: 120, resize: "vertical", lineHeight: 1.6 }}
                  value={body}
                  maxLength={2000}
                  placeholder="요약을 입력하거나, 사진에서 글자를 읽어 오세요"
                  aria-label="요약"
                  onChange={(e) => setBody(e.target.value)}
                />
                {ocr && !material.ocr_consent && (
                  <div className="help" style={{ fontSize: 13 }}>
                    사진 글자 읽기는 보호자가 AI 글자 읽기에 동의해야 쓸 수 있어요. 요약은 직접 입력해 주세요.
                  </div>
                )}
                {ocr && material.ocr_consent && photo && activityId && ocrText === null && (
                  <button className="btn2" disabled={reading || ocrLeft <= 0 || !!busy} onClick={() => void readPhoto()}>
                    {reading ? "사진에서 글자를 읽는 중…" : ocrLeft > 0 ? `사진에서 글자 읽기 (${ocrLeft}번 남음)` : "글자 읽기를 다 썼어요"}
                  </button>
                )}
                {ocrMsg && <div className="help" style={{ fontSize: 13 }}>{ocrMsg}</div>}
              </>,
            )}
          {error && <div className="err">{error}</div>}
        </div>
      </div>
      <div className="bottom">
        <button className="cta" disabled={!photo || !!busy || ocrText !== null} onClick={() => void complete()}>
          {busy === "complete" ? "완료하는 중…" : !photo ? "사진을 올리면 완료할 수 있어요" : ocrText !== null ? "읽은 글자를 먼저 확인해 주세요" : "완료하기"}
        </button>
      </div>
    </div>
  );
}
