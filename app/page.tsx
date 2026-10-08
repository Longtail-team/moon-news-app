import { redirect } from "next/navigation";
import { currentLearner, getSession } from "@/lib/server/session";
import { getHome } from "@/lib/server/home";
import { getOnboarding } from "@/lib/server/onboarding";
import { HomeView } from "@/components/student/HomeView";
import { Landing } from "@/components/student/Landing";
import { Onboarding } from "@/components/onboarding/Onboarding";
import "./student.css";

export default async function Home({ searchParams }: { searchParams: Promise<{ link?: string; done?: string; k?: string; ok?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  // 홈 화면 아이콘(/?k=<링크>)으로 열었는데 세션이 없으면 그 링크로 한 번만 다시 들어온다
  if (!session && sp.k && !sp.ok) redirect(`/a/${encodeURIComponent(sp.k)}?again=1`);
  if (!session) return <Landing invalid={sp.link === "invalid"} cookieBlocked={!!sp.ok} />;

  // 보호자: 첫 접속 3단계가 끝나지 않았으면 홈 대신 (주소는 그대로 두어 홈 화면 추가 때 링크가 담기게)
  if (session.holder === "guardian") {
    const ob = await getOnboarding(session.guardianId);
    if (ob.step !== "done") return <Onboarding state={ob} />;
  }
  if (session.learners.length === 0) return <Landing invalid />;

  const learner = await currentLearner(session);
  if (!learner) redirect("/profiles");
  const home = await getHome(learner.student_id);
  if (!home) return <Landing invalid />;
  // 학습 완료 직후: ?done=주차-완료수
  const [w, n] = (sp.done ?? "").split("-").map(Number);
  const toast = w > 0 && n > 0 ? `${w}주차 학습 ${Math.min(n, home.cohort.weekly_target)} / ${home.cohort.weekly_target} 완료!` : null;
  return <HomeView home={home} learner={learner} canSwitch={session.learners.length > 1} now={Date.now()} toast={toast} />;
}
