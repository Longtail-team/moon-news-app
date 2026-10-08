// 형제 프로필 고르기 (spec.md 3장: 접속 시 프로필을 고른다)
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { givenName } from "@/lib/format";
import "../student.css";

export default async function Profiles() {
  const session = await getSession();
  if (!session || session.learners.length === 0) redirect("/");
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
          </div>
        </div>
      </div>
    </div>
  );
}
