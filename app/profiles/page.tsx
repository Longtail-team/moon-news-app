// 형제 프로필 고르기 (spec.md 3장). 보호자는 홈의 이름 버튼으로 들어와 형제·자매를 추가할 수도 있다(주문 1건당 최대 4명)
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getOnboarding } from "@/lib/server/onboarding";
import { givenName } from "@/lib/format";
import "../student.css";

export default async function Profiles() {
  const session = await getSession();
  if (!session || session.learners.length === 0) redirect("/");
  const openSeats = session.holder === "guardian" ? (await getOnboarding(session.guardianId)).open_seats : 0;
  return (
    <div className="app">
      <div className="scroll">
        <div className="pad stack" style={{ paddingTop: 48, gap: 20 }}>
          <h1 className="h1">누가 학습할까요?</h1>
          <div className="stack" style={{ gap: 10 }}>
            {session.learners.map((l) => (
              <Link key={l.student_id} className="profile" href={`/p/${l.student_id}`} prefetch={false}>
                <span className="avatar">{givenName(l.name).slice(0, 1)}</span>
                <span className="stack" style={{ gap: 2, flex: 1 }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{l.name}</span>
                  {l.grade && <span className="meta">{l.grade}</span>}
                </span>
                <span style={{ fontSize: 18, fontWeight: 800 }}>›</span>
              </Link>
            ))}
            {openSeats > 0 && (
              <Link className="btn2" href="/add-learner" style={{ borderStyle: "dashed", minHeight: 56 }}>
                + 형제·자매 추가
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
