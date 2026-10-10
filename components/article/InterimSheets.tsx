// 임시 시트(T07): 찬반토론은 아직 지금 화면에서 한다. PR E에서 이 화면 안으로 옮기며 지운다.
import Link from "next/link";

export function DebateSheetLink({ week }: { week: number }) {
  return (
    <Link className="cta" href={`/write/${week}/debate`}>
      찬반토론 하러 가기
    </Link>
  );
}
