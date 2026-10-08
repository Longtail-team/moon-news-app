// 콘텐츠 시트 → 주차별 반영 데이터 + 검사 결과 (docs/tasks/T05-콘텐츠-시트-반영.md)
// 순수 함수만 둔다(구글·DB 접근 없음). GitHub Actions의 scripts/sync-content.mjs와 테스트가 함께 쓴다.
// 열은 순서가 아니라 머리글 이름으로 찾는다(운영자가 열 순서를 바꿔도 된다).

export const TABS = { article: "기사", sentence: "문장", vocab: "단어", item: "추가 자료", live: "라이브" };

const STATUS = { 초안: "draft", 검수완료: "reviewed", 공개: "published" };
const KIND = { 링크: "link", 안내: "text" };
export const FILE_COLUMNS = {
  "자료 PDF": "article_pdf",
  "영어 음원": "article_audio",
  "한영 구간반복": "kr_en_repeat_audio",
  "VOCA 구간반복": "voca_repeat_audio",
  "인스타 템플릿": "insta_template",
};

/** 머리글 이름(앞부분이 같으면 됨: "영어 (끊어 읽기 ...)" → "영어")으로 행을 객체로 */
export function toRecords(values) {
  if (!values || values.length === 0) return [];
  const header = values[0].map((h) => String(h ?? "").trim());
  return values
    .slice(1)
    .map((row, i) => {
      const rec = { _row: i + 2 };
      header.forEach((h, c) => (rec[h] = String(row[c] ?? "").trim()));
      return rec;
    })
    .filter((r) => Object.entries(r).some(([k, v]) => k !== "_row" && v !== ""));
}

const pick = (rec, name) => {
  if (name in rec) return rec[name];
  const k = Object.keys(rec).find((h) => h.startsWith(name));
  return k ? rec[k] : "";
};
const int = (v) => (/^\d+$/.test(v) ? Number(v) : null);

/**
 * @param tabs {기사, 문장, 단어, 추가 자료, 라이브}: 시트 값(2차원 배열)
 * @param ctx { weeks: [{week_no, starts_at}], now: Date, files: Map<파일명, {id, md5}> }
 * @returns { weeks: [{week_no, status, payload, files[], errors[], warnings[], skip}], live: [...], liveErrors: [], globalErrors: [] }
 */
export function buildSync(tabs, ctx) {
  const globalErrors = [];
  const articles = toRecords(tabs[TABS.article]);
  const sentences = toRecords(tabs[TABS.sentence]);
  const vocab = toRecords(tabs[TABS.vocab]);
  const items = toRecords(tabs[TABS.item]);
  const lives = toRecords(tabs[TABS.live]);
  const cohortWeeks = new Map(ctx.weeks.map((w) => [w.week_no, w]));

  if (articles.length === 0) globalErrors.push("기사 탭에 주차가 없어요");
  const seenWeeks = new Set();
  const out = [];

  for (const a of articles) {
    const errors = [];
    const warnings = [];
    const week = int(pick(a, "주차"));
    if (!week) {
      globalErrors.push(`기사 ${a._row}행: 주차가 숫자가 아니에요`);
      continue;
    }
    if (seenWeeks.has(week)) {
      globalErrors.push(`기사 ${a._row}행: ${week}주차가 두 번 있어요`);
      continue;
    }
    seenWeeks.add(week);
    if (!cohortWeeks.has(week)) {
      globalErrors.push(`기사 ${a._row}행: ${week}주차는 이 기수에 없어요`);
      continue;
    }

    const statusLabel = pick(a, "상태") || "초안";
    const status = STATUS[statusLabel];
    if (!status) errors.push(`상태 "${statusLabel}"는 초안/검수완료/공개 중 하나여야 해요`);
    const title = pick(a, "영어 제목");
    if (!title) errors.push("영어 제목이 비어 있어요");
    if (/\s\/\s/.test(title)) warnings.push('영어 제목에 " / "가 있어요. 부제는 부제 칸에 써 주세요');

    // 문장
    const ss = sentences
      .filter((s) => int(pick(s, "주차")) === week)
      .map((s) => ({ row: s._row, para_no: int(pick(s, "문단")), sent_no: int(pick(s, "문장")), en: pick(s, "영어"), ko: pick(s, "한국어") }));
    if (ss.length === 0) errors.push("문장이 하나도 없어요");
    const nos = new Set();
    for (const s of ss) {
      if (!s.para_no || !s.sent_no) errors.push(`문장 ${s.row}행: 문단·문장 번호가 숫자가 아니에요`);
      else if (nos.has(s.sent_no)) errors.push(`문장 ${s.row}행: 문장 번호 ${s.sent_no}가 겹쳐요`);
      else nos.add(s.sent_no);
      if (!s.en) errors.push(`문장 ${s.row}행: 영어가 비어 있어요`);
      if (!s.ko) errors.push(`문장 ${s.row}행: 한국어가 비어 있어요`);
      if (s.en && /(\S\/|\/\S)/.test(s.en.replace(/\s\/\s/g, " "))) warnings.push(`문장 ${s.row}행: 끊어 읽기는 앞뒤를 띄운 " / "로 써 주세요`);
    }

    // 단어
    const vs = vocab
      .filter((v) => int(pick(v, "주차")) === week)
      .map((v) => ({ row: v._row, no: int(pick(v, "번호")), word: pick(v, "단어"), meaning: pick(v, "뜻"), example: pick(v, "예문") }));
    for (const v of vs) {
      if (!v.no) errors.push(`단어 ${v.row}행: 번호가 숫자가 아니에요`);
      if (!v.word || !v.meaning) errors.push(`단어 ${v.row}행: 단어와 뜻을 모두 써 주세요`);
    }

    // 추가 자료
    const is = items
      .filter((i) => int(pick(i, "주차")) === week)
      .map((i) => ({ row: i._row, sort_no: int(pick(i, "순서")), kindLabel: pick(i, "종류"), title: pick(i, "제목"), url: pick(i, "링크"), body: pick(i, "내용") }));
    for (const i of is) {
      i.kind = KIND[i.kindLabel];
      if (!i.sort_no) errors.push(`추가 자료 ${i.row}행: 순서가 숫자가 아니에요`);
      if (!i.kind) errors.push(`추가 자료 ${i.row}행: 종류는 링크/안내 중 하나여야 해요`);
      if (!i.title) errors.push(`추가 자료 ${i.row}행: 제목이 비어 있어요`);
      if (i.kind === "link" && !/^https:\/\//.test(i.url)) errors.push(`추가 자료 ${i.row}행: 링크는 https:// 로 시작해야 해요`);
      if (i.kind === "text") i.url = "";
    }

    // 파일 (시트에는 파일명만)
    const files = [];
    for (const [col, type] of Object.entries(FILE_COLUMNS)) {
      const name = pick(a, col);
      if (!name) continue;
      const f = ctx.files.get(name);
      if (!f) errors.push(`${col} "${name}" 파일이 자료 폴더에 없어요`);
      else files.push({ type, file_name: name, source_file_id: f.id, source_md5: f.md5, mime: f.mimeType });
    }

    // 공개일이 지났는데 공개가 아님
    const cw = cohortWeeks.get(week);
    if (status !== "published" && new Date(cw.starts_at) <= ctx.now) warnings.push(`${week}주차가 이미 시작됐지만 상태가 공개가 아니라서 학생에게 안 보여요(상태: ${statusLabel})`);

    // 공개 주차에 문제가 있으면 반영하지 않는다(이전 상태 유지). 초안·검수완료는 학생에게 안 보이므로 반영하고 경고로 남긴다.
    const skip = status === "published" && errors.length > 0;
    if (!skip && status !== "published") {
      warnings.push(...errors);
      errors.length = 0;
    }

    out.push({
      week_no: week,
      status: status ?? "draft",
      skip,
      errors,
      warnings,
      files,
      payload: {
        title_en: title || `${week}주차`,
        subtitle: pick(a, "부제"),
        title_ko: pick(a, "한국어 제목"),
        word_count: int(pick(a, "단어 수")) ?? "",
        level: pick(a, "렉사일"),
        ar_level: pick(a, "AR"),
        status: status ?? "draft",
        sentences: ss.filter((s) => s.para_no && s.sent_no && s.en).map(({ para_no, sent_no, en, ko }) => ({ para_no, sent_no, en, ko })),
        vocab: vs.filter((v) => v.no && v.word && v.meaning).map(({ no, word, meaning, example }) => ({ no, word, meaning, example })),
        items: is.filter((i) => i.sort_no && i.kind && i.title && (i.kind === "text" || /^https:\/\//.test(i.url))).map(({ sort_no, kind, title, url, body }) => ({ sort_no, kind, title, url, body })),
      },
    });
  }

  // 라이브: "2026-10-24 20:00" (한국 시간)
  const live = [];
  const liveErrors = [];
  for (const l of lives) {
    const no = int(pick(l, "회차"));
    const at = pick(l, "일시");
    const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/.exec(at);
    if (!no || !m) {
      liveErrors.push(`라이브 ${l._row}행: 회차는 숫자, 일시는 "2026-10-24 20:00" 형식이어야 해요`);
      continue;
    }
    const zoom = pick(l, "줌 링크");
    const replay = pick(l, "다시보기 링크");
    if ((zoom && !/^https:\/\//.test(zoom)) || (replay && !/^https:\/\//.test(replay))) {
      liveErrors.push(`라이브 ${l._row}행: 링크는 https:// 로 시작해야 해요`);
      continue;
    }
    live.push({ session_no: no, starts_at: `${m[1]}-${m[2]}-${m[3]}T${m[4].padStart(2, "0")}:${m[5]}:00+09:00`, zoom_url: zoom, replay_url: replay });
  }

  return { weeks: out.sort((x, y) => x.week_no - y.week_no), live, liveErrors, globalErrors };
}

/** 파일 저장 경로: 같은 원본이면 같은 경로, 바뀌면 새 경로(브라우저 캐시 허용, spec 17장) */
export function storageKey(cohortNo, week, type, fileName, md5) {
  const ext = (fileName.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? "bin").toLowerCase();
  return `cohort-${cohortNo}/week${String(week).padStart(2, "0")}/${type}-${String(md5).slice(0, 12)}.${ext}`;
}
