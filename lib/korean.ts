// 이름 뒤 조사: 받침이 있으면 "도윤이가", 없으면 "지우가"
export function withGa(name: string): string {
  const c = name.charCodeAt(name.length - 1);
  const batchim = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return batchim ? `${name}이가` : `${name}가`;
}

/** 출생 연월 → 학년 (3월 새 학년). DB의 app.grade_label과 같은 규칙 */
export function gradeLabel(year: number, now = new Date()): string | null {
  const kst = new Date(now.getTime() + 9 * 3600e3);
  const schoolYear = kst.getUTCFullYear() - (kst.getUTCMonth() + 1 < 3 ? 1 : 0);
  const g = schoolYear - year - 6;
  if (g >= 1 && g <= 6) return `초${g}`;
  if (g >= 7 && g <= 9) return `중${g - 6}`;
  if (g >= 10 && g <= 12) return `고${g - 9}`;
  return null;
}

export const GRADES = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3"];

/** 학년 뒤 조사: "초5로", "중3으로" (숫자 읽기: 3 삼, 6 육은 받침 → 으로, 1 일은 ㄹ → 로) */
export function withRo(grade: string): string {
  return /[36]$/.test(grade) ? `${grade}으로` : `${grade}로`;
}
