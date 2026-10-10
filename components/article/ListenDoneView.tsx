// 청독 완료 화면: 인스타용 카드 미리보기·저장 (기존 ListenView에서 옮김)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveFile } from "@/lib/video";
import type { ListenDone } from "@/lib/listen/finish";

export function ListenDoneView({ week, weeklyTarget, done, onBack }: { week: number; weeklyTarget: number; done: ListenDone; onBack: () => void }) {
  const router = useRouter();
  return (
    <div className="app">
      <div className="scroll">
        <div className="pad stack" style={{ paddingTop: 24, gap: 16 }}>
          <h1 className="h1">청독 완료!</h1>
          <div className="help">
            {week}주차 학습 {Math.min(done.weekCompleted, weeklyTarget)} / {weeklyTarget}. 카드를 저장해서 인스타에 올리면 인증돼요.
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={done.url} alt="청독 카드" style={{ width: "100%", aspectRatio: "4 / 5", borderRadius: 16, border: "1px solid var(--line)" }} />
        </div>
      </div>
      <div className="bottom stack" style={{ gap: 10 }}>
        <button className="cta" onClick={() => void saveFile(done.file)}>
          카드 저장
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Link className="btn2" href="/upload">
            인스타 올리기
          </Link>
          <button className="btn2" onClick={() => router.push(`/?done=${week}-${done.weekCompleted}`)}>
            홈으로
          </button>
        </div>
        <button className="textbtn" style={{ textDecoration: "none", color: "var(--deep)", alignSelf: "center" }} onClick={onBack}>
          기사로 돌아가서 기사 읽기·찬반토론 하기 ›
        </button>
      </div>
    </div>
  );
}
