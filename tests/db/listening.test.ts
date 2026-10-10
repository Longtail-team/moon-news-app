// 청독 미션: 재생 시간 기록, 청독 완료(카드) = 학습 1회, 인스타 올리기·뉴스북
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;

beforeAll(async () => {
  db = await createDb();
});

describe("청독", () => {
  it("재생 시간은 반복까지 모두 쌓이고, 한 번에 120초까지, 시작 전 주차는 버린다", async () => {
    await db.transaction(async (tx) => {
      const log = (week: number, audio: string, s: number) => tx.query("select public.log_listening('S-0002', $1, $2, $3)", [week, audio, s]);
      await log(4, "article_audio", 100);
      await log(4, "article_audio", 100); // 반복 재생
      await log(4, "voca_repeat_audio", 500); // 120초로 자름
      await log(12, "article_audio", 60); // 시작 전 주차
      const t = (await tx.query<Row>(
        "select sum(seconds)::int as s from listening_logs l join enrollments en using (enrollment_id) where en.student_id = 'S-0002'",
      )).rows[0].s;
      expect(t).toBe(320);
      await tx.rollback();
    });
  });

  it("청독 완료: 카드 값 고정 → 카드 그림을 붙여 학습 완료 → 사진처럼 올릴 것, 뉴스북 주차 카드", async () => {
    await db.transaction(async (tx) => {
      await tx.query("select public.log_listening('S-0002', 4, 'article_audio', 120)");
      await tx.query("select public.log_listening('S-0002', 4, 'kr_en_repeat_audio', 90)");
      const card = (await tx.query<Row>(
        `select public.start_listening('S-0002', 4, '{"article_audio": 2, "kr_en_repeat_audio": 1}'::jsonb, 210) as j`,
      )).rows[0].j as any;
      expect(card).toMatchObject({ week_no: 4, cohort_no: 1, name: "박서연", session_seconds: 210, total_seconds: 210 });
      const en = (await tx.query<Row>("select enrollment_id from activities where activity_id = $1", [card.activity_id])).rows[0].enrollment_id;

      // 카드 그림 경로는 cards/<수강>/ 만
      await expect(tx.query("select public.complete_activity('S-0002', $1, $2)", [card.activity_id, `photos/${en}/x.png`])).rejects.toThrow(/invalid media key/);
    });
    await db.transaction(async (tx) => {
      const card = (await tx.query<Row>(`select public.start_listening('S-0002', 4, '{"article_audio": 1}'::jsonb, 100) as j`)).rows[0].j as any;
      const en = (await tx.query<Row>("select enrollment_id from activities where activity_id = $1", [card.activity_id])).rows[0].enrollment_id;
      const before = (await tx.query<Row>("select public.student_home('S-0002') as h")).rows[0].h as any;
      await tx.query("select public.complete_activity('S-0002', $1, $2)", [card.activity_id, `cards/${en}/${card.activity_id}.png`]);
      const after = (await tx.query<Row>("select public.student_home('S-0002') as h")).rows[0].h as any;
      expect(after.progress.total_completed).toBe(before.progress.total_completed + 1); // 학습 1회

      const q = (await tx.query<Row>("select public.upload_queue('S-0002') as q")).rows[0].q as any;
      const item = q.items.find((i: any) => i.activity_id === card.activity_id);
      expect(item).toMatchObject({ activity_type: "LISTENING", kind: "photo" });
      // 인스타용 카드를 다시 그릴 값
      expect(item.card).toMatchObject({ activity_id: card.activity_id, week_no: 4, name: "박서연", plays: { article_audio: 1 }, session_seconds: 100, date: card.date });

      const b = (await tx.query<Row>("select public.newsbook('S-0002') as j")).rows[0].j as any;
      expect(b.weeks[3].cards).toEqual([{ activity_id: card.activity_id, type: "LISTENING" }]); // 활동 종류(2026-10-10, 뉴스북 활동 카드 모두)
      expect(b.stats.acts.LISTENING).toBe(1);
      await tx.rollback();
    });
  });

  it("아무 음원도 다 듣지 않았으면 청독 완료를 만들 수 없다", async () => {
    await expect(db.query(`select public.start_listening('S-0002', 4, '{"article_audio": 0}'::jsonb, 30)`)).rejects.toThrow(/no plays/);
  });
});
