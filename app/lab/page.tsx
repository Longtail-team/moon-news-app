"use client";

// T01 기기 기술 검증 페이지. 실험용이며 어떤 기기에서 무엇이 되는지 기록하는 것이 목적이다.
// 녹음·사진·영상은 이 브라우저 안에서만 다루고 서버로 보내지 않는다.

import { useCallback, useEffect, useRef, useState } from "react";
import { getDeviceInfo } from "@/lib/lab/device";
import { canvasToPng, drawArticleImage } from "@/lib/lab/articleImage";
import { decodeAudio, queryMicPermission, startRecording, type RecordingSession } from "@/lib/lab/record";
import { FPS_OPTIONS, makeVideoA, makeVideoB, makeVideoC, type VideoOutput } from "@/lib/lab/video";
import { PHRASES } from "@/lib/lab/content";
import { errorText, extFromMime, fmtBytes, fmtSec, probeMedia, round, type LogEntry, type ManualMark } from "@/lib/lab/log";

const LEARNER_NAME = "김지우"; // 목업의 샘플 이름
const SPEEDS = [0.5, 0.8, 1, 1.2];

type Rec = {
  id: string;
  label: string;
  blob: Blob;
  mime: string;
  url: string;
  elapsedSec: number;
  audio?: AudioBuffer;
  decodedSec?: number;
};

type Method = "A" | "B" | "C";
type Vid = { id: string; method: Method; fps: number; blob: Blob; mime: string; url: string; ms: number; ext: string };

type Image = { canvas: HTMLCanvasElement; png: Blob; url: string };

const METHOD_LABEL: Record<Method, string> = {
  A: "방법 A · MediaRecorder 실시간 녹화",
  B: "방법 B · WebCodecs + Mediabunny",
  C: "방법 C · ffmpeg.wasm (참고용)",
};

// 사람이 확인해서 고르는 항목 (○ / △ / ✕ + 메모)
const MANUAL: Record<string, string> = {
  t1_prompt: "1 · 권한 창이 떴나요",
  t1_denyRetry: "1 · '허용 안 함' 후 다시 시도하면 어떻게 되나요",
  t1_screenOff: "1 · 녹음 중 화면이 꺼지면 (아래 기록 참고)",
  t1_appSwitch: "1 · 녹음 중 다른 앱에 갔다 오면 (아래 기록 참고)",
  t3_A: "3-A · 소리와 화면이 끝까지 정상인가요",
  t3_B: "3-B · 소리와 화면이 끝까지 정상인가요",
  t3_C: "3-C · 소리와 화면이 끝까지 정상인가요",
  t4_share: "4 · 공유 창이 뜨고, 저장 후 사진첩(갤러리)에 보이나요",
  t4_download: "4 · 내려받기 후 사진첩(갤러리)에 보이나요",
  t5_feed: "5 · 인스타 게시물(4:5)에서 목록에 보이고 소리가 나나요",
  t5_reels: "5 · 인스타 릴스에서 목록에 보이고 소리가 나나요",
  t5_length: "5 · 2분 30초 영상이 잘리지 않나요",
  t6_autoSave: "6 · 촬영한 사진이 사진첩에 자동으로 남나요",
  t6_share: "6 · 공유 창으로 사진첩 저장이 되나요",
  t7_pitch: "7 · 속도를 바꿔도 목소리 높이가 유지되나요",
  t7_half: "7 · 0.5배 음질 (○ 괜찮음 / ✕ 어색함)",
  t7_sync: "7 · 속도를 바꿔도 하이라이트가 맞게 움직이나요",
  kakao_external: "카카오톡 · 외부 브라우저로 열기 동작",
};

function Manual({
  ids,
  manual,
  setManual,
}: {
  ids: string[];
  manual: Record<string, ManualMark>;
  setManual: React.Dispatch<React.SetStateAction<Record<string, ManualMark>>>;
}) {
  return (
    <div className="manual">
      {ids.map((id) => {
        const cur = manual[id] ?? { mark: "", memo: "" };
        return (
          <div key={id}>
            <div className="q">{MANUAL[id]}</div>
            <div className="marks">
              {(["○", "△", "✕"] as const).map((m) => (
                <button
                  key={m}
                  className={cur.mark === m ? "on" : ""}
                  onClick={() => setManual((p) => ({ ...p, [id]: { memo: p[id]?.memo ?? "", mark: p[id]?.mark === m ? "" : m } }))}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              placeholder="메모"
              value={cur.memo}
              onChange={(e) => setManual((p) => ({ ...p, [id]: { mark: p[id]?.mark ?? "", memo: e.target.value } }))}
            />
          </div>
        );
      })}
    </div>
  );
}

const STORE_KEY = "t01-lab-v1";

let seq = 0;
const nextId = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export default function LabPage() {
  const [device, setDevice] = useState<Record<string, unknown> | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [manual, setManual] = useState<Record<string, ManualMark>>({});

  // 검사 1
  const session = useRef<{ s: RecordingSession; label: string; target: number | null; permBefore: string } | null>(null);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState<{ label: string; target: number | null } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recEvents, setRecEvents] = useState<string[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [recId, setRecId] = useState<string | null>(null);
  const rec = recs.find((r) => r.id === recId) ?? null;

  // 검사 2
  const [image, setImage] = useState<Image | null>(null);

  // 검사 3
  const [busy, setBusy] = useState<Method | null>(null);
  const [fps, setFps] = useState(FPS_OPTIONS[0]);
  const [progress, setProgress] = useState("");
  const [vids, setVids] = useState<Vid[]>([]);
  const [vidId, setVidId] = useState<string | null>(null);
  const vid = vids.find((v) => v.id === vidId) ?? null;

  // 검사 6
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);

  // 검사 7
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speed, setSpeed] = useState(1);
  const [keepPitch, setKeepPitch] = useState(true);
  const [phraseIdx, setPhraseIdx] = useState(-1);

  const [copyMsg, setCopyMsg] = useState("");

  const addLog = useCallback((e: Omit<LogEntry, "id" | "at">) => {
    setLogs((prev) => [...prev, { ...e, id: prev.length + 1, at: new Date().toISOString() }]);
  }, []);

  useEffect(() => {
    getDeviceInfo().then(setDevice, (e) => setDevice({ error: errorText(e) }));
  }, []);

  // 기록과 사람 확인 칸은 브라우저에 저장한다. 카메라·인스타 앱에 다녀오는 사이 페이지가 다시 열려도 남도록.
  // (녹음·영상 파일은 저장하지 않는다. 다시 열리면 다시 만들어야 한다.)
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as { logs?: LogEntry[]; manual?: Record<string, ManualMark> } | null;
      if (saved?.manual) setManual(saved.manual);
      if (saved?.logs?.length) {
        const prev = saved.logs;
        setLogs([
          ...prev,
          {
            id: prev.length + 1,
            at: new Date().toISOString(),
            test: "페이지 다시 열림",
            ok: true,
            detail: { note: "저장된 기록을 불러옴. 녹음·영상 파일은 사라짐", visibility: document.visibilityState },
          },
        ]);
      }
    } catch {
      // 저장소를 쓸 수 없는 환경이면 메모리 기록만 쓴다.
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ logs, manual }));
    } catch {
      // 저장 실패는 무시한다.
    }
  }, [logs, manual, restored]);

  function clearAll() {
    if (!window.confirm("이 기기의 기록과 확인 칸을 모두 지울까요?")) return;
    setLogs([]);
    setManual({});
  }

  // ───────── 검사 1. 마이크 녹음 ─────────
  async function startRec(label: string, target: number | null) {
    if (session.current) return;
    const permBefore = await queryMicPermission();
    setRecEvents([]);
    try {
      const s = await startRecording((line) => setRecEvents((prev) => [...prev, line]));
      session.current = { s, label, target, permBefore };
      setRecording({ label, target });
      setElapsed(0);
      if (target) autoStopTimer.current = setTimeout(() => void stopRec(), target * 1000);
    } catch (e) {
      addLog({
        test: "1 녹음",
        ok: false,
        error: errorText(e),
        detail: { label, permBefore, permAfter: await queryMicPermission() },
      });
    }
  }

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      const cur = session.current;
      if (!cur) return;
      setElapsed((performance.now() - cur.s.startedAt) / 1000);
      // 브라우저가 녹음을 스스로 끊은 경우에도 결과를 정리한다.
      if (!cur.s.isActive()) void stopRec();
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  async function stopRec() {
    const cur = session.current;
    if (!cur) return;
    session.current = null;
    if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    const { s, label, target, permBefore } = cur;
    setRecording(null);
    try {
      const { blob, mime, elapsedSec } = await s.stop();
      const url = URL.createObjectURL(blob);
      const r: Rec = { id: nextId(), label, blob, mime, url, elapsedSec };
      const detail: Record<string, unknown> = {
        label,
        targetSec: target,
        requestedMime: s.requestedMime ?? "기본값",
        elapsedSec: round(elapsedSec),
        getUserMediaMs: s.getUserMediaMs,
        permBefore,
        permAfter: await queryMicPermission(),
        events: s.events,
      };
      try {
        const tDec = performance.now();
        r.audio = await decodeAudio(blob);
        r.decodedSec = r.audio.duration;
        detail.decodedSec = round(r.audio.duration);
        detail.decodeMs = Math.round(performance.now() - tDec);
        detail.sampleRate = r.audio.sampleRate;
        detail.channels = r.audio.numberOfChannels;
      } catch (e) {
        detail.decodeError = errorText(e);
      }
      Object.assign(detail, await probeMedia(url, "audio"));
      setRecs((prev) => [...prev, r]);
      setRecId(r.id);
      addLog({ test: "1 녹음", ok: blob.size > 0, ms: Math.round(elapsedSec * 1000), mime, size: blob.size, detail });
    } catch (e) {
      addLog({ test: "1 녹음", ok: false, error: errorText(e), detail: { label, events: s.events } });
    }
  }

  // ───────── 검사 2. 기사 이미지 ─────────
  async function makeImage(): Promise<Image> {
    const t0 = performance.now();
    const canvas = document.createElement("canvas");
    try {
      const { fontLoaded } = await drawArticleImage(canvas, LEARNER_NAME);
      const png = await canvasToPng(canvas);
      const img = { canvas, png, url: URL.createObjectURL(png) };
      setImage(img);
      addLog({
        test: "2 기사 이미지",
        ok: true,
        ms: Math.round(performance.now() - t0),
        mime: png.type,
        size: png.size,
        detail: { width: canvas.width, height: canvas.height, pretendardLoaded: fontLoaded },
      });
      return img;
    } catch (e) {
      addLog({ test: "2 기사 이미지", ok: false, ms: Math.round(performance.now() - t0), error: errorText(e) });
      throw e;
    }
  }

  // ───────── 검사 3. 영상 만들기 ─────────
  async function makeVideo(method: Method) {
    if (!rec?.audio || busy) return;
    // 방법 A의 AudioContext는 버튼을 누른 이 순간에 만든다(아이폰 자동재생 제한).
    const ac = method === "A" ? new AudioContext() : null;
    void ac?.resume();
    setBusy(method);
    setProgress("준비 중");
    const t0 = performance.now();
    const vfps = method === "A" ? 30 : fps;
    const base = { recording: rec.label, recordingMime: rec.mime, audioSec: round(rec.audio.duration) };
    try {
      const img = image ?? (await makeImage());
      let out: VideoOutput;
      if (method === "A") out = await makeVideoA(ac!, img.canvas, rec.audio, setProgress);
      else if (method === "B") out = await makeVideoB(img.canvas, rec.audio, vfps, setProgress);
      else out = await makeVideoC(img.png, rec.blob, extFromMime(rec.mime), vfps, setProgress);
      const ms = Math.round(performance.now() - t0);
      const url = URL.createObjectURL(out.blob);
      const ext = out.mime.includes("webm") ? "webm" : "mp4";
      const v: Vid = { id: nextId(), method, fps: vfps, blob: out.blob, mime: out.mime, url, ms, ext };
      setVids((prev) => [...prev, v]);
      setVidId(v.id);
      const probe = await probeMedia(url, "video");
      addLog({
        test: `3-${method} 영상 ${vfps}fps`,
        ok: out.blob.size > 0,
        ms,
        mime: out.mime,
        size: out.blob.size,
        detail: { ...base, ...out.detail, ...probe, speedVsRealtime: round(rec.audio.duration / (ms / 1000)) },
      });
    } catch (e) {
      void ac?.close();
      addLog({
        test: `3-${method} 영상 ${vfps}fps`,
        ok: false,
        ms: Math.round(performance.now() - t0),
        error: errorText(e),
        detail: { ...base, ...((e as { detail?: Record<string, unknown> }).detail ?? {}) },
      });
    } finally {
      setBusy(null);
      setProgress("");
    }
  }

  // ───────── 검사 4·6. 저장 ─────────
  async function shareFile(test: string, file: File) {
    const t0 = performance.now();
    let canShare: boolean | string = "canShare 없음";
    try {
      if (typeof navigator.canShare === "function") canShare = navigator.canShare({ files: [file] });
      if (typeof navigator.share !== "function") throw new Error("navigator.share 없음");
      await navigator.share({ files: [file] });
      addLog({ test, ok: true, ms: Math.round(performance.now() - t0), mime: file.type, size: file.size, detail: { canShare, note: "공유 창 닫힘(완료)" } });
    } catch (e) {
      addLog({ test, ok: false, ms: Math.round(performance.now() - t0), mime: file.type, size: file.size, error: errorText(e), detail: { canShare } });
    }
  }

  function download(test: string, blob: Blob, name: string) {
    try {
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      addLog({ test, ok: true, mime: blob.type, size: blob.size, detail: { name, note: "a[download] 클릭함. 실제 저장 여부는 사람이 확인" } });
    } catch (e) {
      addLog({ test, ok: false, error: errorText(e) });
    }
  }

  // ───────── 검사 6. 작성지 사진 ─────────
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (photo) URL.revokeObjectURL(photo.url);
    const url = URL.createObjectURL(file);
    setPhoto({ file, url });
    const dims = await new Promise<Record<string, unknown>>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ imageLoad: "error" });
      img.src = url;
    });
    addLog({
      test: "6 사진 촬영",
      ok: true,
      mime: file.type,
      size: file.size,
      detail: { ...dims, secondsSinceLastModified: Math.round((Date.now() - file.lastModified) / 1000) },
    });
  }

  // ───────── 검사 7. 속도와 하이라이트 ─────────
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = speed;
    a.preservesPitch = keepPitch;
    (a as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = keepPitch;
  }, [speed, keepPitch, recId]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const a = audioRef.current;
      const dur = rec?.decodedSec ?? (a && Number.isFinite(a.duration) ? a.duration : 0);
      if (a && dur > 0 && !a.paused) {
        // 가짜 시간 정보: 녹음 길이를 구 개수로 똑같이 나눈다. currentTime은 재생 속도와 무관한 음원 기준 시간.
        setPhraseIdx(Math.min(PHRASES.length - 1, Math.floor(a.currentTime / (dur / PHRASES.length))));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rec]);

  function changeSpeed(s: number) {
    setSpeed(s);
    const a = audioRef.current;
    addLog({
      test: "7 속도",
      ok: true,
      detail: {
        speed: s,
        preservesPitchSet: keepPitch,
        preservesPitchRead: a ? a.preservesPitch : null,
        currentTime: a ? round(a.currentTime) : null,
      },
    });
  }

  // ───────── 카카오톡 외부 브라우저 ─────────
  function openExternal() {
    const url = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`;
    addLog({ test: "카카오톡 외부 브라우저", ok: true, detail: { scheme: url, note: "이동 시도. 열렸는지는 사람이 확인" } });
    window.location.href = url;
  }

  // ───────── 결과 복사 ─────────
  const resultJson = JSON.stringify(
    { kind: "T01 lab result", version: 1, createdAt: new Date().toISOString(), page: typeof window !== "undefined" ? window.location.origin + window.location.pathname : "", device, manual, logs },
    null,
    2,
  );
  const jsonRef = useRef<HTMLTextAreaElement | null>(null);

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(resultJson);
      setCopyMsg("복사했어요");
    } catch {
      // 인앱 브라우저 등에서 clipboard API가 막히면 예전 방식으로 시도한다.
      const ta = jsonRef.current;
      if (ta) {
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
      }
      const ok = document.execCommand?.("copy");
      setCopyMsg(ok ? "복사했어요(대체 방식)" : "자동 복사 실패. 아래 칸을 길게 눌러 전체 선택 후 복사해 주세요");
    }
    setTimeout(() => setCopyMsg(""), 5000);
  }

  const shownDevice = device
    ? Object.entries(device).map(([k, v]) => [k, typeof v === "object" && v !== null ? JSON.stringify(v, null, 1) : String(v)])
    : [];

  return (
    <main className="lab">
      <h1>기기 기술 검증 (T01)</h1>
      <p className="lead">검사 1부터 차례로 눌러 주세요. 녹음·사진·영상은 이 휴대폰 안에서만 쓰이고 서버로 보내지 않습니다. 끝나면 아래 &quot;결과 복사&quot;를 눌러 붙여 넣어 주세요.</p>

      {device && (
        <section className="card" style={{ background: "var(--soft)", borderColor: "var(--main)" }}>
          <h2>지금 연 환경: {String(device.environment)}</h2>
          <p className="hint" style={{ margin: 0 }}>
            시험 목록과 다르면 주소를 복사해 원하는 브라우저(Chrome, 삼성 인터넷, Safari, 카카오톡 나와의 채팅)에서 다시 열어 주세요.
          </p>
        </section>
      )}

      <section className="card">
        <h2>기기 정보</h2>
        {!device && <p className="hint">확인 중…</p>}
        <table className="kv">
          <tbody>
            {shownDevice.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className={v === "true" ? "yes" : v === "false" ? "no" : ""}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>검사 1. 마이크 녹음</h2>
        <p className="hint">10초, 그리고 2분 30초(0.5배 속도로 1주차 지문을 읽는 길이)를 각각 녹음해 주세요. 녹음 중 화면 끄기·다른 앱 다녀오기도 시험해 주세요.</p>
        {recording ? (
          <>
            <div className="big">{fmtSec(elapsed)}{recording.target ? ` / ${fmtSec(recording.target)}` : ""}</div>
            <div className="row">
              <button className="primary" onClick={() => void stopRec()}>정지</button>
            </div>
          </>
        ) : (
          <div className="row">
            <button className="primary" onClick={() => void startRec("10초", 10)}>10초 녹음</button>
            <button className="primary" onClick={() => void startRec("2분 30초", 150)}>2분 30초 녹음</button>
            <button onClick={() => void startRec("직접 정지", null)}>직접 정지 녹음</button>
          </div>
        )}
        {recEvents.length > 0 && <pre className="events">{recEvents.join("\n")}</pre>}
        {recs.map((r) => (
          <div key={r.id} className={`item ${r.id === recId ? "selected" : ""}`}>
            <label className="row" style={{ margin: 0 }}>
              <input type="radio" checked={r.id === recId} onChange={() => setRecId(r.id)} />
              <b>{r.label}</b> · {r.mime || "형식 없음"} · {fmtBytes(r.blob.size)} · 경과 {fmtSec(r.elapsedSec)} · 디코딩 {r.decodedSec != null ? fmtSec(r.decodedSec) : "실패"}
            </label>
            <audio controls src={r.url} preload="metadata" />
          </div>
        ))}
        <Manual manual={manual} setManual={setManual} ids={["t1_prompt", "t1_denyRetry", "t1_screenOff", "t1_appSwitch"]} />
      </section>

      <section className="card">
        <h2>검사 2. 기사 이미지 만들기</h2>
        <div className="row">
          <button className="primary" onClick={() => void makeImage().catch(() => undefined)}>이미지 만들기</button>
        </div>
        {image && <img className="preview" src={image.url} alt="기사 이미지 미리보기" />}
      </section>

      <section className="card">
        <h2>검사 3. 영상 만들기 (이미지 + 녹음 → MP4)</h2>
        <p className="hint">
          {rec ? `사용할 녹음: ${rec.label} (${fmtSec(rec.decodedSec)})` : "먼저 검사 1에서 녹음해 주세요."}
          {rec && !rec.audio ? " · 이 녹음은 디코딩에 실패해 영상 재료로 쓸 수 없어요." : ""}
        </p>
        <div className="row">
          {(["A", "B", "C"] as Method[]).map((m) => (
            <button key={m} className="primary" disabled={!rec?.audio || !!busy} onClick={() => void makeVideo(m)}>
              {busy === m ? "만드는 중…" : `방법 ${m}`}
            </button>
          ))}
        </div>
        <div className="row" style={{ fontSize: 13 }}>
          B·C 프레임 수
          {FPS_OPTIONS.map((f) => (
            <button key={f} className={fps === f ? "on" : ""} disabled={!!busy} onClick={() => setFps(f)}>
              {f}fps
            </button>
          ))}
        </div>
        <p className="hint">A {METHOD_LABEL.A.split("·")[1]} (녹음 길이만큼 걸림) · B {METHOD_LABEL.B.split("·")[1]} · C {METHOD_LABEL.C.split("·")[1]} (약 30MB 내려받음)</p>
        <div className="status">{progress}</div>
        {vids.map((v) => (
          <div key={v.id} className={`item ${v.id === vidId ? "selected" : ""}`}>
            <label className="row" style={{ margin: 0 }}>
              <input type="radio" checked={v.id === vidId} onChange={() => setVidId(v.id)} />
              <b>방법 {v.method} · {v.fps}fps</b> · {v.mime} · {fmtBytes(v.blob.size)} · {fmtSec(v.ms / 1000)}
            </label>
            <video controls playsInline src={v.url} preload="metadata" />
          </div>
        ))}
        <Manual manual={manual} setManual={setManual} ids={["t3_A", "t3_B", "t3_C"]} />
      </section>

      <section className="card">
        <h2>검사 4. 사진첩에 저장</h2>
        <p className="hint">{vid ? `저장할 영상: 방법 ${vid.method} · ${vid.fps}fps (${vid.ext})` : "검사 3에서 영상을 만든 뒤, 가장 잘 된 결과를 위에서 골라 주세요."}</p>
        <div className="row">
          <button
            className="primary"
            disabled={!vid}
            onClick={() => vid && void shareFile(`4 공유 저장 (방법 ${vid.method} ${vid.fps}fps)`, new File([vid.blob], `nangdok-week01.${vid.ext}`, { type: vid.blob.type || "video/mp4" }))}
          >
            공유 창으로 저장
          </button>
          <button disabled={!vid} onClick={() => vid && download(`4 내려받기 (방법 ${vid.method} ${vid.fps}fps)`, vid.blob, `nangdok-week01.${vid.ext}`)}>
            내려받기
          </button>
        </div>
        <Manual manual={manual} setManual={setManual} ids={["t4_share", "t4_download"]} />
      </section>

      <section className="card">
        <h2>검사 5. 인스타그램에서 고르기 (사람이 확인)</h2>
        <p className="hint">저장한 영상을 인스타그램 앱에서 게시물(4:5)과 릴스로 각각 골라 보세요. 올리기 직전 화면까지만 확인하면 됩니다.</p>
        <Manual manual={manual} setManual={setManual} ids={["t5_feed", "t5_reels", "t5_length"]} />
      </section>

      <section className="card">
        <h2>검사 6. 작성지 사진</h2>
        <div className="row">
          <label className="btn primary">
            사진 찍기
            <input type="file" accept="image/*" capture="environment" onChange={(e) => void onPhoto(e)} style={{ display: "none" }} />
          </label>
          <button disabled={!photo} onClick={() => photo && void shareFile("6 사진 공유 저장", photo.file)}>
            공유 창으로 저장
          </button>
        </div>
        {photo && <img className="preview" src={photo.url} alt="촬영한 사진" />}
        <Manual manual={manual} setManual={setManual} ids={["t6_autoSave", "t6_share"]} />
      </section>

      <section className="card">
        <h2>검사 7. 재생 속도와 하이라이트</h2>
        <p className="hint">{rec ? `녹음: ${rec.label}` : "먼저 검사 1에서 녹음해 주세요."} 하이라이트는 녹음 길이를 구 {PHRASES.length}개로 똑같이 나눈 가짜 시간입니다.</p>
        {rec && <audio ref={audioRef} controls src={rec.url} preload="metadata" style={{ width: "100%" }} />}
        <div className="row">
          {SPEEDS.map((s) => (
            <button key={s} className={speed === s ? "on" : ""} onClick={() => changeSpeed(s)}>
              {s}배
            </button>
          ))}
        </div>
        <label className="row" style={{ fontSize: 13 }}>
          <input type="checkbox" checked={keepPitch} onChange={(e) => setKeepPitch(e.target.checked)} />
          목소리 높이 유지 (preservesPitch)
        </label>
        <div className="phrases">
          {[1, 2, 3, 4].map((sn) => (
            <span key={sn} className="s">
              {PHRASES.map((p, i) =>
                p.sentence === sn ? (
                  <span key={i}>
                    <span className={`p ${i === phraseIdx ? "now" : ""}`}>{p.text}</span>{" "}
                  </span>
                ) : null,
              )}
            </span>
          ))}
        </div>
        <Manual manual={manual} setManual={setManual} ids={["t7_pitch", "t7_half", "t7_sync"]} />
      </section>

      <section className="card">
        <h2>카카오톡에서 외부 브라우저로 열기</h2>
        <p className="hint">안드로이드 카카오톡 안에서 열었을 때만 시험합니다. 아이폰은 자동 전환 수단이 없어 안내 문구가 필요한지만 메모해 주세요.</p>
        <div className="row">
          <button onClick={openExternal}>외부 브라우저로 열기</button>
        </div>
        <Manual manual={manual} setManual={setManual} ids={["kakao_external"]} />
      </section>

      <section className="card">
        <h2>기록 ({logs.length})</h2>
        {logs.length === 0 && <p className="hint">아직 기록이 없습니다.</p>}
        {logs.map((l) => (
          <div key={l.id} className="log">
            <b className={l.ok ? "yes" : "no"}>{l.ok ? "성공" : "실패"}</b> <b>{l.test}</b>
            {l.ms != null && ` · ${fmtSec(l.ms / 1000)}`}
            {l.mime && ` · ${l.mime}`}
            {l.size != null && ` · ${fmtBytes(l.size)}`}
            {l.error && <div className="no">{l.error}</div>}
          </div>
        ))}
        <h3>결과 JSON</h3>
        <textarea ref={jsonRef} className="json" readOnly value={resultJson} />
      </section>

      <div className="copybar">
        <div className="inner">
          <button className="primary" onClick={() => void copyResult()}>결과 복사</button>
          <button onClick={clearAll} style={{ flex: "0 0 auto" }}>기록 지우기</button>
        </div>
        {copyMsg && <div className="status" style={{ textAlign: "center", maxWidth: 560, margin: "6px auto 0" }}>{copyMsg}</div>}
      </div>
    </main>
  );
}
