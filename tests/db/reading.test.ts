// 활동 선택·낭독 시작·완료 검증
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;
const NOW = "2026-10-07T12:00:00+09:00";

const json = async (sql: string, params: unknown[]) => (await db.query<Row>(sql, params)).rows[0]?.j as any;

beforeAll(async () => {
  db = await createDb();
});

describe("활동 선택", () => {
  it("시작된 주차만 최근부터, 주차별 완료 수·활동별 횟수·작성 중", async () => {
    const p = await json("select public.activity_picker('S-0001', $1) as j", [NOW]);
    expect(p.current_week).toBe(4);
    expect(p.weeks.map((w: any) => w.week_no)).toEqual([4, 3, 2, 1]);
    expect(p.weeks[0]).toMatchObject({ completed: 2, counts: { KR_READING: 1, VOCA: 1 }, in_progress: ["SUMMARY"] });
    expect(p.weeks[3]).toMatchObject({ completed: 5, title: "RM Opens His Art Collection to the World" });
  });

  it("환불만 남은 학습자는 없음", async () => {
    expect(await json("select public.activity_picker('S-0005', $1) as j", [NOW])).toBeNull();
  });
});

describe("낭독 자료", () => {
  it("1주차: 문장 14개(끊어 읽기 포함), 음원 2종과 기사 PDF 정보, 종강일", async () => {
    const m = await json("select public.reading_material('S-0001', 1, $1) as j", [NOW]);
    expect(m).toMatchObject({ week_no: 1, weekly_target: 5, week_completed: 5, word_count: 173, deadline: "2026-12-06" });
    expect(m.sentences).toHaveLength(14);
    expect(m.sentences[1].en).toBe("For RM of BTS, / the answer is art.");
    expect(m.assets.map((a: any) => a.type).sort()).toEqual(["article_audio", "article_pdf", "kr_en_repeat_audio"]);
  });

  it("시작 전 주차·공개 전 기사는 없음", async () => {
    expect(await json("select public.reading_material('S-0001', 5, $1) as j", [NOW])).toBeNull();
    expect(await json("select public.reading_material('S-0001', 4, '2026-10-01T12:00:00+09:00') as j", [])).toBeNull();
  });
});

describe("낭독 시작과 완료", () => {
  it("시작 → 같은 주차·활동은 이어서 → 완료하면 학습 완료 +1, 첫 영어 낭독 표시", async () => {
    await db.transaction(async (tx) => {
      // 한예린은 기록이 하나도 없다 → 첫 영어 낭독
      const s1 = (await tx.query<Row>("select public.start_activity('S-0006', 1, 'EN_READING') as j")).rows[0].j as any;
      const s2 = (await tx.query<Row>("select public.start_activity('S-0006', 1, 'EN_READING') as j")).rows[0].j as any;
      expect(s2.activity_id).toBe(s1.activity_id);

      const key = `recordings/${s1.enrollment_id}/${s1.activity_id}-1.m4a`;
      const done = (await tx.query<Row>("select public.complete_activity('S-0006', $1, $2) as j", [s1.activity_id, key])).rows[0].j as any;
      expect(done).toEqual({ week_no: 1, week_completed: 1, first_en: true });

      const a = (await tx.query<Row>("select state, media_key, completed_at from activities where activity_id = $1", [s1.activity_id])).rows[0];
      expect(a.state).toBe("COMPLETED");
      expect(a.media_key).toBe(key);

      // 두 번째 영어 낭독은 첫 낭독이 아니다
      const s3 = (await tx.query<Row>("select public.start_activity('S-0006', 1, 'EN_READING') as j")).rows[0].j as any;
      expect(s3.activity_id).not.toBe(s1.activity_id);
      const done2 = (await tx.query<Row>("select public.complete_activity('S-0006', $1, $2) as j", [s3.activity_id, `recordings/${s3.enrollment_id}/x.m4a`])).rows[0].j as any;
      expect(done2.first_en).toBe(false);
      await tx.rollback();
    });
  });

  it("다른 학습자의 활동·다른 수강 경로·이미 완료한 활동은 완료할 수 없다", async () => {
    // 오류가 나면 트랜잭션이 중단되므로 경우마다 따로 시작하고 되돌린다
    const tryComplete = (student: string, key: string) =>
      db.transaction(async (tx) => {
        const s = (await tx.query<Row>("select public.start_activity('S-0006', 1, 'KR_READING') as j")).rows[0].j as any;
        await tx.query("select public.complete_activity($1, $2, $3)", [student, s.activity_id, key]);
      });
    await expect(tryComplete("S-0001", "recordings/x/y.m4a")).rejects.toThrow(/not found/);
    await expect(tryComplete("S-0006", "recordings/other/y.m4a")).rejects.toThrow(/invalid media key/);
    const [done] = (await db.query<Row>(
      `select a.activity_id from activities a join enrollments en using (enrollment_id) where en.student_id = 'S-0001' and a.activity_type = 'KR_READING' and a.completed_at is not null limit 1`,
    )).rows;
    await expect(db.query("select public.complete_activity('S-0001', $1, 'recordings/x/y.m4a')", [done.activity_id])).rejects.toThrow();
  });

  it("없는 주차에는 시작할 수 없다", async () => {
    await expect(db.query("select public.start_activity('S-0006', 13, 'EN_READING')")).rejects.toThrow(/has not started|does not exist/);
  });

  it("활동 주인 확인", async () => {
    const [a] = (await db.query<Row>(
      `select a.activity_id from activities a join enrollments en using (enrollment_id) where en.student_id = 'S-0001' limit 1`,
    )).rows;
    expect(await json("select public.activity_owner('S-0001', $1) as j", [a.activity_id])).toMatchObject({ activity_id: a.activity_id });
    expect(await json("select public.activity_owner('S-0002', $1) as j", [a.activity_id])).toBeNull();
  });
});
