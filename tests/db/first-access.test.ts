// T04 첫 접속 3단계·보호자 링크·다시 들어가기 검증
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
type Q = PGlite | Transaction;
let db: PGlite;
let cohort1: string;

const j = async (q: Q, sql: string, params: unknown[] = []) => (await q.query<Row>(sql, params)).rows[0]?.j as any;
const state = (q: Q, g: string) => j(q, "select public.onboarding_state($1) as j", [g]);
async function newOrder(q: Q, no: string, phone: string, qty: number, cohort = cohort1) {
  return j(q, "select public.record_order($1, $2, $3, $4) as j", [no, phone, cohort, qty]);
}
async function session(q: Q, holder: "guardian" | "child", guardian: string | null, student: string | null, tag: string) {
  const t = await j(q, "select public.issue_token($1, $2, $3, '01000000000', $4) as j", [holder, guardian, student, `hash-${tag}`]);
  await q.query("insert into sessions (session_hash, token_id, expires_at) values ($1, $2, now() + interval '1 day')", [`s-${tag}`, t.token_id]);
  return `s-${tag}`;
}
const scope = async (q: Q, hash: string) => (await q.query<Row>("select student_id from public.session_scope($1)", [hash])).rows.map((r) => r.student_id);

beforeAll(async () => {
  db = await createDb();
  [{ cohort_id: cohort1 }] = (await db.query<Row>("select cohort_id from cohorts where cohort_no = 1")).rows as { cohort_id: string }[];
});

describe("학년 (출생 연월, 3월 새 학년)", () => {
  it.each([
    ["2015-05-01", "2026-10-08", "초5"],
    ["2015-05-01", "2027-02-15", "초5"],
    ["2015-05-01", "2027-03-02", "초6"],
    ["2013-01-01", "2026-10-08", "중1"],
    ["2021-01-01", "2026-10-08", null],
  ])("%s 생 · %s → %s", async (birth, at, label) => {
    expect((await db.query<Row>("select app.grade_label($1::date, $2::date) as g", [birth, at])).rows[0].g).toBe(label);
  });
});

describe("결제 → 첫 접속 3단계 (형제 2명 주문)", () => {
  it("주문 → 보호자 링크(학습자 없음) → 환영 → 학습자 2명 → 접속·동의 → 완료", async () => {
    await db.transaction(async (tx) => {
      const o = await newOrder(tx, "IMWEB-T1", "01000009001", 2);
      expect((await state(tx, o.guardian_id)).step).toBe("welcome");

      // 보호자 링크 유효기간 = 종강(12/6) + 3개월의 한국 시간 끝
      const t = await j(tx, "select public.issue_token('guardian', $1, null, '01000009001', 'h-g') as j", [o.guardian_id]);
      expect(new Date(t.expires_at).toISOString()).toBe(new Date("2027-03-07T00:00:00+09:00").toISOString());

      // 결제 직후에도 세션은 산다(학습자 없음)
      const hash = await session(tx, "guardian", o.guardian_id, null, "g1");
      expect(await scope(tx, hash)).toEqual([null]);

      await tx.query("select public.onboarding_welcome($1, '테스트 보호자')", [o.guardian_id]);
      expect((await state(tx, o.guardian_id)).step).toBe("learners");

      const a = (await tx.query<Row>("select public.register_learner($1, $2, null, '테스트하나', '2015-05-01', null, 'test_one') as s", [o.guardian_id, o.order_id])).rows[0].s;
      // 1명만 등록해도 다음 단계로 간다. 형제는 최대 4명까지 나중에도 추가
      const half = await state(tx, o.guardian_id);
      expect(half.orders[0]).toMatchObject({ registered: 1 });
      expect(half.step).toBe("access");
      expect(half.open_seats).toBe(3);
      const b = (await tx.query<Row>("select public.register_learner($1, $2, null, '테스트둘', '2013-03-01', '중2', null) as s", [o.guardian_id, o.order_id])).rows[0].s;

      const st = await state(tx, o.guardian_id);
      expect(st.step).toBe("access");
      expect(st.open_seats).toBe(2);
      expect(st.pending.map((p: any) => [p.name, p.grade]).sort()).toEqual([["테스트둘", "중2"], ["테스트하나", "초5"]]);

      await tx.query("select public.onboarding_access($1, $2, null)", [o.guardian_id, a]);
      await tx.query("select public.onboarding_access($1, $2, '01000009002')", [o.guardian_id, b]);
      expect((await state(tx, o.guardian_id)).step).toBe("done");
      expect((await scope(tx, hash)).sort()).toEqual([a, b].sort());

      // 자녀 링크는 그 자녀 한 명만
      const ch = await session(tx, "child", null, b as string, "c1");
      expect(await scope(tx, ch)).toEqual([b]);
      await tx.rollback();
    });
  });

  it("자녀 본인 번호에 보호자 번호를 넣을 수 없다", async () => {
    await expect(
      db.transaction(async (tx) => {
        const o = await newOrder(tx, "IMWEB-T6", "01000009006", 1);
        const s = (await tx.query<Row>("select public.register_learner($1, $2, null, '하나', '2015-01-01', null, null) as s", [o.guardian_id, o.order_id])).rows[0].s;
        await tx.query("select public.onboarding_access($1, $2, '01000009006')", [o.guardian_id, s]);
      }),
    ).rejects.toThrow(/same as guardian/);
  });

  it("주문 수량과 상관없이 형제는 4명까지, 5번째는 거부", async () => {
    await expect(
      db.transaction(async (tx) => {
        const o = await newOrder(tx, "IMWEB-T2", "01000009003", 1);
        for (const n of ["하나", "둘", "셋", "넷"])
          await tx.query("select public.register_learner($1, $2, null, $3, '2015-01-01', null, null)", [o.guardian_id, o.order_id, n]);
        expect((await state(tx, o.guardian_id)).open_seats).toBe(0);
        await tx.query("select public.register_learner($1, $2, null, '다섯', '2015-01-01', null, null)", [o.guardian_id, o.order_id]);
      }),
    ).rejects.toThrow(/no seats left/);
  });

  it("다른 보호자의 주문에는 등록할 수 없다", async () => {
    await expect(
      db.transaction(async (tx) => {
        const o = await newOrder(tx, "IMWEB-T3", "01000009004", 1);
        const other = (await tx.query<Row>("select guardian_id from guardians where phone = '01000000001'")).rows[0].guardian_id;
        await tx.query("select public.register_learner($1, $2, null, '하나', '2015-01-01', null, null)", [other, o.order_id]);
      }),
    ).rejects.toThrow(/order not found/);
  });

  it("재수강: 같은 결제자 번호로 다음 기수 주문 → 지난 학습자를 골라 등록(새 학습자를 만들지 않음)", async () => {
    await db.transaction(async (tx) => {
      const [{ cohort_id: c2 }] = (
        await tx.query<Row>("insert into cohorts (course_title, cohort_no, start_date, deadline) values ('새벽달 영어뉴스', 2, '2027-01-04', '2027-03-28') returning cohort_id")
      ).rows as { cohort_id: string }[];
      // 김지우 보호자 번호로 2기 주문
      const o = await newOrder(tx, "IMWEB-T4", "01000000001", 1, c2);
      const st = await state(tx, o.guardian_id);
      expect(st.returning.map((r: any) => r.student_id)).toEqual(["S-0001"]);
      await tx.query("select public.onboarding_welcome($1, '김지우 보호자')", [o.guardian_id]);
      const s = (await tx.query<Row>("select public.register_learner($1, $2, 'S-0001', null, null, null, null) as s", [o.guardian_id, o.order_id])).rows[0].s;
      expect(s).toBe("S-0001");
      expect((await tx.query<Row>("select count(*)::int as n from enrollments where student_id = 'S-0001'")).rows[0].n).toBe(2);
      expect((await tx.query<Row>("select count(*)::int as n from students where guardian_id = $1", [o.guardian_id])).rows[0].n).toBe(1);
      // 이미 동의한 학습자라 3단계 없이 바로 완료
      expect((await state(tx, o.guardian_id)).step).toBe("done");
      await tx.rollback();
    });
  });

  it("주문이 없는 기존 보호자(샘플)는 첫 접속을 건너뛴다", async () => {
    const g = (await db.query<Row>("select guardian_id from guardians where phone = '01000000001'")).rows[0].guardian_id;
    expect((await state(db, g as string)).step).toBe("done");
  });
});

describe("환불과 보호자 링크", () => {
  it("형제 중 한 명만 환불하면 보호자 링크 유지, 둘 다 환불하면 폐기", async () => {
    await db.transaction(async (tx) => {
      const refund = (sid: string) =>
        tx.query("update enrollments set status = 'refunded', refund_status = 'approved', refunded_at = now() where student_id = $1", [sid]);
      const revoked = async () => (await tx.query<Row>("select bool_and(revoked_at is not null) as r from access_tokens where guardian_id = (select guardian_id from students where student_id = 'S-0007')")).rows[0].r;
      await refund("S-0007");
      expect(await revoked()).toBe(false);
      await refund("S-0008");
      expect(await revoked()).toBe(true);
      await tx.rollback();
    });
  });

  it("아직 아무도 등록하지 않은 주문이 있으면 보호자 링크 유지, 등록한 자녀를 모두 환불하면 폐기", async () => {
    await db.transaction(async (tx) => {
      const o = await newOrder(tx, "IMWEB-T5", "01000009005", 1);
      await tx.query("select public.issue_token('guardian', $1, null, '01000009005', 'h-t5')", [o.guardian_id]);
      expect((await tx.query<Row>("select app.guardian_active($1) as a", [o.guardian_id])).rows[0].a).toBe(true);
      const s = (await tx.query<Row>("select public.register_learner($1, $2, null, '하나', '2015-01-01', null, null) as s", [o.guardian_id, o.order_id])).rows[0].s;
      await tx.query("update enrollments set status = 'refunded', refund_status = 'approved', refunded_at = now() where student_id = $1", [s]);
      expect((await tx.query<Row>("select revoked_at from access_tokens where token_hash = 'h-t5'")).rows[0].revoked_at).not.toBeNull();
      await tx.rollback();
    });
  });
});

describe("다시 들어가기", () => {
  const target = (phone: string) => j(db, "select public.reentry_target($1) as j", [phone]);

  it("보호자 번호 → 보호자, 자녀 본인 번호 → 자녀, 모르는 번호·환불만 남은 보호자 → 없음", async () => {
    expect(await target("01000000001")).toMatchObject({ holder: "guardian" });
    expect(await target("01000001003")).toEqual({ holder: "child", student_id: "S-0003" });
    expect(await target("01099999999")).toBeNull();
    expect(await target("01000000005")).toBeNull(); // 정민준 보호자: 환불만 남음
  });

  it("같은 번호의 최근 1시간 새 링크 요청 수", async () => {
    await db.transaction(async (tx) => {
      for (let i = 0; i < 2; i++)
        await tx.query(
          "insert into notifications (guardian_id, template, recipient, sent_to_phone, result) select guardian_id, 'new_link', 'guardian', phone, 'dev' from guardians where phone = '01000000001'",
        );
      expect((await tx.query<Row>("select public.recent_link_requests('01000000001') as n")).rows[0].n).toBe(2);
      await tx.rollback();
    });
  });
});
