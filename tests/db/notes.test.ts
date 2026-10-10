// 기자수첩(요약 제목·텍스트)과 의견·찬반 투표
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;
const NOW = "2026-10-07T12:00:00+09:00"; // 1기 4주차(수). 4주차 끝 = 10/12(월) 0시

beforeAll(async () => {
  db = await createDb();
});

// 학습자의 1기 수강에 활동 하나를 만든다
async function act(tx: Transaction, student: string, week: number, type: string, completedAt: string | null = null): Promise<string> {
  const r = await tx.query<Row>(
    `insert into activities (enrollment_id, week_no, activity_type, state, started_at, completed_at, media_key)
     select en.enrollment_id, $2, $3, case when $4::timestamptz is null then 'STARTED' else 'COMPLETED' end,
            $4::timestamptz - interval '1 hour', $4::timestamptz, 'photos/' || en.enrollment_id || '/t.jpg'
     from enrollments en join cohorts c using (cohort_id) where en.student_id = $1 and c.cohort_no = 1
     returning activity_id`,
    [student, week, type, completedAt ?? "2026-10-07T11:00:00+09:00"],
  );
  const id = r.rows[0].activity_id as string;
  if (!completedAt) await tx.query("update activities set completed_at = null, state = 'CONTENT_READY' where activity_id = $1", [id]);
  return id;
}

const save = (tx: Transaction, student: string, id: string, v: { title?: string; body?: string; stance?: string; reason?: string }, at = NOW) =>
  tx.query("select public.save_note($1, $2, $3, $4, $5, $6, $7)", [student, id, v.title ?? null, v.body ?? null, v.stance ?? null, v.reason ?? null, at]);

describe("기자수첩", () => {
  it("요약에 제목·요약을 저장하고 다시 열면 이어서 보인다", async () => {
    await db.transaction(async (tx) => {
      const id = await act(tx, "S-0002", 4, "SUMMARY");
      await save(tx, "S-0002", id, { title: "  RM의 미술관  ", body: "RM opened his collection." });
      const m = (await tx.query<Row>("select public.work_material('S-0002', 4, 'SUMMARY', $1) as j", [NOW])).rows[0].j as any;
      expect(m.draft.activity_id).toBe(id);
      expect(m.draft.note).toMatchObject({ title: "RM의 미술관", body: "RM opened his collection.", ocr_left: 3 });
      await tx.rollback();
    });
  });

  it("남의 활동, 완료한 활동, VOCA에는 저장할 수 없다", async () => {
    await db.transaction(async (tx) => {
      const mine = await act(tx, "S-0002", 4, "SUMMARY");
      await expect(save(tx, "S-0001", mine, { title: "x" })).rejects.toThrow(/not found/);
      await tx.rollback();
    });
    await db.transaction(async (tx) => {
      const done = await act(tx, "S-0002", 4, "SUMMARY", "2026-10-07T10:00:00+09:00");
      await expect(save(tx, "S-0002", done, { title: "x" })).rejects.toThrow(/already completed/);
      await tx.rollback();
    });
    await db.transaction(async (tx) => {
      const voca = await act(tx, "S-0002", 4, "VOCA");
      await expect(save(tx, "S-0002", voca, { title: "x" })).rejects.toThrow(/only for summary/);
      await tx.rollback();
    });
  });

  it("사진 글자 읽기는 보호자가 AI 동의를 하지 않으면 쓸 수 없다", async () => {
    await db.transaction(async (tx) => {
      const id = await act(tx, "S-0002", 4, "SUMMARY");
      const m = (await tx.query<Row>("select public.work_material('S-0002', 4, 'SUMMARY', $1) as j", [NOW])).rows[0].j as any;
      expect(m.ocr_consent).toBe(false);
      await expect(tx.query("select public.ocr_take('S-0002', $1)", [id])).rejects.toThrow(/no ai consent/);
      await tx.rollback();
    });
  });

  it("AI 동의는 그 보호자의 학습자에게만 저장된다", async () => {
    await db.transaction(async (tx) => {
      const g = async (s: string) => (await tx.query<Row>("select guardian_id from students where student_id = $1", [s])).rows[0].guardian_id;
      await tx.query("select public.set_ai_consent($1, 'S-0002', true)", [await g("S-0002")]);
      expect((await tx.query<Row>("select ai_ocr_consent_at is not null as on from students where student_id = 'S-0002'")).rows[0].on).toBe(true);
      await tx.query("select public.set_ai_consent($1, 'S-0002', false)", [await g("S-0002")]);
      expect((await tx.query<Row>("select ai_ocr_consent_at is null as off from students where student_id = 'S-0002'")).rows[0].off).toBe(true);
      await expect(tx.query("select public.set_ai_consent($1, 'S-0002', true)", [await g("S-0001")])).rejects.toThrow(/not found/);
      await tx.rollback();
    });
  });

  it("사진 글자 읽기는 활동마다 3번까지", async () => {
    await db.transaction(async (tx) => {
      const id = await act(tx, "S-0002", 4, "SUMMARY");
      await tx.query("update students set ai_ocr_consent_at = now() where student_id = 'S-0002'");
      const take = () => tx.query<Row>("select public.ocr_take('S-0002', $1) as k", [id]).then((r) => r.rows[0].k);
      expect(await take()).toMatch(/^photos\//);
      await take();
      await take();
      await expect(take()).rejects.toThrow(/ocr limit/);
      await tx.rollback();
    });
  });
});

describe("의견·찬반 투표", () => {
  // 2026-10-10 바뀐 규칙(T07 PR E): 마감 뒤 의견도 저장하되(학습 1회 인정) 비율·친구 의견에는 넣지 않는다(after_close)
  it("주차 일요일 자정(다음 월 0시)이 지나면 마감 표시, 그 뒤 의견은 after_close로 저장", async () => {
    await db.transaction(async (tx) => {
      const id = await act(tx, "S-0002", 4, "DEBATE");
      const open = async (at: string) => ((await tx.query<Row>("select public.work_material('S-0002', 4, 'DEBATE', $1) as j", [at])).rows[0].j as any).vote_open;
      expect(await open("2026-10-11T23:59:00+09:00")).toBe(true);
      expect(await open("2026-10-12T00:00:00+09:00")).toBe(false);
      await save(tx, "S-0002", id, { stance: "agree", reason: "좋은 전시라서" }, "2026-10-11T23:59:00+09:00");
      expect((await tx.query<Row>("select after_close from activity_notes where activity_id = $1", [id])).rows[0].after_close).toBe(false);
      await save(tx, "S-0002", id, { stance: "disagree" }, "2026-10-12T00:00:00+09:00");
      expect((await tx.query<Row>("select stance, after_close from activity_notes where activity_id = $1", [id])).rows[0]).toEqual({ stance: "disagree", after_close: true });
      await tx.rollback();
    });
  });

  it("찬반 결과: 마감 전에 저장된 의견, 학습자마다 마지막 1개 (고르지 않음으로 바꾸면 빠진다)", async () => {
    await db.transaction(async (tx) => {
      const note = async (s: string, stance: string | null, at: string) => {
        const id = await act(tx, s, 4, "DEBATE");
        await tx.query("insert into activity_notes (activity_id, stance, updated_at) values ($1, $2, $3)", [id, stance, at]);
      };
      await note("S-0002", "agree", "2026-10-06T10:00:00+09:00");
      await note("S-0002", "disagree", "2026-10-08T10:00:00+09:00"); // 박서연 마지막 = 반대
      await note("S-0001", "agree", "2026-10-09T10:00:00+09:00");
      await note("S-0003", "agree", "2026-10-07T10:00:00+09:00");
      await note("S-0003", null, "2026-10-08T10:00:00+09:00"); // 이도윤은 고르지 않음으로 바꿈
      const t = (await tx.query<Row>("select * from app.debate_tally((select cohort_id from cohorts where cohort_no = 1), 4)")).rows[0];
      expect(t).toEqual({ agree: 1, disagree: 1, unsure: 0 }); // 잘 모르겠어요(2026-10-10 추가)

      // 결과는 의견을 고른 학습자에게만
      const my = async (s: string) => (await tx.query<Row>("select public.my_debate_tally($1, 4, $2) as j", [s, NOW])).rows[0].j as any;
      expect(await my("S-0002")).toEqual({ agree: 1, disagree: 1, mine: "disagree" });
      expect(await my("S-0003")).toBeNull();
      expect(await my("S-0007")).toBeNull();
      const wm = (await tx.query<Row>("select public.work_material('S-0001', 4, 'DEBATE', $1) as j", [NOW])).rows[0].j as any;
      expect(wm.tally).toMatchObject({ mine: "agree" });
      await tx.rollback();
    });
  });

});
