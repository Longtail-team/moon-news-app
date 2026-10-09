// 작성지 사진 글자 읽기 (기자수첩). Claude API로 손글씨를 글자로 옮긴다. 결과는 학생이 확인·수정한 뒤 저장한다.
// 비용 상한: 활동마다 3번(DB ocr_take). 모델은 가장 싼 Haiku로 시작(2026-10-09 결정), OCR_MODEL 환경변수로 바꿀 수 있다.
// 정확도는 수강생 제출이 쌓인 뒤 판단한다. 그 전까지는 학생이 읽은 글자를 보고 "이대로 저장 / 수정"을 고른다.
// 사진은 이 요청에만 보내고 서버에 따로 남기지 않는다. 보호자 동의 문구에 외부 AI 전송을 적어야 한다.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.OCR_MODEL || "claude-haiku-5-5";
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof TYPES)[number];

const PROMPT = `This is a photo of a student's handwritten English news summary worksheet (the student is 10-15 years old).
Transcribe only the student's handwriting, exactly as written: keep their spelling, grammar and line breaks, do not correct or improve anything.
Skip printed text on the worksheet (titles, instructions, labels).
If a word is unreadable, write [?] in its place. If there is no handwriting, reply with nothing.
Reply with the transcription only, no comments.`;

export const ocrEnabled = () => !!process.env.ANTHROPIC_API_KEY;

export class OcrError extends Error {
  constructor(public code: "unsupported" | "refused" | "failed") {
    super(code);
  }
}

let client: Anthropic | null = null;

export async function readHandwriting(image: Blob): Promise<string> {
  const type = image.type as ImageType;
  if (!TYPES.includes(type)) throw new OcrError("unsupported");
  const data = Buffer.from(await image.arrayBuffer()).toString("base64");
  client ??= new Anthropic();
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: type, data } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    if (res.stop_reason === "refusal") throw new OcrError("refused");
    return res.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim()
      .slice(0, 2000);
  } catch (e) {
    if (e instanceof OcrError) throw e;
    if (e instanceof Anthropic.APIError) console.error("ocr", e.status, e.message);
    else console.error("ocr", e instanceof Error ? e.message : e);
    throw new OcrError("failed");
  }
}
