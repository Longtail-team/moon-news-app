// 완주 화면·상장 (spec 5·9장): 완주 단계, 첫·마지막 낭독(제때·유예만), 상장 발급·재발급과 알림 기록
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;
const NOW = "2026-10-07T12:00:00+09:00";

const fin = async (q: PGlite | Transaction, student: string, at = NOW, e: string | null = null) =>
  (await q.query<Row>("select public.finish_data($1, $2, $3) as j", [student, e, at])).rows[0].j as any;

beforeAll(async () => {
  db = await createDb();
});

// 김지우(인증 15)를 제때 완주시킨다: 4주차에 인증한 학습 45개를 더한다(영어 낭독 포함)
async function completeJiwoo(tx: Transaction) {
  await tx.query(`
    insert into activities (enrollment_id, week_no, activity_type, state, started_at, completed_at, verified_at, post_url, media_key)
    select en.enrollment_id, 4, case when g % 3 = 0 then 'EN_READING' else 'VOCA' end, 'VERIFIED',
      '2026-10-06T09:00:00+09:00'::timestamptz + make_interval(mins => g),
      '2026-10-06T09:30:00+09:00'::timestamptz + make_interval(mins => g),
      '2026-10-06T10:00:00+09:00'::timestamptz + make_interval(mins => g),
      'https://www.instagram.com/p/test' || g || '/', 'recordings/' || en.enrollment_id || '/t' || g || '.m4a'
    from enrollments en join cohorts c using (cohort_id), generate_series(1, 45) g
    where en.student_id = 'S-0001' and c.cohort_no = 1`);
}

describe("완주 화면", () => {
  it("완주 전에는 단계가 없고 상장을 받을 수 없다", async () => {
    const f = await fin(db, "S-0001");
    expect(f).toMatchObject({ verified: 15, tier: null, first_reading: null });
    expect(f.cohort).toMatchObject({ total_target: 60, deadline: "2026-12-06", grace_until: "2026-12-13" });
    await expect(db.query("select public.issue_certificate('S-0001', null, '김지우', $1)", [NOW])).rejects.toThrow(/not completed/);
  });

  it("제때 완주: 첫·마지막 영어 낭독이 있고, 상장 발급·재발급마다 알림 기록", async () => {
    await db.transaction(async (tx) => {
      await completeJiwoo(tx);
      const f = await fin(tx, "S-0001");
      expect(f).toMatchObject({ verified: 60, tier: "on_time" });
      expect(f.first_reading.week_no).toBeLessThanOrEqual(f.last_reading.week_no);
      expect(new Date(f.first_reading.completed_at) < new Date(f.last_reading.completed_at)).toBe(true);
      expect(f.last_reading).toMatchObject({ has_audio: true });

      await tx.query("select public.issue_certificate('S-0001', null, '  김지우 ', $1)", [NOW]);
      await tx.query("select public.issue_certificate('S-0001', null, '김지우우', $1)", [NOW]);
      expect((await fin(tx, "S-0001")).certificate_name).toBe("김지우우");
      const e = (await tx.query<Row>("select completion_tier, completed_at is not null as done from enrollments en join cohorts c using (cohort_id) where student_id = 'S-0001' and cohort_no = 1")).rows[0];
      expect(e).toEqual({ completion_tier: "on_time", done: true });
      const n = (await tx.query<Row>("select count(*)::int as n from notifications where student_id = 'S-0001' and template = 'certificate'")).rows[0].n;
      expect(n).toBe(2); // 보호자 휴대폰으로 진행: 보호자에게만, 2번 발급
      await expect(tx.query("select public.issue_certificate('S-0001', null, '김', $1)", [NOW])).rejects.toThrow(/bad name/);
      await tx.rollback();
    });
  });

  it("늦은 완주(최하린 0기): 상장은 받지만 첫·마지막 낭독 비교는 없다", async () => {
    const cur = (await db.query<Row>("select public.newsbook('S-0004', null, $1) as j", [NOW])).rows[0].j as any;
    const f = await fin(db, "S-0004", NOW, cur.others[0].enrollment_id);
    expect(f).toMatchObject({ tier: "late", first_reading: null, last_reading: null, is_current: false });
  });

  it("홈에 유예 마감일과 녹음 보관 기한", async () => {
    const h = (await db.query<Row>("select public.student_home('S-0001', '2026-12-08T12:00:00+09:00') as h")).rows[0].h as any;
    expect(h.cohort).toMatchObject({ grace_until: "2026-12-13", grace_open: true, retention_until: "2027-03-06" });
    const after = (await db.query<Row>("select public.student_home('S-0001', '2026-12-14T00:00:00+09:00') as h")).rows[0].h as any;
    expect(after.cohort.grace_open).toBe(false);
  });
});
