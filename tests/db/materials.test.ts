// 이번 주 자료 탭: 주차별로 순차적으로 열린다
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;
const m = async (student: string, week: number | null, at: string) =>
  (await db.query<Row>("select public.materials($1, $2, $3) as j", [student, week, at])).rows[0].j as any;

beforeAll(async () => {
  db = await createDb();
});

describe("이번 주 자료", () => {
  it("4주차(수): 1~4주차만 열림, 다음은 5주차 10/12(월), 기본 선택은 이번 주", async () => {
    const r = await m("S-0001", null, "2026-10-07T12:00:00+09:00");
    expect(r.current_week).toBe(4);
    expect(r.opened.map((w: any) => w.week_no)).toEqual([4, 3, 2, 1]);
    expect(r.next_open.week_no).toBe(5);
    expect(new Date(r.next_open.starts_at).toISOString()).toBe(new Date("2026-10-12T00:00:00+09:00").toISOString());
    expect(r.selected.week_no).toBe(4);
  });

  it("월요일 0시가 되면 그 주차가 열린다", async () => {
    const before = await m("S-0001", null, "2026-10-11T23:59:00+09:00");
    const after = await m("S-0001", null, "2026-10-12T00:00:00+09:00");
    expect(before.opened).toHaveLength(4);
    expect(after.opened).toHaveLength(5);
    // 5주차는 시작됐지만 기사가 아직 "초안"이면 제목·자료가 비어 있다
    expect(after.selected.week_no).toBe(5);
    expect(after.selected.title_en).toBeNull();
  });

  it("1주차 자료: PDF·음원 정보와 추가 자료(안내·링크)", async () => {
    const r = await m("S-0001", 1, "2026-10-07T12:00:00+09:00");
    expect(r.selected).toMatchObject({ week_no: 1, title_en: "RM Opens His Art Collection to the World", word_count: 173 });
    expect(r.selected.assets.map((a: any) => a.type).sort()).toEqual(["article_audio", "article_pdf", "kr_en_repeat_audio", "voca_pdf", "voca_repeat_audio"]);
    expect(r.selected.items.map((i: any) => [i.kind, i.title])).toEqual([
      ["text", "이번 주 안내"],
      ["link", "SFMOMA 미술관 홈페이지"],
    ]);
  });

  it("아직 열리지 않은 주차는 골라도 보이지 않는다", async () => {
    const r = await m("S-0001", 8, "2026-10-07T12:00:00+09:00");
    expect(r.selected).toBeNull();
  });

  it("라이브: 입장 누름은 기록되고 줌 주소를 돌려준다, 다시보기 주소가 없으면 null", async () => {
    const r = await m("S-0001", null, "2026-10-07T12:00:00+09:00");
    expect(r.live).toHaveLength(1);
    expect(r.live[0]).toMatchObject({ session_no: 1, has_zoom: true, has_replay: false });
    await db.transaction(async (tx) => {
      const url = (await tx.query<Row>("select public.live_click('S-0001', $1, false) as u", [r.live[0].session_id])).rows[0].u;
      expect(url).toBe("https://zoom.example/sample");
      expect((await tx.query<Row>("select count(*)::int as n from live_clicks where student_id = 'S-0001'")).rows[0].n).toBe(1);
      expect((await tx.query<Row>("select public.live_click('S-0001', $1, true) as u", [r.live[0].session_id])).rows[0].u).toBeNull();
      // 다른 기수 학습자는 이 라이브에 들어갈 수 없다
      expect((await tx.query<Row>("select public.live_click('S-0005', $1, false) as u", [r.live[0].session_id])).rows[0].u).toBeNull();
      await tx.rollback();
    });
  });

  it("링크 자료는 https 주소만", async () => {
    await expect(
      db.query("insert into week_items (article_id, sort_no, kind, title, url) select article_id, 9, 'link', 'x', 'http://a.b' from articles limit 1"),
    ).rejects.toThrow();
  });
});
