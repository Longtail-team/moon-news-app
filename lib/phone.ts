// 휴대폰 번호: 숫자만 저장한다(spec 16장). 화면에는 가운데를 가린다.
export function normalizePhone(input: string): string | null {
  const d = input.replace(/\D/g, "");
  return /^01[0-9]{8,9}$/.test(d) ? d : null;
}

/** "01012345678" → "010-****-5678" */
export function maskPhone(p: string): string {
  return p.length >= 10 ? `${p.slice(0, 3)}-****-${p.slice(-4)}` : p;
}
