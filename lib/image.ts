// 작성지 사진 줄이기: 긴 변 2048px, JPEG 85%. 저장 공간·전송량을 줄이고 인스타 화질(최대 1080px)에는 충분하다.
// (임시 기준, 운영팀 확인 필요) 줄이지 못하는 형식이면 원본을 그대로 쓴다.
const MAX = 2048;

export async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file); // 사진의 방향 정보(EXIF)를 반영해 읽는다
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}
