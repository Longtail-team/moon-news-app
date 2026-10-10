// 찬반토론 의견 내기 흐름(T07 PR E): 의견 내기 → 토론 주제 반응 창(그 주차 첫 토론은 필수) → 저장·토론 카드 → 완료 화면
import { useState } from "react";
import { finishDebate, type DebateDone } from "./finish";
import type { useDebate } from "./useDebate";

export function useDebateSubmit(D: ReturnType<typeof useDebate>, reporter: string, feelRequired: boolean) {
  const [feelOpen, setFeelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DebateDone | null>(null);

  function ask() {
    if (!D.ready || busy) return;
    setFeelOpen(true);
  }

  async function submit(feel: number | null) {
    if (!D.board || !D.picked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const d = await finishDebate({ board: D.board, stance: D.picked, reason: D.reason, feel, reporter });
      setDone(d);
      await D.refresh();
    } catch {
      setError("의견을 내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
    } finally {
      setFeelOpen(false);
      setBusy(false);
    }
  }

  return { feelOpen, required: feelRequired, busy, error, done, ask, submit, close: () => !busy && setFeelOpen(false), clear: () => setDone(null) };
}
