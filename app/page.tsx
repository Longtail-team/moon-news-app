import { redirect } from "next/navigation";
import { currentLearner, getSession } from "@/lib/server/session";
import { getHome } from "@/lib/server/home";
import { HomeView } from "@/components/student/HomeView";
import { Landing } from "@/components/student/Landing";
import "./student.css";

export default async function Home({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const session = await getSession();
  if (!session) return <Landing invalid={(await searchParams).link === "invalid"} />;
  const learner = await currentLearner(session);
  if (!learner) redirect("/profiles");
  const home = await getHome(learner.student_id);
  if (!home) return <Landing invalid />;
  return <HomeView home={home} learner={learner} canSwitch={session.learners.length > 1} now={Date.now()} />;
}
