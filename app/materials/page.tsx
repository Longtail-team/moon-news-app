// 이번 주 자료 탭 (spec.md 17장): 주차가 시작되어야 열린다
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pageLearner } from "@/lib/server/learner";
import { getMaterials } from "@/lib/server/materials";
import { MaterialsView } from "@/components/materials/MaterialsView";
import { fmtDay, fmtLive } from "@/lib/format";
import "../student.css";

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { learner } = await pageLearner();
  const w = Number((await searchParams).week);
  const m = await getMaterials(learner.student_id, Number.isInteger(w) && w > 0 ? w : null);
  if (!m) redirect("/");

  const nextOpenLabel = m.next_open
    ? `${m.next_open.week_no}주차 자료는 ${fmtDay(new Date(Date.parse(m.next_open.starts_at) + 9 * 3600e3).toISOString().slice(0, 10))}에 열려요.`
    : null;
  const liveLabels = Object.fromEntries(m.live.map((l) => [l.session_id, fmtLive(l.starts_at)]));
  const kakao = /KAKAOTALK/i.test((await headers()).get("user-agent") ?? "");

  return (
    <MaterialsView
      m={m}
      uploadCount={m.pending_post_count}
      nextOpenLabel={nextOpenLabel}
      liveLabels={liveLabels}
      kakao={kakao}
      now={Date.now()}
    />
  );
}
