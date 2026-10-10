// 친구 의견 거르기(T07 PR F, 2026-10-10 결정: 금칙어로 시작, AI 검사는 동의 문구·법률 검토 뒤 설정값으로).
// 걸리면 친구들에게만 숨긴다(쓴 아이에게는 그대로 보이고 학습 1회도 그대로, 숨겼다고 알리지 않음).
// 욕설·비하뿐 아니라 연락처·계정·링크도 숨긴다: 아이 연락처가 다른 아이에게 보이지 않게(CLAUDE.md 개인정보).
// 운영팀이 더할 말이 생기면 WORDS에 넣는다(관리자 화면이 생기면 거기서 고치게 옮김).

/** 금칙어(띄어쓰기·기호를 빼고 비교). 짧은 말은 다른 낱말 속에 들어갈 수 있어 SHORT로 따로 둔다.
 *  보통 말로도 쓰이는 것(새끼 = 동물 새끼, 닥치다 = 닥치는 대로)은 넣지 않는다 */
const WORDS = [
  "시발", "씨발", "씨빨", "시바알", "ㅅㅂ", "ㅆㅂ", "ㅅ1ㅂ", "십새", "병신", "븅신", "ㅂㅅ", "ㅄ", "개새끼", "개새", "ㅅㄲ",
  "좆", "존나", "졸라", "ㅈㄴ", "지랄", "ㅈㄹ", "미친놈", "미친년", "미친새", "꺼져", "닥쳐", "엿먹", "등신", "멍청이", "찐따", "애미", "애비", "느금",
  "fuck", "fck", "shit", "bitch", "asshole", "bastard", "damn", "dick", "idiot", "stupid",
];
/** 낱말 단위로만 거를 짧은 영어(다른 낱말 속 글자로 오인하지 않게) */
const SHORT = ["ass", "wtf", "stfu", "fu"];

const norm = (t: string) => t.toLowerCase().replace(/[\s._\-~!?,'"`·*^()[\]{}<>|/\\:;+=]/g, "");

/** 연락처·계정·링크: 전화번호(숫자 9자리 이상), 이메일, @아이디, 주소 */
const CONTACT = [/(?:\d[\s-]?){9,}/, /[\w.+-]+@[\w-]+\.[\w.]+/, /(^|\s)@[a-z0-9_.]{3,}/i, /https?:\/\/|www\.|\.(com|net|kr|io|me)\b/i, /카톡|카카오톡\s*아이디|인스타\s*아이디|전화번호|폰번호/];

export type FilterResult = { hide: boolean; why: "word" | "contact" | null };

export function checkOpinion(text: string): FilterResult {
  const t = text ?? "";
  if (CONTACT.some((re) => re.test(t))) return { hide: true, why: "contact" };
  const n = norm(t);
  if (WORDS.some((w) => n.includes(norm(w)))) return { hide: true, why: "word" };
  const tokens = t.toLowerCase().split(/[^a-z]+/);
  if (SHORT.some((w) => tokens.includes(w))) return { hide: true, why: "word" };
  return { hide: false, why: null };
}
