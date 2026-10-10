// 평가 창(아래에서 올라오는 시트): 청독 이해도 5단계·토론 주제 반응 4가지가 함께 쓴다.
// 필수일 때는 건너뛰기가 없고 바깥을 눌러도 닫히지 않는다.
export function RatingSheet({
  title,
  help,
  options,
  numbered = false,
  required,
  onPick,
  onSkip,
  busy = false,
  label,
}: {
  title: string;
  help: string;
  options: (string | [string, string])[];
  numbered?: boolean;
  required: boolean;
  onPick: (value: number) => void; // 1부터
  onSkip?: () => void;
  busy?: boolean;
  label: string;
}) {
  return (
    <>
      <div className="dim" onClick={() => !required && !busy && onSkip?.()} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="handle" />
        <h2 className="h1" style={{ fontSize: 22 }}>
          {title}
        </h2>
        <div className="help" style={{ fontSize: 14 }}>
          {help}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {options.map((o, i) => {
            const [t, s] = typeof o === "string" ? [o, null] : o;
            return (
              <button key={i} className="r5" disabled={busy} onClick={() => onPick(i + 1)}>
                {numbered && <b>{i + 1}</b>}
                <span className="stack" style={{ gap: 2 }}>
                  <span>{t}</span>
                  {s && <span className="r5sub">{s}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {!required && onSkip && (
          <button className="btn2" disabled={busy} onClick={onSkip}>
            건너뛰기
          </button>
        )}
      </div>
    </>
  );
}
