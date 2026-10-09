// 콘텐츠 시트 반영 함수: 주차 하나를 한 번에, 같은 원본 파일은 다시 올리지 않음
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;
let cohort: string;

const payload = (over: Record<string, unknown> = {}) => ({
  title_en: "Man Who Found Cash in the Trash Gets to Keep It",
  subtitle: "No one claimed the money within six months",
  title_ko: "",
  word_count: 190,
  level: "",
  ar_level: "",
  status: "draft",
  sentences: [
    { para_no: 1, sent_no: 1, en: "Imagine opening a trash bag / and finding stacks of cash.", ko: "" },
    { para_no: 1, sent_no: 2, en: "That really happened to a man in his 60s / in Incheon, South Korea.", ko: "" },
  ],
  vocab: [{ no: 1, word: "bundle", meaning: "묶음", example: "" }],
  items: [{ sort_no: 1, kind: "text", title: "안내", url: "", body: "본문" }],
  assets: [{ type: "article_pdf", file_name: "week02.pdf", storage_key: "cohort-1/week02/article_pdf-aaa.pdf", source_file_id: "F2", source_md5: "aaa" }],
  ...over,
});

beforeAll(async () => {
  db = await createDb();
  [{ cohort_id: cohort }] = (await db.query<Row>("select cohort_id from cohorts where cohort_no = 1")).rows as { cohort_id: string }[];
});

describe("sync_week", () => {
  it("기존 2주차 기사를 시트 내용으로 바꾸고, 문장·단어·추가 자료를 통째로 교체", async () => {
    const id = (await db.query<Row>("select public.sync_week($1, 2, $2) as id", [cohort, JSON.stringify(payload())])).rows[0].id;
    const a = (await db.query<Row>("select title_en, subtitle, word_count, status from articles where article_id = $1", [id])).rows[0];
    expect(a).toEqual({ title_en: "Man Who Found Cash in the Trash Gets to Keep It", subtitle: "No one claimed the money within six months", word_count: 190, status: "draft" });
    expect((await db.query<Row>("select count(*)::int as n from sentences where article_id = $1", [id])).rows[0].n).toBe(2);
    expect((await db.query<Row>("select article_id from cohort_weeks where cohort_id = $1 and week_no = 2", [cohort])).rows[0].article_id).toBe(id);

    // 문장을 줄여 다시 반영하면 그대로 따라간다
    await db.query("select public.sync_week($1, 2, $2)", [cohort, JSON.stringify(payload({ sentences: [{ para_no: 1, sent_no: 1, en: "Only one.", ko: "하나" }] }))]);
    expect((await db.query<Row>("select count(*)::int as n from sentences where article_id = $1", [id])).rows[0].n).toBe(1);
  });

  it("같은 원본 파일이면 version을 늘리지 않고, 바뀌면 새 version", async () => {
    const versions = async () =>
      (await db.query<Row>(
        "select a.version, a.source_md5 from assets a join cohort_weeks w on w.article_id = a.article_id where w.cohort_id = $1 and w.week_no = 2 and a.type = 'article_pdf' order by a.version",
        [cohort],
      )).rows;
    await db.query("select public.sync_week($1, 2, $2)", [cohort, JSON.stringify(payload())]);
    expect(await versions()).toEqual([{ version: 1, source_md5: "aaa" }]);
    await db.query("select public.sync_week($1, 2, $2)", [cohort, JSON.stringify(payload({ assets: [{ type: "article_pdf", file_name: "week02.pdf", storage_key: "cohort-1/week02/article_pdf-bbb.pdf", source_file_id: "F2", source_md5: "bbb" }] }))]);
    expect(await versions()).toEqual([{ version: 1, source_md5: "aaa" }, { version: 2, source_md5: "bbb" }]);
    const state = (await db.query<Row>("select public.sync_asset_state($1) as s", [cohort])).rows[0].s as any[];
    expect(state.find((x) => x.week_no === 2 && x.type === "article_pdf")).toMatchObject({ source_md5: "bbb" });
  });

  it("기사가 없는 주차는 새로 만들어 연결", async () => {
    await db.query("update cohort_weeks set article_id = null where cohort_id = $1 and week_no = 12", [cohort]);
    const id = (await db.query<Row>("select public.sync_week($1, 12, $2) as id", [cohort, JSON.stringify(payload({ assets: [] }))])).rows[0].id;
    expect((await db.query<Row>("select article_id from cohort_weeks where cohort_id = $1 and week_no = 12", [cohort])).rows[0].article_id).toBe(id);
  });

  it("없는 주차는 오류, 잘못된 링크는 함께 되돌린다(전부 되거나 전부 안 되거나)", async () => {
    await expect(db.query("select public.sync_week($1, 13, $2)", [cohort, JSON.stringify(payload())])).rejects.toThrow(/not in cohort/);
    const before = (await db.query<Row>("select title_en from articles a join cohort_weeks w using (article_id) where w.cohort_id = $1 and w.week_no = 2", [cohort])).rows[0];
    await expect(
      db.query("select public.sync_week($1, 2, $2)", [cohort, JSON.stringify(payload({ title_en: "Changed", items: [{ sort_no: 1, kind: "link", title: "x", url: "http://bad", body: "" }] }))]),
    ).rejects.toThrow();
    const after = (await db.query<Row>("select title_en from articles a join cohort_weeks w using (article_id) where w.cohort_id = $1 and w.week_no = 2", [cohort])).rows[0];
    expect(after).toEqual(before);
  });

  it("라이브: 회차 기준으로 고치거나 넣는다", async () => {
    await db.query("select public.sync_live($1, $2)", [cohort, JSON.stringify([
      { session_no: 1, starts_at: "2026-10-25T20:00:00+09:00", zoom_url: "https://zoom.us/j/9", replay_url: "" },
      { session_no: 2, starts_at: "2026-11-20T20:00:00+09:00", zoom_url: "", replay_url: "" },
    ])]);
    const r = (await db.query<Row>("select session_no, zoom_url from live_sessions where cohort_id = $1 order by session_no", [cohort])).rows;
    expect(r).toEqual([{ session_no: 1, zoom_url: "https://zoom.us/j/9" }, { session_no: 2, zoom_url: null }]);
  });
});

describe("듣기 전 질문", () => {
  it("시트의 질문이 기사에 반영되고 낭독 자료에 실린다, 비우면 지운다", async () => {
    await db.transaction(async (tx) => {
      const c1 = (await tx.query<Row>("select cohort_id from cohorts where cohort_no = 1")).rows[0].cohort_id;
      const p = { title_en: "RM Opens His Art Collection to the World", status: "published", sentences: [{ para_no: 1, sent_no: 1, en: "Hi.", ko: "안녕." }] };
      await tx.query("select public.sync_week($1, 1, $2)", [c1, JSON.stringify({ ...p, pre_question: " 내가 가장 아끼는 물건은? " })]);
      const q = async () =>
        ((await tx.query<Row>("select public.reading_material('S-0001', 1, '2026-10-07T12:00:00+09:00') as j")).rows[0].j as any).pre_question;
      expect(await q()).toBe("내가 가장 아끼는 물건은?");
      await tx.query("select public.sync_week($1, 1, $2)", [c1, JSON.stringify({ ...p, pre_question: "" })]);
      expect(await q()).toBeNull();
      await tx.rollback();
    });
  });
});
