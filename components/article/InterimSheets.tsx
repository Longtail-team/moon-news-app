// 임시 시트(T07 PR B): 기사 읽기·찬반토론은 아직 지금 화면에서 한다. PR C(기사 읽기)·E(찬반토론)에서 이 화면 안으로 옮기며 지운다.
import Link from "next/link";
import { ActIcon } from "@/components/student/icons";

export function ReadSheetLinks({ week }: { week: number }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Link className="achip" href={`/read/${week}/kr`}>
          <ActIcon type="KR_READING" size={18} />
          한국어로 읽기
        </Link>
        <Link className="achip" href={`/read/${week}/en`}>
          <ActIcon type="EN_READING" size={18} />
          영어로 읽기
        </Link>
      </div>
      <div className="help" style={{ textAlign: "center" }}>
        읽을 언어를 고르면 녹음 화면으로 가요
      </div>
    </div>
  );
}

export function DebateSheetLink({ week }: { week: number }) {
  return (
    <Link className="cta" href={`/write/${week}/debate`}>
      찬반토론 하러 가기
    </Link>
  );
}
