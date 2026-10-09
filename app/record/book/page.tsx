// 뉴스북 보기: 진도 중간에도 열람, PDF 받기는 종강 다음 날부터 (2026-10-09)
import { notFound } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getNewsbook } from "@/lib/server/newsbook";
import { BookView } from "@/components/record/BookView";
import "../../student.css";

export default async function BookPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { learner } = await pageLearner();
  const b = await getNewsbook(learner.student_id, (await searchParams).e);
  if (!b) notFound();
  return <BookView b={b} />;
}
