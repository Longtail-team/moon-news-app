// docs/content/week01.md 1문단 (문장 1~4). " / " 단위로 나눈 끊어 읽기 구.

const PARAGRAPH_1 = [
  "What does a pop star collect?",
  "For RM of BTS, / the answer is art.",
  "For the first time, / RM is sharing his personal art collection / in a museum show.",
  'The exhibition, / "RM x SFMOMA: Between You and Me," / is at the San Francisco Museum of Modern Art, / also known as SFMOMA.',
];

export type Phrase = { sentence: number; text: string };

export const PHRASES: Phrase[] = PARAGRAPH_1.flatMap((s, i) => s.split(" / ").map((text) => ({ sentence: i + 1, text })));
