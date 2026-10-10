// 청독은 합친 기사 화면으로 옮김(T07, 2026-10-10). 예전 주소(알림톡·홈 화면 바로가기 등)는 새 화면으로 보낸다.
import { redirect } from "next/navigation";
import { articleHref } from "@/lib/article/mode";

export default async function ListenPage({ params }: { params: Promise<{ week: string }> }) {
  redirect(articleHref(Number((await params).week), "listen"));
}
