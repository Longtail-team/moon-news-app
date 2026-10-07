// PGlite(브라우저·Node에서 도는 PostgreSQL)에 Supabase 기본 요소를 흉내 내고 마이그레이션과 샘플 데이터를 올린다.
// Docker 없이 데이터 계층을 검증하기 위한 것. 실제 Supabase에는 supabase/migrations만 적용한다.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`;

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  await db.exec(readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8"));
  return db;
}

// 학습자 앱 세션처럼 authenticated 역할 + JWT 값으로 실행한다.
export async function asUser<T>(db: PGlite, claims: Record<string, unknown> | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${claims ? "authenticated" : "anon"}`);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims ?? {})]);
    return fn(tx);
  });
}
