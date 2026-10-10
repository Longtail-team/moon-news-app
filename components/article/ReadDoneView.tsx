// 읽기 완료 화면(T07 PR C): 읽기 완료 카드(인스타용) 미리보기. 인스타에는 이 카드에 녹음을 입힌 영상으로 올린다(영상 만들기는 2단계 V01).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FirstReadingPopup } from "@/components/reading/FirstReadingPopup";
import type { ReadDone } from "@/lib/reading/finish";

export function ReadDoneView({
  week,
  weeklyTarget,
  done,
  firstPopup,
  learnerName,
  deadline,
  recordSec,
  onPopupOk,
  onBack,
}: {
  week: number;
  weeklyTarget: number;
  done: ReadDone;
  firstPopup: boolean;
  learnerName: string;
  deadline: string;
  recordSec: number;
  onPopupOk: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  return (
    <div className="app">
      <div className="scroll">
        <div className="pad stack" style={{ paddingTop: 24, gap: 16 }}>
          <h1 className="h1">읽기 완료!</h1>
          <div className="help">
            {week}주차 학습 {Math.min(done.weekCompleted, weeklyTarget)} / {weeklyTarget}. 인스타 올리기에서 영상을 저장해 올리면 인증돼요.
          </div>
          {done.card && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={done.card.url} alt="읽기 완료 카드" style={{ width: "100%", aspectRatio: "4 / 5", borderRadius: 16, border: "1px solid var(--line)" }} />
              <div className="help" style={{ textAlign: "center" }}>
                이 카드에 내 목소리를 입혀 영상으로 올려요
              </div>
            </>
          )}
        </div>
      </div>
      <div className="bottom stack" style={{ gap: 10 }}>
        <Link className="cta" href="/upload">
          인스타 올리기
        </Link>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="btn2" onClick={onBack}>
            기사로 돌아가기
          </button>
          <button className="btn2" onClick={() => router.push(`/?done=${done.weekNo}-${done.weekCompleted}`)}>
            홈으로
          </button>
        </div>
      </div>
      {firstPopup && <FirstReadingPopup learnerName={learnerName} deadline={deadline} sec={recordSec} onOk={onPopupOk} />}
    </div>
  );
}
