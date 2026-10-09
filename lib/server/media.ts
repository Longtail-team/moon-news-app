import "server-only";
import { db } from "./db";

/** 비공개 버킷의 파일이 실제로 있는지 */
export async function fileExists(bucket: string, path: string): Promise<boolean> {
  const i = path.lastIndexOf("/");
  const { data } = await db().storage.from(bucket).list(path.slice(0, i), { search: path.slice(i + 1), limit: 1 });
  return !!data?.some((f) => f.name === path.slice(i + 1));
}

/** 학습 자료 파일의 앱 주소(/files/주차/종류). 연결된 파일이 없으면 null(준비 중)
 *  저장소 주소는 화면에 싣지 않는다: 누를 때 /files 경로가 수강·주차 공개를 확인하고 짧은 주소로 보낸다.
 *  자료 반영(scripts/sync-content.mjs)은 파일을 올린 뒤에만 연결을 기록하므로 저장소에 다시 묻지 않는다. */
export function courseFileUrl(week: number, type: string, key: string | null | undefined): string | null {
  return key ? `/files/${week}/${type}` : null;
}

/** 녹음·사진의 앱 주소(/media/활동). 누를 때 /media 경로가 주인을 확인하고 짧은 주소로 보낸다. */
export function activityMediaUrl(activityId: string, key: string | null | undefined): string | null {
  return key ? `/media/${activityId}` : null;
}
