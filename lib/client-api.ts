// 브라우저 → 우리 서버 API
export async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw Object.assign(new Error(j.error ?? `${url} ${r.status}`), { code: j.error });
  return j;
}

/** 서버가 준 주소로 Storage 비공개 버킷에 바로 올리고 경로를 돌려준다 */
export async function uploadMedia(activityId: string, blob: Blob, mime: string): Promise<string> {
  const u = await post<{ path: string; uploadUrl: string; contentType: string }>("/api/activity/upload-url", { activityId, mime });
  const put = await fetch(u.uploadUrl, { method: "PUT", headers: { "content-type": u.contentType, "x-upsert": "false" }, body: blob });
  if (!put.ok) throw new Error(`upload ${put.status}`);
  return u.path;
}
