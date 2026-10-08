// 학습자 추가: 주문 수량 중 등록하지 않은 자리(형제)를 나중에 등록한다. 등록 후 홈에서 3단계(접속 방법·동의)가 이어진다.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getOnboarding } from "@/lib/server/onboarding";
import { AddLearner } from "@/components/onboarding/AddLearner";
import "../student.css";

export default async function AddLearnerPage() {
  const session = await getSession();
  if (!session || session.holder !== "guardian") redirect("/");
  const ob = await getOnboarding(session.guardianId);
  if (ob.open_seats === 0) redirect("/");
  return <AddLearner state={ob} />;
}
