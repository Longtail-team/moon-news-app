// 찬반토론 화면 상태(T07 PR E): 고른 입장·이유·거르기·판 새로 고침. 그리기는 components/debate
import { useCallback, useState } from "react";
import type { DebateBoard, Stance } from "./board";

export function useDebate(initial: DebateBoard | null) {
  const [board, setBoard] = useState<DebateBoard | null>(initial);
  const [picked, setPicked] = useState<Stance | null>(initial?.mine?.stance ?? null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<Stance | "all">("all");

  const refresh = useCallback(async () => {
    if (!board) return;
    try {
      const r = await fetch(`/api/debate/board?week=${board.week_no}`);
      if (r.ok) setBoard(((await r.json()) as { board: DebateBoard }).board);
    } catch {}
  }, [board]);

  const submitted = !!board?.mine;
  const ready = !!board?.question && !submitted && !!picked && reason.trim().length > 0;
  return { board, picked, setPicked: submitted ? () => {} : setPicked, reason, setReason, filter, setFilter, refresh, submitted, ready };
}
