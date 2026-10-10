// 청독 시트(2026-10-10): 음원 고르기 → 재생·진행·이번 청독 시간 → 속도·반복 → 청독 완료.
// 재생 상태는 useListening(lib/listen)에 있고, 이 부품은 그리기만 한다.
import type { AudioType } from "@/lib/listening";
import { fmtListen } from "@/lib/listening";
import { RATES, type ListenAudio, type useListening } from "@/lib/listen/useListening";

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
    <path d="M7 4l14 8-14 8z" />
  </svg>
);
const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);

export function ListenSheet({
  audios,
  selected,
  onSelect,
  L,
  busy,
  onComplete,
}: {
  audios: ListenAudio[];
  selected: AudioType | null;
  onSelect: (t: AudioType) => void;
  L: ReturnType<typeof useListening>;
  busy: boolean;
  onComplete: () => void;
}) {
  if (audios.length === 0) return <div className="help" style={{ textAlign: "center", padding: "8px 0" }}>이번 주 음원을 준비하고 있어요.</div>;
  const a = audios.find((x) => x.type === selected) ?? audios[0];
  const n = L.plays[a.type] ?? 0;
  const pct = Math.round((L.progress[a.type] ?? 0) * 100);
  return (
    <>
      {audios.length > 1 && (
        <div className="row" style={{ gap: 8 }}>
          {audios.map((x) => (
            <button key={x.type} className={`achip${x.type === a.type ? " on" : ""}`} aria-pressed={x.type === a.type} onClick={() => onSelect(x.type)}>
              {x.label}
              {L.plays[x.type] ? <em>{L.plays[x.type]}회</em> : null}
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <button className="play" onClick={() => L.toggle(a.type)} aria-label={`${a.label} ${L.playing === a.type ? "멈춤" : "재생"}`}>
          {L.playing === a.type ? <PauseIcon /> : <PlayIcon />}
        </button>
        <span className="stack" style={{ gap: 6, flex: 1 }}>
          <span className="bar">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className="between meta">
            <span>
              이번 청독 <b style={{ color: "var(--ink)" }}>{fmtListen(L.session)}</b>
            </span>
            <span style={n ? { color: "var(--deep)", fontWeight: 800 } : undefined}>{n ? `${n}회 들음` : "90% 들으면 1회"}</span>
          </span>
        </span>
      </div>
      <div className="between">
        <div className="rate" role="group" aria-label="속도">
          {RATES.map((r) => (
            <button key={r} className={L.rate === r ? "on" : ""} aria-pressed={L.rate === r} onClick={() => L.setRate(r)}>
              {r}배
            </button>
          ))}
        </div>
        <button className={`chip${L.loop ? " on" : ""}`} style={{ borderRadius: 12, padding: "0 12px" }} aria-pressed={L.loop} onClick={() => L.setLoop(!L.loop)}>
          반복
        </button>
      </div>
      <button className="cta" disabled={!L.passed || busy} onClick={onComplete}>
        {busy ? "청독 카드를 만드는 중…" : L.passed ? "청독 완료" : "음원을 끝까지 들으면 완료할 수 있어요"}
      </button>
    </>
  );
}
