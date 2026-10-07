// T02 검증: 샘플 데이터로 집계 결과가 spec.md 규칙과 맞는지 확인한다.
// 기준 시각은 2026-10-07(수) 12시 KST = 1기 4주차.
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb } from "./setup";

const NOW = "2026-10-07T12:00:00+09:00";

type Row = Record<string, unknown>;

let db: PGlite;
let cohort1: string;

async function rows(sql: string, params: unknown[] = []): Promise<Row[]> {
  return (await db.query<Row>(sql, params)).rows;
}

async function progressOf(studentId: string, cohortNo = 1): Promise<Row> {
  const [r] = await rows(
    `select p.* from app.admin_enrollment_list($1) p join cohorts c using (cohort_id)
     where p.student_id = $2 and c.cohort_no = $3`,
    [NOW, studentId, cohortNo],
  );
  return r;
}

beforeAll(async () => {
  db = await createDb();
  [{ cohort_id: cohort1 }] = (await rows("select cohort_id from cohorts where cohort_no = 1")) as { cohort_id: string }[];
});

describe("기수", () => {
  it("유예 기간은 종강일 + 7일로 계산된다", async () => {
    const [c] = await rows("select deadline::text, grace_until::text from cohorts where cohort_no = 1");
    expect(c).toEqual({ deadline: "2026-12-06", grace_until: "2026-12-13" });
  });

  it("종강일은 일요일만 허용한다", async () => {
    await expect(
      db.query("insert into cohorts (course_title, cohort_no, start_date, deadline) values ('x', 9, '2027-01-04', '2027-03-27')"),
    ).rejects.toThrow();
  });
});

describe("학습자별 진도 (spec 4·16장)", () => {
  it("정상: 김지우 — 이번 주 2, 누적 17, 인증 15, 올릴 것 2, 밀림 없음", async () => {
    const p = await progressOf("S-0001");
    expect(p).toMatchObject({
      current_week: 4,
      this_week_completed: 2,
      total_completed: 17,
      verified_count: 15,
      pending_post_count: 2,
      behind_count: 0,
      study_behind: false,
      post_behind: false,
      reading_not_started: false,
      not_started: false,
    });
  });

  it("누적 낭독 단어 수는 영어 낭독 학습 완료 × 그 주차 기사 단어 수", async () => {
    const [r] = await rows(
      "select reading_words from app.enrollment_progress($1) p where p.student_id = 'S-0001' and p.cohort_id = $2",
      [NOW, cohort1],
    );
    expect(r.reading_words).toBe(173 + 180 + 180);
  });

  it("작성 중(시작만 한) 활동은 학습 완료로 세지 않지만 최근 활동에는 들어간다", async () => {
    const p = await progressOf("S-0001");
    expect(new Date(p.last_activity_at as string).toISOString()).toBe(new Date("2026-10-06T20:00:00+09:00").toISOString());
  });

  it("게시 밀림: 박서연 — 학습 20, 인증 12, 올릴 것 8", async () => {
    const p = await progressOf("S-0002");
    expect(p).toMatchObject({ total_completed: 20, verified_count: 12, pending_post_count: 8, post_behind: true, study_behind: false });
  });

  it("학습 밀림: 이도윤 — 기대 15 중 7회, 8회 밀림", async () => {
    const p = await progressOf("S-0003");
    expect(p).toMatchObject({ total_completed: 7, behind_count: 8, study_behind: true, post_behind: false });
  });

  it("미시작: 한예린 — 기록 없음, 15회 밀림, 1차 독려 받음", async () => {
    const p = await progressOf("S-0006");
    expect(p).toMatchObject({
      total_completed: 0,
      behind_count: 15,
      not_started: true,
      reading_not_started: true,
      nudges_received: 1,
      last_activity_at: null,
    });
  });

  it("환불: 정민준 — 밀림 표시에서 빠진다", async () => {
    expect(await progressOf("S-0005")).toMatchObject({ refunded: true, total_completed: 3, study_behind: false, post_behind: false });
  });

  it("형제 수강: 윤시우·강다은은 보호자가 같고 진도는 따로 센다", async () => {
    const [g] = await rows("select count(distinct guardian_id)::int as n from students where student_id in ('S-0007', 'S-0008')");
    expect(g.n).toBe(1);
    expect(await progressOf("S-0007")).toMatchObject({ total_completed: 19, verified_count: 18, study_behind: false });
    expect(await progressOf("S-0008")).toMatchObject({ total_completed: 6, behind_count: 9, study_behind: true });
  });

  it("기준 시각 이후의 완료·인증은 세지 않는다", async () => {
    const [r] = await rows(
      "select total_completed, verified_count from app.enrollment_progress('2026-09-20T23:59:00+09:00') p where p.student_id = 'S-0001' and p.cohort_id = $1",
      [cohort1],
    );
    expect(r).toEqual({ total_completed: 5, verified_count: 5 });
  });
});

describe("완주 단계 (spec 5장)", () => {
  it("재수강·늦은 완주: 최하린 0기 — 60번째 인증이 유예 뒤라 late", async () => {
    const p = await progressOf("S-0004", 0);
    expect(p.completion_tier).toBe("late");
    const [stored] = await rows(
      "select en.completion_tier from enrollments en join cohorts c using (cohort_id) where en.student_id = 'S-0004' and c.cohort_no = 0",
    );
    expect(stored.completion_tier).toBe("late");
  });

  it("재수강은 같은 학습자에 수강 기록이 2건", async () => {
    const [r] = await rows("select count(*)::int as n from enrollments where student_id = 'S-0004'");
    expect(r.n).toBe(2);
    expect(await progressOf("S-0004", 1)).toMatchObject({ total_completed: 17, verified_count: 17, completion_tier: null });
  });

  it("60번째 인증 시각에 따라 on_time / grace / late", async () => {
    // 0기 최하린의 60번째 인증 시각을 바꿔 가며 판정한다 (트랜잭션 안에서만)
    const tierAt = async (verifiedAt: string) =>
      db.transaction(async (tx) => {
        await tx.query(
          `update activities set verified_at = $1
           where verified_at = '2026-06-20 21:00+09'`,
          [verifiedAt],
        );
        const r = await tx.query<Row>(
          `select completion_tier from app.enrollment_progress('2026-12-31T00:00:00+09:00') p
           join cohorts c using (cohort_id) where p.student_id = 'S-0004' and c.cohort_no = 0`,
        );
        await tx.rollback();
        return r.rows[0].completion_tier;
      });
    expect(await tierAt("2026-05-24T23:59:00+09:00")).toBe("on_time"); // 종강일 밤까지
    expect(await tierAt("2026-05-25T00:00:00+09:00")).toBe("grace");
    expect(await tierAt("2026-05-31T23:59:00+09:00")).toBe("grace");
    expect(await tierAt("2026-06-01T00:00:00+09:00")).toBe("late");
  });
});

describe("진도 독려 대상 (spec 12장)", () => {
  const names = async (checkpoint: string, at: string) =>
    (await rows("select student_name from app.nudge_targets($1, $2, $3)", [cohort1, checkpoint, at])).map((r) => r.student_name);

  it("1차(2주차 월요일): 대상이던 한예린은 이미 받아서 없음", async () => {
    expect(await names("nudge_1", "2026-09-21T09:00:00+09:00")).toEqual([]);
  });

  it("2차(4주차 월요일): 기대 15 중 5회 이하 — 강다은, 한예린. 환불(정민준)·8회 밀림(이도윤) 제외", async () => {
    expect(await names("nudge_2", "2026-10-05T09:00:00+09:00")).toEqual(["강다은", "한예린"]);
  });

  it("3차(7주차 월요일): 기대 30 중 15회 이하 — 회차마다 독립 판정", async () => {
    expect(await names("nudge_3", "2026-10-26T09:00:00+09:00")).toEqual(["강다은", "이도윤", "한예린"]);
  });

  it("모르는 회차는 오류", async () => {
    await expect(db.query("select * from app.nudge_targets($1, 'nudge_9', $2)", [cohort1, NOW])).rejects.toThrow(/unknown nudge checkpoint/);
  });
});

describe("규칙", () => {
  const insertNudge = (tx: { query: PGlite["query"] }, checkpoint: string, recipient = "guardian") =>
    tx.query(
      `insert into notifications (student_id, enrollment_id, template, checkpoint, recipient, sent_to_phone)
       select en.student_id, en.enrollment_id, 'nudge', $1, $2, '01000000007'
       from enrollments en join cohorts c using (cohort_id) where en.student_id = 'S-0008' and c.cohort_no = 1`,
      [checkpoint, recipient],
    );

  it("진도 독려는 수동 포함 3회까지, 4번째 회차는 거부", async () => {
    await db.transaction(async (tx) => {
      await insertNudge(tx, "nudge_2");
      await insertNudge(tx, "manual_2026-10-10");
      await insertNudge(tx, "nudge_3");
      await expect(insertNudge(tx, "manual_2026-10-30")).rejects.toThrow(/nudge cap/);
      await tx.rollback();
    });
  });

  it("같은 회차를 같은 사람에게 두 번 보내지 않는다", async () => {
    await db.transaction(async (tx) => {
      await insertNudge(tx, "nudge_2");
      await expect(insertNudge(tx, "nudge_2")).rejects.toThrow();
      await tx.rollback();
    });
  });

  it("환불하면 접속 링크가 폐기된다 (정민준)", async () => {
    const r = await rows("select revoked_at from access_tokens where student_id = 'S-0005'");
    expect(r.length).toBe(1);
    expect(r[0].revoked_at).not.toBeNull();
    const others = await rows("select count(*)::int as n from access_tokens where student_id <> 'S-0005' and revoked_at is not null");
    expect(others[0].n).toBe(0);
  });

  it("환불 요청(관리자 확인 전)만으로는 링크를 폐기하지 않는다", async () => {
    await db.transaction(async (tx) => {
      await tx.query("update enrollments set refund_status = 'requested' where student_id = 'S-0001'");
      const r = await tx.query<Row>("select revoked_at from access_tokens where student_id = 'S-0001'");
      expect(r.rows[0].revoked_at).toBeNull();
      await tx.rollback();
    });
  });

  it("환불 상태값은 서로 맞아야 한다 (환불 완료 = refunded + approved + 환불 시각)", async () => {
    await expect(db.query("update enrollments set status = 'refunded' where student_id = 'S-0001'")).rejects.toThrow();
    await expect(db.query("update enrollments set refund_status = 'approved' where student_id = 'S-0001'")).rejects.toThrow();
  });

  it("다른 수강이 남은 학습자는 한 수강을 환불해도 링크를 유지한다 (최하린)", async () => {
    await db.transaction(async (tx) => {
      await tx.query(
        `update enrollments set status = 'refunded', refund_status = 'approved', refunded_at = now()
         where student_id = 'S-0004' and cohort_id = (select cohort_id from cohorts where cohort_no = 1)`,
      );
      const r = await tx.query<Row>("select revoked_at from access_tokens where student_id = 'S-0004'");
      expect(r.rows[0].revoked_at).toBeNull();
      await tx.rollback();
    });
  });

  it("아직 시작하지 않은 주차에는 학습할 수 없고, 지난 주차는 소급할 수 있다", async () => {
    const insertAt = (week: number, at: string) =>
      db.query(
        `insert into activities (enrollment_id, week_no, activity_type, started_at)
         select en.enrollment_id, $1, 'VOCA', $2 from enrollments en join cohorts c using (cohort_id)
         where en.student_id = 'S-0006' and c.cohort_no = 1 returning activity_id`,
        [week, at],
      );
    await expect(insertAt(5, NOW)).rejects.toThrow(/has not started/);
    await expect(insertAt(13, "2026-12-20T12:00:00+09:00")).rejects.toThrow(/does not exist/);
    await db.transaction(async (tx) => {
      // 종강 뒤에도 1주차를 채울 수 있다 (늦은 완주)
      await tx.query(
        `insert into activities (enrollment_id, week_no, activity_type, started_at)
         select en.enrollment_id, 1, 'VOCA', '2026-12-20T12:00:00+09:00' from enrollments en join cohorts c using (cohort_id)
         where en.student_id = 'S-0006' and c.cohort_no = 1`,
      );
      await tx.rollback();
    });
  });

  it("인증은 학습 완료 뒤에만 있다", async () => {
    await expect(
      db.query(
        `insert into activities (enrollment_id, week_no, activity_type, state, verified_at, post_url)
         select enrollment_id, 4, 'VOCA', 'VERIFIED', now(), 'https://www.instagram.com/p/x/' from enrollments limit 1`,
      ),
    ).rejects.toThrow();
  });
});

describe("알림 받는 사람 (spec 12장)", () => {
  const recipients = async (student: string, template: string, phone: string | null = null) =>
    (await rows("select recipient, phone from app.notification_recipients($1, $2, $3) order by recipient desc", [student, template, phone]));

  it("보호자 휴대폰으로 진행: 독려는 보호자만", async () => {
    expect(await recipients("S-0001", "nudge")).toEqual([{ recipient: "guardian", phone: "01000000001" }]);
  });

  it("자녀 본인 휴대폰으로 진행: 독려는 보호자와 자녀 모두, 시작 안내는 보호자만", async () => {
    expect(await recipients("S-0003", "nudge")).toEqual([
      { recipient: "guardian", phone: "01000000003" },
      { recipient: "child", phone: "01000001003" },
    ]);
    expect(await recipients("S-0003", "start_guide")).toEqual([{ recipient: "guardian", phone: "01000000003" }]);
    expect(await recipients("S-0003", "child_link")).toEqual([{ recipient: "child", phone: "01000001003" }]);
    expect(await recipients("S-0001", "child_link")).toEqual([]);
  });

  it("새 접속 링크는 등록된 번호로 요청했을 때만", async () => {
    expect(await recipients("S-0003", "new_link", "01000001003")).toEqual([{ recipient: "child", phone: "01000001003" }]);
    expect(await recipients("S-0003", "new_link", "01099999999")).toEqual([]);
  });
});

describe("권한 (RLS)", () => {
  it("로그인하지 않은 요청은 아무것도 읽지 못한다", async () => {
    await expect(asUser(db, null, (tx) => tx.query("select * from activities"))).rejects.toThrow(/permission denied/);
  });

  it("학습자 세션은 자기 기록만 본다", async () => {
    const r = await asUser(db, { student_ids: ["S-0001"] }, async (tx) => ({
      students: (await tx.query<Row>("select student_id from students")).rows,
      activities: (await tx.query<Row>("select count(*)::int as n from activities")).rows[0].n,
      cohorts: (await tx.query<Row>("select count(*)::int as n from cohorts")).rows[0].n,
      guardians: (await tx.query<Row>("select count(*)::int as n from guardians")).rows[0].n,
    }));
    expect(r).toEqual({ students: [{ student_id: "S-0001" }], activities: 18, cohorts: 1, guardians: 0 });
  });

  it("보호자 세션은 자녀 기록을 모두 본다 (형제)", async () => {
    const [{ guardian_id }] = (await rows("select guardian_id from students where student_id = 'S-0007'")) as { guardian_id: string }[];
    const r = await asUser(db, { student_ids: ["S-0007", "S-0008"], guardian_id }, async (tx) => ({
      students: (await tx.query<Row>("select student_id from students order by student_id")).rows.map((x) => x.student_id),
      guardians: (await tx.query<Row>("select count(*)::int as n from guardians")).rows[0].n,
    }));
    expect(r).toEqual({ students: ["S-0007", "S-0008"], guardians: 1 });
  });

  it("접속 링크와 알림 기록은 학습자 앱에서 읽을 수 없다", async () => {
    await expect(asUser(db, { student_ids: ["S-0001"] }, (tx) => tx.query("select * from access_tokens"))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, { student_ids: ["S-0001"] }, (tx) => tx.query("select * from notifications"))).rejects.toThrow(/permission denied/);
  });

  it("학습 자료는 주차가 시작된 공개 기사만 보인다", async () => {
    const r = await asUser(db, { student_ids: ["S-0001"] }, async (tx) => ({
      articles: (await tx.query<Row>("select count(*)::int as n from articles")).rows[0].n,
      sentences: (await tx.query<Row>("select count(*)::int as n from sentences")).rows[0].n,
    }));
    // 1~4주차만 공개 상태(5주차부터 초안). 오늘(2026-10-07 이후) 기준 1~4주차는 시작됨
    expect(r).toEqual({ articles: 4, sentences: 14 + 3 });
  });

  it("학습자 세션은 쓰기를 할 수 없다", async () => {
    await expect(
      asUser(db, { student_ids: ["S-0001"] }, (tx) => tx.query("update activities set post_url = 'x'")),
    ).rejects.toThrow(/permission denied/);
  });
});
