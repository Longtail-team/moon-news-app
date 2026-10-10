// 찬반토론 판(T07 PR E): 3지선다, 친구 의견(이름 없이), 숨김, 마감 뒤 의견, 토론 카드를 파일로
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;

beforeAll(async () => {
  db = await createDb();
});

type Tx = { query: PGlite["query"] };
const board = async (tx: Tx, s: string, at?: string) =>
  (await tx.query<Row>(at ? "select public.debate_board($1, 4, $2) as j" : "select public.debate_board($1, 4) as j", at ? [s, at] : [s])).rows[0].j as any;

// 의견 내기: 시작 → 입장·이유 저장 → 토론 카드를 파일로 완료
async function vote(tx: Tx, s: string, stance: string, reason: string | null, at?: string) {
  const act = (await tx.query<Row>("select public.start_activity($1, 4, 'DEBATE') as j", [s])).rows[0].j as { activity_id: string; enrollment_id: string };
  await tx.query("select public.save_note($1, $2, null, null, $3, $4" + (at ? ", $5)" : ")"), at ? [s, act.activity_id, stance, reason, at] : [s, act.activity_id, stance, reason]);
  await tx.query("select public.complete_activity($1, $2, $3)", [s, act.activity_id, `cards/${act.enrollment_id}/${act.activity_id}-1.png`]);
  return act.activity_id;
}

describe("찬반토론 판", () => {
  it("질문이 없으면 null, 잘 모르겠어요 포함 비율은 나를 빼고, 친구 의견은 이름 없이", async () => {
    await db.transaction(async (tx) => {
      const b0 = await board(tx, "S-0001");
      expect(b0).toMatchObject({ week_no: 4, question: null, mine: null });
      await tx.query(
        "update articles set debate_question = '유명인이 모은 미술품을 미술관에서 전시하는 것, 좋은 일일까요?' where article_id = (select w.article_id from cohort_weeks w join enrollments en on en.cohort_id = w.cohort_id where en.student_id = 'S-0001' and w.week_no = 4 limit 1)",
      );
      const before = (await board(tx, "S-0001")).counts;

      await vote(tx, "S-0002", "unsure", "팬만 가는 전시가 될까 봐 고민돼요.");
      const mine = await vote(tx, "S-0001", "disagree", "사람이 너무 몰릴 것 같아요.");

      const b1 = await board(tx, "S-0001");
      expect(b1.question).toContain("미술관");
      expect(b1.counts.unsure).toBe(before.unsure + 1); // 친구(S-0002) 것만
      expect(b1.counts.disagree).toBe(before.disagree); // 내 것은 빼고
      expect(b1.mine).toMatchObject({ stance: "disagree", reason: "사람이 너무 몰릴 것 같아요.", counted: true });
      expect(b1.opinions.some((o: any) => o.reason === "팬만 가는 전시가 될까 봐 고민돼요." && o.stance === "unsure")).toBe(true);
      expect(JSON.stringify(b1.opinions)).not.toMatch(/student|name|enrollment/); // 이름·학습자 정보 없음

      // 친구 쪽에서 보면 내 의견이 비율·의견에 들어감
      const b2 = await board(tx, "S-0002");
      expect(b2.counts.disagree).toBe(before.disagree + 1);
      expect(b2.opinions.some((o: any) => o.reason === "사람이 너무 몰릴 것 같아요.")).toBe(true);

      // 숨긴 글: 친구들에게만 안 보이고 본인에게는 보인다
      await tx.query("update activity_notes set hidden_at = now() where activity_id = $1", [mine]);
      expect((await board(tx, "S-0002")).opinions.some((o: any) => o.reason === "사람이 너무 몰릴 것 같아요.")).toBe(false);
      expect((await board(tx, "S-0001")).mine.reason).toBe("사람이 너무 몰릴 것 같아요.");

      // 낸 의견은 고치지 않는다
      await tx.query("savepoint s");
      await expect(tx.query("select public.save_note('S-0001', $1, null, null, 'agree', 'x')", [mine])).rejects.toThrow(/already completed/);
      await tx.query("rollback to savepoint s");
      await tx.rollback();
    });
  });

  it("마감 뒤에 낸 의견: 학습 1회는 인정, 비율·친구 의견에는 안 들어감", async () => {
    await db.transaction(async (tx) => {
      const late = "2026-10-20T12:00:00+09:00"; // 4주차 마감 뒤
      const before = (await board(tx, "S-0002", late)).counts;
      await vote(tx, "S-0001", "agree", "늦게 낸 의견", late);
      const b = await board(tx, "S-0002", late);
      expect(b.open).toBe(false);
      expect(b.counts.agree).toBe(before.agree);
      expect(b.opinions.some((o: any) => o.reason === "늦게 낸 의견")).toBe(false);
      expect((await board(tx, "S-0001", late)).mine).toMatchObject({ stance: "agree", counted: false });
      await tx.rollback();
    });
  });
});
