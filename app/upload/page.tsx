// 인스타 올리기 탭 (spec.md 8장 8단계, 목업 queue): 저장하기 → 인스타에 올리기 → 링크 붙여넣기
import { redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getQueue } from "@/lib/server/reading";
import { UploadQueue } from "@/components/upload/UploadQueue";
import { fmtDay } from "@/lib/format";
import "../student.css";

export default async function UploadPage() {
  const { learner } = await pageLearner();
  const q = await getQueue(learner.student_id);
  if (!q) redirect("/");
  return <UploadQueue queue={q} deadline={fmtDay(q.deadline)} />;
}
