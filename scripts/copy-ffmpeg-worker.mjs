// ffmpeg.wasm 워커를 번들러를 거치지 않고 public/ffmpeg/ 에서 그대로 내보내기 위해 복사한다.
// (Turbopack이 워커 안의 import(coreURL)를 바꿔 버려 코어를 불러오지 못하는 문제 회피)
// cpSync는 Windows의 한글 경로에서 Node가 오류 없이 종료되어 copyFileSync를 쓴다.
import { copyFileSync, mkdirSync } from "node:fs";

const src = "node_modules/@ffmpeg/ffmpeg/dist/esm";
const dest = "public/ffmpeg";
mkdirSync(dest, { recursive: true });
for (const f of ["worker.js", "const.js", "errors.js"]) copyFileSync(`${src}/${f}`, `${dest}/${f}`);
