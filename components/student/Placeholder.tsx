// 아직 만들지 않은 화면 (다음 작업에서 채운다)
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentLearner, getSession } from "@/lib/server/session";
import { getHome } from "@/lib/server/home";
import { TabBar } from "./TabBar";

export async function Placeholder({ title, tab }: { title: string; tab: "home" | "materials" | "upload" }) {
  const session = await getSession();
  if (!session) redirect("/");
  const learner = await currentLearner(session);
  if (!learner) redirect("/profiles");
  const home = await getHome(learner.student_id);
  return (
    <div className="app">
      <div className="scroll">
        <div className="topbar">
          <Link className="back" href="/">
            ‹ 홈
          </Link>
        </div>
        <div className="pad stack" style={{ gap: 12 }}>
          <h1 className="h1">{title}</h1>
          <div className="card help">이 화면은 다음 작업에서 만들어요.</div>
        </div>
      </div>
      <TabBar active={tab} uploadCount={home?.progress.pending_post_count ?? 0} />
    </div>
  );
}
