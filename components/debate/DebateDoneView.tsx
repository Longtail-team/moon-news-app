// 토론 완료 화면: 인스타용 토론 카드(개인 의견 없음) 미리보기·저장
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveFile } from "@/lib/video";
import type { DebateDone } from "@/lib/debate/finish";

export function DebateDoneView({ weeklyTarget, done, onBack }: { weeklyTarget: number; done: DebateDone; onBack: () => void }) {
  const router = useRouter();
  return (
    <div className="app">
      <div className="scroll">
        <div className="pad stack" style={{ paddingTop: 24, gap: 16 }}>
          <h1 className="h1">토론 완료!</h1>
          <div className="help">
            {done.weekNo}주차 학습 {Math.min(done.weekCompleted, weeklyTarget)} / {weeklyTarget}. 카드를 저장해서 인스타에 올리면 인증돼요.
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={done.card.url} alt="토론 카드" style={{ width: "100%", aspectRatio: "4 / 5", borderRadius: 16, border: "1px solid var(--line)" }} />
          <div className="help" style={{ textAlign: "center" }}>
            내 입장과 이유는 카드에 들어가지 않아요. 앱과 뉴스북에만 저장돼요.
          </div>
        </div>
      </div>
      <div className="bottom stack" style={{ gap: 10 }}>
        <button className="cta" onClick={() => void saveFile(done.card.file)}>
          카드 저장
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Link className="btn2" href="/upload">
            인스타 올리기
          </Link>
          <button className="btn2" onClick={() => router.push(`/?done=${done.weekNo}-${done.weekCompleted}`)}>
            홈으로
          </button>
        </div>
        <button className="textbtn" style={{ textDecoration: "none", color: "var(--deep)", alignSelf: "center" }} onClick={onBack}>
          친구들 생각 보기 ›
        </button>
      </div>
    </div>
  );
}
