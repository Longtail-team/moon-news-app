// 카드에 넣을 작성지 사진 작게 불러오기(저사양 기준, T07 4-1): 긴 변 약 600px. 실패하면 null(사진 없이 카드)
export type Thumb = CanvasImageSource & { width: number; height: number };

export async function loadThumb(src: Blob | string | null, max = 600): Promise<Thumb | null> {
  if (!src) return null;
  try {
    const blob = typeof src === "string" ? await fetch(src).then((r) => (r.ok ? r.blob() : Promise.reject())) : src;
    const full = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(full.width, full.height));
    if (k === 1) return full;
    const small = await createImageBitmap(full, { resizeWidth: Math.round(full.width * k), resizeHeight: Math.round(full.height * k), resizeQuality: "high" });
    full.close(); // 큰 사진 메모리 바로 비우기
    return small;
  } catch {
    return null;
  }
}
