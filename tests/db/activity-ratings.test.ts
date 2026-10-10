// 활동 평가: 청독 이해도 5단계(첫 청독 필수), 토론 주제 반응 (T07 PR D)
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;

beforeAll(async () => {
  db = await createDb();
});

async function fails(tx: { query: PGlite["query"] }, sql: string, params: unknown[], re: RegExp) {
  await tx.query("savepoint s");
  await expect(tx.query(sql, params)).rejects.toThrow(re);
  await tx.query("rollback to savepoint s");
}

describe("청독 이해도", () => {
  it("주차 첫 평가는 필수(is_first), 다시 청독한 평가는 첫 평가가 아님", async () => {
    await db.transaction(async (tx) => {
      const needed = async () => (await tx.query<Row>("select public.rating_needed('S-0002', 4, 'listen_understanding') as b")).rows[0].b;
      expect(await needed()).toBe(true);
      const a1 = ((await tx.query<Row>(`select public.start_listening('S-0002', 4, '{"article_audio": 1}'::jsonb, 100) as j`)).rows[0].j as any).activity_id;
      const r1 = (await tx.query<Row>("select public.rate_activity('S-0002', $1, 'listen_understanding', 3) as j", [a1])).rows[0].j as any;
      expect(r1.is_first).toBe(true);
      expect(await needed()).toBe(false);
      // 같은 활동을 다시 누르면 고침(첫 평가 그대로)
      const again = (await tx.query<Row>("select public.rate_activity('S-0002', $1, 'listen_understanding', 4) as j", [a1])).rows[0].j as any;
      expect(again.is_first).toBe(true);
      expect((await tx.query<Row>("select value from activity_ratings where activity_id = $1", [a1])).rows[0].value).toBe(4);

      // 다시 청독(새 활동)
      const en = (await tx.query<Row>("select enrollment_id from activities where activity_id = $1", [a1])).rows[0].enrollment_id;
      await tx.query("select public.complete_activity('S-0002', $1, $2)", [a1, `cards/${en}/${a1}.png`]);
      const a2 = ((await tx.query<Row>(`select public.start_listening('S-0002', 4, '{"article_audio": 1}'::jsonb, 80) as j`)).rows[0].j as any).activity_id;
      const r2 = (await tx.query<Row>("select public.rate_activity('S-0002', $1, 'listen_understanding', 5) as j", [a2])).rows[0].j as any;
      expect(r2.is_first).toBe(false);
      // 다른 주차는 따로
      expect((await tx.query<Row>("select public.rating_needed('S-0002', 3, 'listen_understanding') as b")).rows[0].b).toBe(true);
      await tx.rollback();
    });
  });

  it("값 범위·종류·주인 확인", async () => {
    await db.transaction(async (tx) => {
      const a = ((await tx.query<Row>(`select public.start_listening('S-0002', 4, '{"article_audio": 1}'::jsonb, 100) as j`)).rows[0].j as any).activity_id;
      await fails(tx, "select public.rate_activity('S-0002', $1, 'listen_understanding', 6)", [a], /check constraint/);
      await fails(tx, "select public.rate_activity('S-0002', $1, 'debate_feel', 2)", [a], /does not match/);
      await fails(tx, "select public.rate_activity('S-0001', $1, 'listen_understanding', 2)", [a], /not found/);
      const ex = (await tx.query<Row>("select public.start_activity('S-0002', 4, 'EN_READING') as j")).rows[0].j as any;
      await fails(tx, "select public.rate_activity('S-0002', $1, 'listen_understanding', 2)", [ex.activity_id], /does not match/);
      await tx.rollback();
    });
  });
});
