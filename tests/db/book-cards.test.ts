// 뉴스북 활동 카드·기사 요약·VOCA 카드 값 (T07 PR G)
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;

beforeAll(async () => {
  db = await createDb();
});

describe("활동 카드", () => {
  it("기사 요약 카드 값, 카드를 붙이면 뉴스북·인스타 올리기에 카드로", async () => {
    await db.transaction(async (tx) => {
      const one = async (sql: string, p: unknown[] = []) => (await tx.query<Row>(sql, p)).rows[0];
      const act = (await one("select public.start_activity('S-0002', 4, 'SUMMARY') as j")).j as { activity_id: string; enrollment_id: string };
      const head = (await one("select public.card_head('S-0002', $1) as j", [act.activity_id])).j as any;
      expect(head).toMatchObject({ activity_id: act.activity_id, type: "SUMMARY", week_no: 4, cohort_no: 1, name: "박서연", vocab: null });
      const en = act.enrollment_id;
      await tx.query("select public.attach_media('S-0002', $1, $2)", [act.activity_id, `photos/${en}/${act.activity_id}.jpg`]);
      await tx.query("select public.attach_card('S-0002', $1, $2)", [act.activity_id, `cards/${en}/${act.activity_id}-1.png`]);
      await tx.query("select public.complete_activity('S-0002', $1)", [act.activity_id]);

      // 카드 그림 키: card_key, 남의 것은 없음
      expect((await one("select public.activity_card('S-0002', $1) as k", [act.activity_id])).k).toBe(`cards/${en}/${act.activity_id}-1.png`);
      expect((await one("select public.activity_card('S-0001', $1) as k", [act.activity_id])).k).toBeNull();

      const q = (await one("select public.upload_queue('S-0002') as q")).q as any;
      expect(q.items.find((i: any) => i.activity_id === act.activity_id)).toMatchObject({ kind: "photo", card_key: `cards/${en}/${act.activity_id}-1.png` });
      const b = (await one("select public.newsbook('S-0002') as j")).j as any;
      expect(b.weeks[3].cards).toContainEqual({ activity_id: act.activity_id, type: "SUMMARY" });
      await tx.rollback();
    });
  });

  it("VOCA 카드 값: 이번 주 단어와 지금까지 익힌 단어(이번 주 포함)", async () => {
    await db.transaction(async (tx) => {
      const act = (await tx.query<Row>("select public.start_activity('S-0002', 4, 'VOCA') as j")).rows[0].j as { activity_id: string };
      const head = (await tx.query<Row>("select public.card_head('S-0002', $1) as j", [act.activity_id])).rows[0].j as any;
      expect(head.type).toBe("VOCA");
      expect(Array.isArray(head.vocab)).toBe(true);
      expect(head.vocab_total).toBeGreaterThanOrEqual(head.vocab.length);
      await tx.rollback();
    });
  });

  it("낭독은 카드가 있어도 영상(2단계)", async () => {
    await db.transaction(async (tx) => {
      const act = (await tx.query<Row>("select public.start_activity('S-0002', 4, 'EN_READING') as j")).rows[0].j as { activity_id: string; enrollment_id: string };
      const en = act.enrollment_id;
      await tx.query("select public.attach_card('S-0002', $1, $2)", [act.activity_id, `cards/${en}/${act.activity_id}-1.png`]);
      await tx.query("select public.complete_activity('S-0002', $1, $2)", [act.activity_id, `recordings/${en}/${act.activity_id}.webm`]);
      const q = (await tx.query<Row>("select public.upload_queue('S-0002') as q")).rows[0].q as any;
      expect(q.items.find((i: any) => i.activity_id === act.activity_id).kind).toBe("video");
      await tx.rollback();
    });
  });
});
