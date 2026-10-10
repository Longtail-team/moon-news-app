// 내 기록·뉴스북: 학습자별·기수별, 진도 중간 열람, 종강 다음 날부터 다운로드
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;
const NOW = "2026-10-07T12:00:00+09:00"; // 1기 4주차(수), 종강 12/6(일)

const book = async (q: { query: PGlite["query"] } | PGlite, student: string, at = NOW, enrollment: string | null = null) =>
  (await q.query<Row>("select public.newsbook($1, $2, $3) as j", [student, enrollment, at])).rows[0].j as any;

beforeAll(async () => {
  db = await createDb();
});

describe("뉴스북", () => {
  it("시작한 주차만, 기록 숫자, 종강 다음 날부터 다운로드", async () => {
    const b = await book(db, "S-0001");
    expect(b.weeks.map((w: any) => w.week_no)).toEqual([1, 2, 3, 4]);
    expect(b.cohort).toMatchObject({ cohort_no: 1, deadline: "2026-12-06", weeks_total: 12 });
    expect(b.stats).toMatchObject({ articles: 4, weeks_met: 3 }); // 김지우: 1~3주차 5회, 4주차 2회
    expect(b.can_download).toBe(false);
    expect(b.download_from).toBe("2026-12-07");
    expect((await book(db, "S-0001", "2026-12-06T23:59:00+09:00")).can_download).toBe(false);
    expect((await book(db, "S-0001", "2026-12-07T00:00:00+09:00")).can_download).toBe(true);
  });

  it("기사 쪽: 가장 최근에 완료한 요약의 제목·요약, 마지막 의견, 의견이 있을 때만 찬반 결과", async () => {
    await db.transaction(async (tx) => {
      const en = (await tx.query<Row>("select enrollment_id from enrollments join cohorts using (cohort_id) where student_id = 'S-0001' and cohort_no = 1")).rows[0].enrollment_id;
      const add = async (type: string, completed: string | null, note: Record<string, string | null>, updated: string) => {
        const id = (await tx.query<Row>(
          `insert into activities (enrollment_id, week_no, activity_type, state, started_at, completed_at, media_key)
           values ($1::uuid, 3, $2, 'COMPLETED', '2026-09-29T09:00:00+09:00', $3, 'photos/' || $1::text || '/x.jpg') returning activity_id`,
          [en, type, completed],
        )).rows[0].activity_id;
        await tx.query("insert into activity_notes (activity_id, title, body, stance, reason, updated_at) values ($1, $2, $3, $4, $5, $6)",
          [id, note.title ?? null, note.body ?? null, note.stance ?? null, note.reason ?? null, updated]);
      };
      await add("SUMMARY", "2026-09-30T10:00:00+09:00", { title: "옛 제목", body: "old" }, "2026-09-30T10:00:00+09:00");
      await add("SUMMARY", "2026-10-01T10:00:00+09:00", { title: "RM의 미술관", body: "RM shared his art." }, "2026-10-01T10:00:00+09:00");
      await add("DEBATE", "2026-10-02T10:00:00+09:00", { stance: "agree", reason: "좋아서" }, "2026-10-02T10:00:00+09:00");
      const w3 = (await book(tx, "S-0001")).weeks[2];
      expect(w3.summary).toMatchObject({ title: "RM의 미술관", body: "RM shared his art.", has_photo: true });
      expect(w3.opinion).toEqual({ stance: "agree", reason: "좋아서" });
      expect(w3.tally).toEqual({ agree: 1, disagree: 0, unsure: 0, final: true }) // 잘 모르겠어요(2026-10-10);
      const w4 = (await book(tx, "S-0001")).weeks[3];
      expect(w4.summary).toBeNull();
      expect(w4.tally).toBeNull();
      await tx.rollback();
    });
  });

  it("재수강생은 지난 기수 뉴스북도 본다, 남의 수강은 볼 수 없다", async () => {
    const cur = await book(db, "S-0004");
    expect(cur.cohort.cohort_no).toBe(1);
    expect(cur.others).toHaveLength(1);
    const past = await book(db, "S-0004", NOW, cur.others[0].enrollment_id);
    expect(past).toMatchObject({ is_current: false, can_download: true });
    expect(past.cohort.cohort_no).toBe(0);
    expect(await book(db, "S-0001", NOW, cur.others[0].enrollment_id)).toBeNull();
  });
});

describe("내 기록: 완주 화면 모양의 기록", () => {
  it("인스타 올리기 수, 활동별 횟수, 소리 내어 읽은 영어 단어", async () => {
    const b = await book(db, "S-0001");
    const p = (await db.query<Row>("select verified_count, total_completed, reading_words from app.enrollment_progress($1) where student_id = 'S-0001'", [NOW])).rows[0];
    expect(b.cohort.total_target).toBe(60);
    expect(b.stats.verified).toBe(p.verified_count);
    expect(b.stats.completed).toBe(p.total_completed);
    expect(b.stats.reading_words).toBe(p.reading_words);
    const acts = b.stats.acts as Record<string, number>;
    expect(Object.values(acts).reduce((a, n) => a + n, 0)).toBe(b.stats.completed);
  });
});
