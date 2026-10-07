// T03 세션 범위와 학생 홈 데이터 검증
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./setup";

type Row = Record<string, unknown>;
let db: PGlite;

// 접속 링크(샘플 토큰)로 세션을 만들고 그 해시를 돌려준다
async function sessionFor(rawToken: string, tag: string): Promise<string> {
  const hash = `session-hash-${tag}`;
  await db.query(
    `insert into sessions (session_hash, token_id, expires_at)
     select $1, token_id, now() + interval '180 days' from access_tokens
     where token_hash = encode(sha256(convert_to($2, 'UTF8')), 'hex')`,
    [hash, rawToken],
  );
  return hash;
}

async function scope(hash: string): Promise<string[]> {
  const r = await db.query<Row>("select student_id from public.session_scope($1)", [hash]);
  return r.rows.map((x) => x.student_id as string);
}

beforeAll(async () => {
  db = await createDb();
});

describe("세션 범위", () => {
  it("보호자 링크: 형제 보호자는 자녀 두 명을 모두 본다", async () => {
    expect(await scope(await sessionFor("sample-token-S-0007", "g7"))).toEqual(["S-0007", "S-0008"]);
  });

  it("자녀 링크: 그 자녀 한 명만 본다", async () => {
    expect(await scope(await sessionFor("sample-token-S-0003-child", "c3"))).toEqual(["S-0003"]);
  });

  it("환불로 링크가 폐기되면 세션도 막힌다 (정민준)", async () => {
    // 정민준의 링크는 샘플 데이터에서 이미 폐기됨 → 세션을 만들어도 범위가 비어 있다
    expect(await scope(await sessionFor("sample-token-S-0005", "m5"))).toEqual([]);
  });

  it("링크가 나중에 폐기되면 이미 만든 세션도 함께 끝난다", async () => {
    const hash = await sessionFor("sample-token-S-0001", "j1");
    expect(await scope(hash)).toEqual(["S-0001"]);
    await db.transaction(async (tx) => {
      await tx.query("update access_tokens set revoked_at = now() where student_id = 'S-0001'");
      const r = await tx.query<Row>("select revoked_at from sessions where session_hash = $1", [hash]);
      expect(r.rows[0].revoked_at).not.toBeNull();
      const s = await tx.query<Row>("select count(*)::int as n from public.session_scope($1)", [hash]);
      expect(s.rows[0].n).toBe(0);
      await tx.rollback();
    });
  });

  it("만료된 세션과 없는 세션은 비어 있다", async () => {
    const hash = await sessionFor("sample-token-S-0002", "s2");
    await db.query("update sessions set expires_at = now() - interval '1 second' where session_hash = $1", [hash]);
    expect(await scope(hash)).toEqual([]);
    expect(await scope("no-such-session")).toEqual([]);
  });
});

describe("학생 홈 데이터", () => {
  const home = async (student: string) =>
    (await db.query<Row>("select public.student_home($1, '2026-10-07T12:00:00+09:00') as h", [student])).rows[0].h as Record<string, any>;

  it("김지우: 4주차, 이번 주 2, 인스타 15, 12주 칸", async () => {
    const h = await home("S-0001");
    expect(h.cohort).toMatchObject({ course_title: "새벽달 영어뉴스", cohort_no: 1, deadline: "2026-12-06", total_target: 60 });
    expect(h.progress).toMatchObject({ current_week: 4, this_week_completed: 2, total_completed: 17, verified_count: 15, pending_post_count: 2 });
    expect(h.weeks).toHaveLength(12);
    expect(h.weeks[0].acts).toEqual(["KR_READING", "VOCA", "SUMMARY", "DEBATE", "EN_READING"]);
    expect(h.weeks[3].acts).toEqual(["KR_READING", "VOCA"]); // 작성 중(시작만) 활동은 칸에 없다
    expect(h.weeks[0].title).toBe("RM Opens His Art Collection to the World");
    expect(h.weeks[4].title).toBeNull(); // 5주차 기사는 아직 공개 전
    expect(h.live).toBeNull();
  });

  it("재수강생은 가장 최근 기수(1기)를 보여 준다", async () => {
    expect((await home("S-0004")).cohort.cohort_no).toBe(1);
  });

  it("환불만 남은 학습자는 홈 데이터가 없다", async () => {
    expect(await home("S-0005")).toBeNull();
  });

  it("라이브 3일 전부터 카드 정보가 들어온다", async () => {
    const r = await db.query<Row>("select public.student_home('S-0001', '2026-10-21T21:00:00+09:00') as h");
    expect((r.rows[0].h as any).live).toMatchObject({ session_no: 1 });
  });
});
