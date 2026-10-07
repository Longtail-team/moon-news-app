import { redirect } from "next/navigation";
import { currentLearner, getSession } from "@/lib/server/session";
import { getHome } from "@/lib/server/home";
import { HomeView } from "@/components/student/HomeView";
import { Landing } from "@/components/student/Landing";
import "./student.css";

export default async function Home({ searchParams }: { searchParams: Promise<{ link?: string; done?: string }> }) {
  const session = await getSession();
  const sp = await searchParams;
  if (!session) return <Landing invalid={sp.link === "invalid"} />;
  const learner = await currentLearner(session);
  if (!learner) redirect("/profiles");
  const home = await getHome(learner.student_id);
  if (!home) return <Landing invalid />;
  // 학습 완료 직후: ?done=주차-완료수
  const [w, n] = (sp.done ?? "").split("-").map(Number);
  const toast = w > 0 && n > 0 ? `${w}주차 학습 ${Math.min(n, home.cohort.weekly_target)} / ${home.cohort.weekly_target} 완료!` : null;
  return <HomeView home={home} learner={learner} canSwitch={session.learners.length > 1} now={Date.now()} toast={toast} />;
}
