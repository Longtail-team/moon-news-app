// 세션이 없을 때: 알림톡 링크로 들어오도록 안내 (다시 들어가기는 개강 후 작업)
export function Landing({ invalid }: { invalid: boolean }) {
  return (
    <div className="app">
      <div className="scroll">
        <div className="pad stack" style={{ paddingTop: 56, gap: 22 }}>
          <span className="pill" style={{ alignSelf: "flex-start" }}>
            새벽달 영어뉴스
          </span>
          <h1 className="h1" style={{ fontSize: 26 }}>
            12주 낭독 챌린지
          </h1>
          {invalid ? (
            <div className="card stack" style={{ gap: 6, background: "var(--tint)", border: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>이 링크로는 들어올 수 없어요</div>
              <div className="help" style={{ color: "var(--ink)" }}>
                링크가 바뀌었거나 사용할 수 없는 링크예요. 가장 최근에 받은 알림톡의 링크를 눌러 주세요.
              </div>
            </div>
          ) : (
            <div className="help" style={{ fontSize: 15 }}>
              알림톡으로 받은 접속 링크를 눌러 들어와 주세요.
              <br />한 번 들어오면 다음부터는 이 주소만 열어도 돼요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
