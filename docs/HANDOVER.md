# 인수인계 (2026-10-07 기준)

새벽달 영어뉴스 낭독 챌린지 웹앱. 이 문서만 읽고 이어서 작업할 수 있게 정리했다.
제품 규칙은 `docs/spec.md`, 작업 지시는 `docs/tasks/`, 날짜별 경과는 `docs/devlog.md`.

## 1. 지금 상태 한 줄
개발 1단계 중. **접속 링크 → 홈 → 낭독(녹음) → 작성 활동(사진) → 인스타 올리기(링크 인증)**까지 운영 주소에서 동작한다. 영상 만들기(2단계), 첫 접속 등록, 이번 주 자료, 완주, 관리자, 알림톡은 아직 없다.

## 2. 주소와 계정

| 무엇 | 위치 |
|---|---|
| 운영 주소 | https://news.momthereader.com (main 브랜치) |
| 기기 시험 페이지 | https://news.momthereader.com/lab |
| 브랜치 미리보기 | `https://moon-news-app-git-<브랜치>-id-9548s-projects.vercel.app` (`/`를 `-`로) |
| GitHub | https://github.com/Longtail-team/moon-news-app |
| Vercel | 팀 `id-9548s-projects`, 프로젝트 `moon-news-app` (미리보기 보호 꺼짐) |
| Supabase | 조직 "moon news webapp"(Pro, 이 서비스 전용) / 프로젝트 `moon.news.app`, ref `mefmwetcfrmwdqcgxtpz`, 서울 |
| DNS | `momthereader.com`은 호스트코코아 관리. `news` CNAME → Vercel. 호스트코코아는 이름 칸에 전체 주소(`news.momthereader.com`)를 넣어야 저장됨 |
| 로컬 폴더 | `C:\Users\marie\Desktop\클로드코드\새벽달 뉴스낭독웹앱` |

### 샘플 학습자로 들어가기 (운영 DB의 샘플 데이터)
| 학습자 | 링크 |
|---|---|
| 김지우 (정상) | https://news.momthereader.com/a/sample-token-S-0001 |
| 박서연 (게시 밀림, 올릴 것 8개) | https://news.momthereader.com/a/sample-token-S-0002 |
| 이도윤 자녀 링크 (학습 밀림) | https://news.momthereader.com/a/sample-token-S-0003-child |
| 윤시우·강다은 보호자 (형제) | https://news.momthereader.com/a/sample-token-S-0007 |
| 정민준 (환불 → 들어올 수 없음) | https://news.momthereader.com/a/sample-token-S-0005 |

샘플 토큰은 고정 문자열이다. 실제 링크는 무작위로 만든다(아직 발급 기능 없음).

## 3. 로컬에서 실행

```
npm install
npm run dev        # http://localhost:3000  (predev가 ffmpeg 워커를 public/ffmpeg로 복사)
npm test           # vitest: DB 규칙(PGlite) + 단위 테스트, 71개
npm run build
```

`.env.local` (git에 올리지 않음, 값은 담당자에게 받거나 대시보드에서 확인)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용. Vercel Production·Preview에도 같은 이름으로 등록돼 있다
- `SUPABASE_DB_PASSWORD` — 마이그레이션 적용용. 모르면 Supabase 대시보드에서 재설정

DB 변경
```
supabase link --project-ref mefmwetcfrmwdqcgxtpz -p <DB 비밀번호>
supabase db push -p <DB 비밀번호>            # supabase/migrations 적용
```
- 마이그레이션은 추가만 한다(이미 적용된 파일은 고치지 않는다). 지금까지 6개 모두 운영에 적용됨.

### Windows 주의
- 프로젝트 경로에 한글이 있으면 Node `fs.cpSync`가 오류 없이 종료된다 → `copyFileSync` 사용(`scripts/copy-ffmpeg-worker.mjs`)
- Git Bash에서 `vercel api /v9/...`를 쓸 때 `export MSYS_NO_PATHCONV=1` (경로가 윈도우 경로로 바뀌는 문제)
- `next dev`가 CLAUDE.md 끝에 Next.js 안내 블록을 자동으로 붙인다(지워도 다시 생김, 그대로 둠)

## 4. 구조

```
app/
  page.tsx               홈 (세션 없으면 안내, 형제면 /profiles)
  a/[token]/route.ts     접속 링크 열기 → 세션 쿠키
  p/[sid]/route.ts       형제 프로필 고르기
  activity/              활동 선택
  read/[week]/[kind]/    낭독 (en | kr | voca)
  write/[week]/[kind]/   작성 활동 (voca | summary | debate)
  upload/                인스타 올리기
  materials/             이번 주 자료 (자리만)
  api/activity/*         start · upload-url · attach · complete · verify
  lab/                   T01 기기 검증 페이지
components/student|reading|work|upload/
lib/
  server/                서버 전용(db, session, home, reading, media, learner)
  video/                 2단계 영상 모듈 연결 규칙 (지금은 자리만, MAX_RECORDING_SEC=300)
  reading/               지문·하이라이트 순서, 녹음기
  insta.ts image.ts format.ts client-api.ts
supabase/
  migrations/            6개 (테이블, 집계·규칙·RLS, 환불 기수 가리기, 세션·홈, 낭독, 작성·인스타)
  seed.sql               샘플 데이터
  sample-cleanup.sql     개강 전 샘플 지우기
tests/db/ tests/unit/
docs/ spec.md · tasks/ · devlog.md · spike-results.md · content/ · reference/
```

### 보안·데이터 흐름
- 브라우저는 우리 서버(Next.js)하고만 통신한다. 서버가 service_role로 Supabase에 접근하고, 학습자 범위는 세션에서 정한다.
- 접속 링크·세션은 원문을 저장하지 않고 SHA-256 해시만 둔다. 세션 쿠키 `nd_s`(httpOnly, 180일), 형제 프로필 `nd_p`.
- 파일: 비공개 버킷 `media`(녹음 `recordings/<수강id>/…`, 사진 `photos/<수강id>/…`), `course`(학습 자료). 브라우저는 서버가 준 짧은 유효시간 주소로 직접 올리고 받는다. 경로에 이름·연락처 없음.
- RLS는 2중 안전장치(학습자 JWT의 `student_ids`·`guardian_id` 기준). 지금 앱은 service_role로만 접근한다.

## 5. 결정 기록 (spec.md 반영됨)
- 영상은 휴대폰 합성, 서버 합성(R2) 미도입. 개발은 1단계(영상 외 전부)·2단계(영상 모듈 V01)로 나누고 출시는 한 번
- 녹음 최대 길이 임시 5분(V01에서 휴대폰 합성 가능 길이로 확정). 녹음 후 자르지 않고 자동 정지
- 카메라 영상 녹화는 첫 출시 제외. 영상 이미지는 주차별 인스타 템플릿
- 수강 상태 `paid`/`refunded`, 환불 처리 `requested`→`approved`/`rejected`(관리자 수동), 링크 폐기는 `approved`일 때만
- 재수강생이 새 기수를 환불하면 링크 유지, 그 기수 페이지만 가림
- 지난 주차 소급 허용(종강 후 포함), 시작 전 주차 불가. 종강일은 완주 단계 판정에만
- 누적 낭독 단어 수는 영어 낭독만. 보호자 = 결제자 번호(숫자만, 고유)
- 인스타 게시물 1개 = 학습 1회(같은 링크 중복 인증 금지)

## 6. 임시로 적용한 것 (확정 필요)
- T03: 링크 여러 번 사용, 세션 180일(쿠키 연장은 아직 없음), 새 링크 보내도 이전 링크 유지
- 사진은 긴 변 2048px·JPEG 85%로 줄여 저장
- 하이라이트는 예상 시간(영어 단어당 0.4초, 한국어 글자당 0.11초). 음원·시간 정보 파일이 들어오면 교체
- 속도 기억은 기기(브라우저)별 localStorage
- 인스타 게시물이 실제로 있는지 확인하지 않음

## 7. 다음 작업 (제안 순서)
1. **첫 접속 3단계(T04)** — 먼저 정할 것: 결제 직후 학습자 등록 전의 링크·수강 구조(T03 결정 5, `docs/tasks/T03-접속-링크와-세션.md`), 형제 한 번에 결제 시 아임웹 주문이 1건인지 2건인지
2. 이번 주 자료 탭(PDF·음원·라이브)
3. 자료 반영(자료 시트·드라이브 → DB·Storage)과 실제 음원·시간 정보(일레븐랩스 정렬)
4. 관리자 최소(목록, 자료 올리기), 접속 링크 발급, 시작 안내 알림톡(솔라피, 카카오 템플릿 사전 승인 필요)
5. 완주 화면·상장, 마감 이후 홈, 다시 들어가기(인증번호)
6. 2단계 영상 모듈은 `docs/tasks/V01-영상-합성-모듈.md`로 별도 진행 후 `lib/video` 교체

## 8. 주의
- **운영 DB에 샘플 데이터가 있다.** 실제 수강생 등록 전에 `supabase/sample-cleanup.sql` 실행(파일 안의 확인 쿼리 먼저). 시험하며 생긴 기록도 함께 지워진다.
- 시험으로 녹음·사진을 올리면 `media` 버킷에 파일이 남는다. 샘플 정리 때 버킷의 `recordings/`, `photos/`도 비운다.
- 브랜치 규칙: main = 운영 배포, 작업은 `feat/…`·`fix/…` 브랜치 → PR → 합치기. main 보호 설정은 아직 안 함.
- 비밀 값(서비스 키, DB 비밀번호)은 저장소·문서·채팅에 넣지 않는다.
