// 화면 표시용 날짜·이름 (한국 시간 기준)
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function kstParts(d: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "numeric", minute: "numeric", hour12: false })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { m: Number(p.month), d: Number(p.day), dow, hour: Number(p.hour) % 24, minute: Number(p.minute) };
}

/** "2026-12-06" → "12월 6일(일)" */
export function fmtDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}월 ${d}일(${DOW[dow]})`;
}

/** 주차 기간: "10월 5일 – 11일" / "9월 28일 – 10월 4일" (끝 시각은 다음 주 월 0시라 하루 뺀다) */
export function fmtWeekRange(startsAt: string, endsAt: string): string {
  const a = kstParts(new Date(startsAt));
  const b = kstParts(new Date(Date.parse(endsAt) - 1000));
  return a.m === b.m ? `${a.m}월 ${a.d}일 – ${b.d}일` : `${a.m}월 ${a.d}일 – ${b.m}월 ${b.d}일`;
}

/** "10월 8일(목) 저녁 8시" */
export function fmtLive(iso: string): string {
  const p = kstParts(new Date(iso));
  const h = p.hour;
  const part = h < 12 ? "오전" : h < 18 ? "오후" : "저녁";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${p.m}월 ${p.d}일(${DOW[p.dow]}) ${part} ${h12}시${p.minute ? ` ${p.minute}분` : ""}`;
}

/** 부르는 이름: "김지우" → "지우", "남궁민수" → "민수"(네 글자는 두 글자 성으로 본다), 두 글자·다섯 글자 이상은 그대로 */
export function givenName(name: string): string {
  const n = name.trim();
  if (n.length === 3) return n.slice(1);
  if (n.length === 4) return n.slice(2);
  return n;
}

/** "10월 3일" (한국 시간) */
export function fmtMonthDay(iso: string): string {
  const p = kstParts(new Date(iso));
  return `${p.m}월 ${p.d}일`;
}
