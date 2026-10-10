// 기사 읽기 흐름(T07): 읽기 시작(녹음과 함께 작성 중 기록) → 읽기를 완료했어요 → 녹음·카드 올리기 → 완료 화면(첫 영어 낭독 안내)
import { useRef, useState } from "react";
import { post } from "@/lib/client-api";
import type { ReadLang } from "@/lib/article/mode";
import { finishReading, type ReadDone } from "./finish";
import type { useRecording } from "./useRecording";

const TYPE: Record<ReadLang, string> = { en: "EN_READING", kr: "KR_READING" };

export function useReadComplete(week: number, R: ReturnType<typeof useRecording>) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ done: ReadDone; sec: number; popup: boolean } | null>(null);
  const activity = useRef<Promise<string> | null>(null);

  async function start(lang: ReadLang) {
    if (!(await R.start())) return;
    const p = post<{ activityId: string }>("/api/activity/start", { week, type: TYPE[lang] }).then((j) => j.activityId);
    p.catch(() => {});
    activity.current = p;
  }

  async function complete() {
    if (!R.result || busy || !activity.current) return;
    setBusy(true);
    R.setError(null);
    try {
      const d = await finishReading(await activity.current, R.result);
      setDone({ done: d, sec: R.result.sec, popup: d.firstEn });
    } catch {
      R.setError("저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. 녹음은 그대로 있어요.");
    } finally {
      setBusy(false);
    }
  }

  return { busy, done, start, complete, popupOk: () => done && setDone({ ...done, popup: false }), clear: () => setDone(null) };
}
