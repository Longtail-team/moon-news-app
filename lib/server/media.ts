import "server-only";
import { db } from "./db";

/** 비공개 버킷의 파일이 실제로 있는지 */
export async function fileExists(bucket: string, path: string): Promise<boolean> {
  const i = path.lastIndexOf("/");
  const { data } = await db().storage.from(bucket).list(path.slice(0, i), { search: path.slice(i + 1), limit: 1 });
  return !!data?.some((f) => f.name === path.slice(i + 1));
}

/** 짧은 유효시간 주소. 파일이 없으면 null */
export async function signedUrl(bucket: string, path: string | null | undefined, sec = 60 * 60): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await db().storage.from(bucket).createSignedUrl(path, sec);
  return error || !data ? null : data.signedUrl;
}
