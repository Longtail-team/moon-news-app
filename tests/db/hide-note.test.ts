// 친구 의견 숨김 (T07 PR F)
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;

beforeAll(async () => {
  db = await createDb();
});

describe("친구 의견 숨김", () => {
  it("내 활동만 숨기고, 숨긴 글은 친구에게서 빠지고 본인에게는 남는다", async () => {
    await db.transaction(async (tx) => {
      const act = (await tx.query<Row>("select public.start_activity('S-0001', 4, 'DEBATE') as j")).rows[0].j as { activity_id: string; enrollment_id: string };
      await tx.query("select public.save_note('S-0001', $1, null, null, 'agree', '연락해 01012345678')", [act.activity_id]);
      await tx.query("select public.complete_activity('S-0001', $1, $2)", [act.activity_id, `cards/${act.enrollment_id}/${act.activity_id}-1.png`]);
      // 남의 활동은 숨기지 못함
      await tx.query("select public.hide_note('S-0002', $1, 'contact')", [act.activity_id]);
      expect((await tx.query<Row>("select hidden_at from activity_notes where activity_id = $1", [act.activity_id])).rows[0].hidden_at).toBeNull();
      await tx.query("select public.hide_note('S-0001', $1, 'contact')", [act.activity_id]);
      expect((await tx.query<Row>("select hidden_why from activity_notes where activity_id = $1", [act.activity_id])).rows[0].hidden_why).toBe("contact");
      const friend = (await tx.query<Row>("select public.debate_board('S-0002', 4) as j")).rows[0].j as any;
      expect(friend.opinions.some((o: any) => o.reason?.includes("0101234"))).toBe(false);
      const mine = (await tx.query<Row>("select public.debate_board('S-0001', 4) as j")).rows[0].j as any;
      expect(mine.mine.reason).toContain("01012345678");
      await tx.rollback();
    });
  });
});
