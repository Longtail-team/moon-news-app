// 작성 활동(사진·VOCA 낭독)과 인스타 올리기 검증
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;
const NOW = "2026-10-07T12:00:00+09:00";

const one = async (q: PGlite | Transaction, sql: string, params: unknown[] = []) => (await q.query<Row>(sql, params)).rows[0]?.j as any;
const start = (tx: Transaction, student: string, week: number, type: string) =>
  one(tx, "select public.start_activity($1, $2, $3) as j", [student, week, type]);

beforeAll(async () => {
  db = await createDb();
});

describe("작성 활동", () => {
  it("사진을 붙이면 작성 중(CONTENT_READY) → 다시 열면 이어서 → 완료", async () => {
    await db.transaction(async (tx) => {
      const s = await start(tx, "S-0006", 1, "SUMMARY");
      const key = `photos/${s.enrollment_id}/${s.activity_id}-1.jpg`;
      await tx.query("select public.attach_media('S-0006', $1, $2)", [s.activity_id, key]);
      expect((await tx.query<Row>("select state, media_key from activities where activity_id = $1", [s.activity_id])).rows[0]).toEqual({ state: "CONTENT_READY", media_key: key });

      const m = await one(tx, "select public.work_material('S-0006', 1, 'SUMMARY', $1) as j", [NOW]);
      expect(m.draft).toEqual({ activity_id: s.activity_id, media_key: key });
      expect(m.title).toBe("RM Opens His Art Collection to the World");
      expect(m.assets.map((a: any) => a.type).sort()).toEqual(["article_pdf", "voca_pdf", "voca_repeat_audio"]);

      const done = await one(tx, "select public.complete_activity('S-0006', $1) as j", [s.activity_id]);
      expect(done).toEqual({ week_no: 1, week_completed: 1, first_en: false });
      await tx.rollback();
    });
  });

  it("요약·토론은 사진만, 낭독은 녹음만, VOCA는 둘 다 된다", async () => {
    const attach = (type: string, folder: "photos" | "recordings") =>
      db.transaction(async (tx) => {
        const s = await start(tx, "S-0006", 1, type);
        await tx.query("select public.attach_media('S-0006', $1, $2)", [s.activity_id, `${folder}/${s.enrollment_id}/x`]);
        await tx.rollback();
      });
    await expect(attach("DEBATE", "recordings")).rejects.toThrow(/invalid media key/);
    await expect(attach("EN_READING", "photos")).rejects.toThrow(/invalid media key/);
    await expect(attach("VOCA", "photos")).resolves.toBeUndefined();
    await expect(attach("VOCA", "recordings")).resolves.toBeUndefined();
  });

  it("파일 없이 완료할 수 없다", async () => {
    await expect(
      db.transaction(async (tx) => {
        const s = await start(tx, "S-0006", 1, "DEBATE");
        await tx.query("select public.complete_activity('S-0006', $1)", [s.activity_id]);
      }),
    ).rejects.toThrow(/invalid media key/);
  });

  it("VOCA 단어 목록", async () => {
    const m = await one(db, "select public.work_material('S-0001', 1, 'VOCA', $1) as j", [NOW]);
    expect(m.vocab).toEqual([
      { no: 1, word: "collection", meaning: "수집품, 소장품" },
      { no: 2, word: "exhibition", meaning: "전시회" },
    ]);
  });
});

describe("인스타 올리기", () => {
  it("올릴 것 목록: 김지우 2개(오래된 것부터), 녹음은 영상·사진은 사진", async () => {
    const q = await one(db, "select public.upload_queue('S-0001') as j");
    expect(q).toMatchObject({ deadline: "2026-12-06", total_target: 60, verified_count: 15 });
    expect(q.items).toHaveLength(2);
    expect(q.items.map((i: any) => i.week_no)).toEqual([3, 4]);
    expect(q.items[0].template_key).toBe(null); // 3주차 기사는 템플릿 이미지가 아직 없다
  });

  it("링크를 붙여넣으면 인증 → 올릴 것이 줄고 인스타 수가 는다", async () => {
    await db.transaction(async (tx) => {
      const q = await one(tx, "select public.upload_queue('S-0001') as j");
      const r = await one(tx, "select public.verify_activity('S-0001', $1, 'https://www.instagram.com/p/NEWPOST123/') as j", [q.items[0].activity_id]);
      expect(r).toEqual({ verified_count: 16, pending_count: 1 });
      const a = (await tx.query<Row>("select state, post_url from activities where activity_id = $1", [q.items[0].activity_id])).rows[0];
      expect(a).toEqual({ state: "VERIFIED", post_url: "https://www.instagram.com/p/NEWPOST123/" });
      await tx.rollback();
    });
  });

  it("같은 게시물 링크로 두 번 인증할 수 없다 (학습 1회 = 게시물 1개)", async () => {
    await expect(
      db.transaction(async (tx) => {
        const q = await one(tx, "select public.upload_queue('S-0001') as j");
        await tx.query("select public.verify_activity('S-0001', $1, 'https://www.instagram.com/reel/SAME_1/')", [q.items[0].activity_id]);
        await tx.query("select public.verify_activity('S-0001', $1, 'https://www.instagram.com/reel/SAME_1/')", [q.items[1].activity_id]);
      }),
    ).rejects.toThrow(/duplicate key|unique/);
  });

  it("인스타 게시물 주소가 아니거나, 남의 기록·완료 전 기록은 인증할 수 없다", async () => {
    const q = await one(db, "select public.upload_queue('S-0001') as j");
    await expect(db.query("select public.verify_activity('S-0001', $1, 'https://example.com/p/x/')", [q.items[0].activity_id])).rejects.toThrow(/invalid post url/);
    await expect(db.query("select public.verify_activity('S-0002', $1, 'https://www.instagram.com/p/X1/')", [q.items[0].activity_id])).rejects.toThrow(/not found/);
    await expect(
      db.transaction(async (tx) => {
        const s = await start(tx, "S-0006", 1, "SUMMARY");
        await tx.query("select public.verify_activity('S-0006', $1, 'https://www.instagram.com/p/X2/')", [s.activity_id]);
      }),
    ).rejects.toThrow(/not completed/);
  });
});
