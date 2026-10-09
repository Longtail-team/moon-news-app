// 2026-10-09 점검 수정: 재수강 다음 기수, 활동 파일 주인 확인
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;
const NOW = "2026-10-07T12:00:00+09:00";
const home = async (student: string, at: string) =>
  (await db.query<Row>("select public.student_home($1, $2) as h", [student, at])).rows[0].h as any;

beforeAll(async () => {
  db = await createDb();
});

describe("재수강생이 다음 기수를 결제했을 때", () => {
  it("다음 기수가 시작하기 전까지는 진행 중인 기수, 시작하면 새 기수를 보여 준다", async () => {
    await db.transaction(async (tx) => {
      await tx.query(`
        with c as (insert into cohorts (course_title, cohort_no, start_date, deadline)
                   values ('새벽달 영어뉴스', 2, '2026-12-14', '2027-03-07') returning cohort_id)
        insert into enrollments (student_id, cohort_id, grade_at_enrollment, paid_at, paid_amount)
        select 'S-0001', cohort_id, '초5', '2026-10-06 09:00+09', 120000 from c`);
      const q = (sql: string, at: string) => tx.query<Row>(sql, ["S-0001", at]).then((r) => r.rows[0].j as any);
      expect((await q("select public.student_home($1, $2) as j", NOW)).cohort.cohort_no).toBe(1);
      expect((await q("select public.activity_picker($1, $2) as j", NOW)).current_week).toBe(4);
      expect((await q("select public.student_home($1, $2) as j", "2026-12-14T00:00:00+09:00")).cohort.cohort_no).toBe(2);
      await tx.rollback();
    });
  });

  it("시작한 기수가 하나도 없으면 가장 최근 기수(개강 전 신규 수강생)", async () => {
    expect((await home("S-0001", "2026-09-01T12:00:00+09:00")).cohort.cohort_no).toBe(1);
  });
});

describe("활동 파일", () => {
  it("자기 기록의 파일만 받을 수 있다", async () => {
    const act = (await db.query<Row>(
      `select a.activity_id, a.media_key from activities a join enrollments en using (enrollment_id)
       where en.student_id = 'S-0001' and a.media_key is not null limit 1`,
    )).rows[0];
    const get = async (student: string) =>
      (await db.query<Row>("select public.activity_media($1, $2) as k", [student, act.activity_id])).rows[0].k;
    expect(await get("S-0001")).toBe(act.media_key);
    expect(await get("S-0002")).toBeNull();
  });
});
