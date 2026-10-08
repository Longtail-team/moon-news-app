import "server-only";
import { db } from "./db";

/** 비공개 버킷의 파일이 실제로 있는지 */
export async function fileExists(bucket: string, path: string): Promise<boolean> {
  const i = path.lastIndexOf("/");
  const { data } = await db().storage.from(bucket).list(path.slice(0, i), { search: path.slice(i + 1), limit: 1 });
  return !!data?.some((f) => f.name === path.slice(i + 1));
}

/** 학습 자료 파일의 앱 주소(/files/주차/종류). 파일이 실제로 있을 때만, 없으면 null(준비 중)
 *  저장소 주소는 화면에 싣지 않는다: 누를 때 /files 경로가 수강·주차 공개를 확인하고 짧은 주소로 보낸다. */
export async function courseFileUrl(week: number, type: string, key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  return (await fileExists("course", key)) ? `/files/${week}/${type}` : null;
}

/** 짧은 유효시간 주소. 파일이 없으면 null */
export async function signedUrl(bucket: string, path: string | null | undefined, sec = 60 * 60): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await db().storage.from(bucket).createSignedUrl(path, sec);
  return error || !data ? null : data.signedUrl;
}
