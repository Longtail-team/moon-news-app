// 활동 카드 보관과 읽기 완료 카드 값 (T07 PR C)
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;

beforeAll(async () => {
  db = await createDb();
});

// 실패해야 하는 호출: 저장점으로 감싸 트랜잭션이 이어지게
async function fails(tx: { query: PGlite["query"] }, sql: string, params: unknown[], re: RegExp) {
  await tx.query("savepoint s");
  await expect(tx.query(sql, params)).rejects.toThrow(re);
  await tx.query("rollback to savepoint s");
}

describe("읽기 완료 카드", () => {
  it("카드 값: 이번 낭독을 포함한 누적(완료 전에도), 영어는 기사 단어 수", async () => {
    await db.transaction(async (tx) => {
      const one = async (sql: string, p: unknown[] = []) => (await tx.query<Row>(sql, p)).rows[0];
      const before = await one(
        `select coalesce(sum(ar.word_count) filter (where a.activity_type = 'EN_READING'), 0)::int as words, count(*)::int as reads
         from activities a join enrollments en using (enrollment_id) join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = a.week_no
         left join articles ar on ar.article_id = w.article_id
         where en.student_id = 'S-0001' and en.enrollment_id = app.current_enrollment('S-0001') and a.completed_at is not null and a.activity_type in ('KR_READING', 'EN_READING')`,
      );
      const act = (await one("select public.start_activity('S-0001', 1, 'EN_READING') as j")).j as { activity_id: string };
      const card = (await one("select public.reading_card('S-0001', $1) as j", [act.activity_id])).j as any;
      expect(card).toMatchObject({ activity_id: act.activity_id, week_no: 1, cohort_no: 1, name: "김지우", lang: "en", words: 173, title: "RM Opens His Art Collection to the World" });
      expect(card.total_words).toBe((before.words as number) + 173);
      expect(card.total_reads).toBe((before.reads as number) + 1);

      // 한국어 낭독 카드: 낭독 횟수는 한국어 + 영어
      const kr = (await one("select public.start_activity('S-0001', 1, 'KR_READING') as j")).j as { activity_id: string };
      const k = (await one("select public.reading_card('S-0001', $1) as j", [kr.activity_id])).j as any;
      expect(k).toMatchObject({ lang: "kr", total_reads: (before.reads as number) + 1 }); // 영어 낭독은 아직 완료 전이라 빼고 이번 것만
      await tx.rollback();
    });
  });

  it("남의 활동·읽기가 아닌 활동은 값 없음", async () => {
    await db.transaction(async (tx) => {
      const act = (await tx.query<Row>("select public.start_activity('S-0001', 1, 'EN_READING') as j")).rows[0].j as { activity_id: string };
      expect((await tx.query<Row>("select public.reading_card('S-0002', $1) as j", [act.activity_id])).rows[0].j).toBeNull();
      const su = (await tx.query<Row>("select public.start_activity('S-0001', 1, 'SUMMARY') as j")).rows[0].j as { activity_id: string };
      expect((await tx.query<Row>("select public.reading_card('S-0001', $1) as j", [su.activity_id])).rows[0].j).toBeNull();
      await tx.rollback();
    });
  });
});

describe("카드 붙이기", () => {
  it("cards/<수강>/<활동>-… 만, 완료 전후 모두, 청독은 안 됨", async () => {
    await db.transaction(async (tx) => {
      const act = (await tx.query<Row>("select public.start_activity('S-0001', 1, 'EN_READING') as j")).rows[0].j as { activity_id: string; enrollment_id: string };
      const en = act.enrollment_id;
      await fails(tx, "select public.attach_card('S-0001', $1, $2)", [act.activity_id, `photos/${en}/${act.activity_id}-1.png`], /invalid card key/);
      await fails(tx, "select public.attach_card('S-0001', $1, $2)", [act.activity_id, `cards/${en}/other-1.png`], /invalid card key/);
      await fails(tx, "select public.attach_card('S-0002', $1, $2)", [act.activity_id, `cards/${en}/${act.activity_id}-1.png`], /not found/);

      // 완료 전에 붙이고, 녹음으로 완료해도 카드는 남는다
      const key = `cards/${en}/${act.activity_id}-1.png`;
      await tx.query("select public.attach_card('S-0001', $1, $2)", [act.activity_id, key]);
      await tx.query("select public.complete_activity('S-0001', $1, $2)", [act.activity_id, `recordings/${en}/${act.activity_id}.webm`]);
      const row = (await tx.query<Row>("select media_key, card_key, completed_at is not null as done from activities where activity_id = $1", [act.activity_id])).rows[0];
      expect(row).toMatchObject({ media_key: `recordings/${en}/${act.activity_id}.webm`, card_key: key, done: true });
      // 완료 뒤에도 바꿀 수 있음
      await tx.query("select public.attach_card('S-0001', $1, $2)", [act.activity_id, `cards/${en}/${act.activity_id}-2.png`]);
      await tx.rollback();
    });
  });

  it("청독은 media_key가 카드라 붙이지 않는다", async () => {
    await db.transaction(async (tx) => {
      const card = (await tx.query<Row>(`select public.start_listening('S-0002', 4, '{"article_audio": 1}'::jsonb, 100) as j`)).rows[0].j as any;
      const en = (await tx.query<Row>("select enrollment_id from activities where activity_id = $1", [card.activity_id])).rows[0].enrollment_id;
      await fails(tx, "select public.attach_card('S-0002', $1, $2)", [card.activity_id, `cards/${en}/${card.activity_id}-1.png`], /listening card is media/);
      await tx.rollback();
    });
  });
});
