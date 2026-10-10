// 합친 기사 화면의 상태 규칙(T07, 2026-10-10 결정). 화면 없이 테스트하는 순수 함수만.
// 지문은 한 화면에 한 번, 아래 시트에서 청독 / 기사 읽기 / 찬반토론을 바꾼다.

export type Mode = "listen" | "read" | "debate";
export type View = "en" | "both" | "ko"; // 지문 보기: 영어만 / 한·영 / 한국어만
export type ReadLang = "en" | "kr";

const MODES: Mode[] = ["listen", "read", "debate"];

/** 주소의 ?mode= 값. 모르는 값이면 청독 */
export const parseMode = (v: string | null | undefined): Mode => (MODES.includes(v as Mode) ? (v as Mode) : "listen");

/** 주소의 ?lang= 값(기사 읽기). 모르는 값이면 영어 */
export const parseLang = (v: string | null | undefined): ReadLang => (v === "kr" ? "kr" : "en");

/** 시트에 맞춘 기본 지문 보기: 청독·찬반토론은 한·영, 기사 읽기는 읽는 언어만 */
export const defaultView = (mode: Mode, lang: ReadLang): View => (mode === "read" ? (lang === "en" ? "en" : "ko") : "both");

/** ArticleText에 넘길 값: 주인 언어와 주인만 보기 */
export const viewProps = (v: View) => ({ en: v !== "ko", onlyMain: v !== "both" });

/** 끊어 읽기 표시는 영어가 보일 때만 고를 수 있다 */
export const canSlash = (v: View) => v !== "ko";

/** 이 화면 주소 */
export const articleHref = (week: number, mode: Mode = "listen", lang?: ReadLang) =>
  `/article/${week}${mode === "listen" ? "" : `?mode=${mode}${mode === "read" && lang ? `&lang=${lang}` : ""}`}`;
