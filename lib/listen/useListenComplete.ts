// 청독 완료 흐름(T07): 청독 완료 → 이해도 평가 창(첫 청독은 필수) → 고르거나 건너뛰면 완료 처리·카드 → 완료 화면
import { useState } from "react";
import { finishListening, type ListenDone } from "./finish";
import type { useListening } from "./useListening";

export function useListenComplete(week: number, L: ReturnType<typeof useListening>, ratingRequired: boolean) {
  const [rateOpen, setRateOpen] = useState(false);
  const [required, setRequired] = useState(ratingRequired);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ListenDone | null>(null);

  function ask() {
    if (!L.passed || busy) return;
    L.pauseAll();
    setRateOpen(true);
  }

  async function complete(understanding: number | null) {
    if (!L.passed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await L.flush();
      const d = await finishListening(week, L.plays, L.session, understanding);
      if (understanding) setRequired(false);
      setDone(d);
    } catch {
      setError("청독 카드를 만들지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. 들은 기록은 남아 있어요.");
    } finally {
      setRateOpen(false);
      setBusy(false);
    }
  }

  return { rateOpen, required, busy, error, done, ask, complete, close: () => !busy && setRateOpen(false), clear: () => setDone(null) };
}
