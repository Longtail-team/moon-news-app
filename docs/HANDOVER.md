# 인수인계 (2026-10-09 기준)

새벽달 영어뉴스 낭독 챌린지 웹앱. 이 문서만 읽고 이어서 작업할 수 있게 정리했다.
제품 규칙은 `docs/spec.md`, 작업 지시는 `docs/tasks/`, 날짜별 경과는 `docs/devlog.md`.

## 1. 지금 상태 한 줄
개발 1단계 중(PR #1~#17 운영 반영, 10-09 점검 수정은 `fix/audit-1009` PR). **결제(시험 주문) → 보호자 링크 → 첫 접속 3단계 → 홈 → 기사 읽기(녹음) → 작성 활동(사진) → 인스타 올리기(링크 인증) → 이번 주 자료(주차별 순차 공개)**, 다시 들어가기, 콘텐츠 시트 → 앱 반영(검사 실행까지)이 동작한다.
아직 없는 것: 영상 만들기(2단계), 완주 화면, 관리자, 아임웹 결제 신호, 솔라피 실제 발송, 실제 음원·시간 정보(하이라이트), 주차 PDF.

## 2. 주소와 계정

| 무엇 | 위치 |
|---|---|
| 운영 주소 | https://news.momthereader.com (main 브랜치) |
| 기기 시험 페이지 | https://news.momthereader.com/lab |
| 브랜치 미리보기 | `https://moon-news-app-git-<브랜치>-id-9548s-projects.vercel.app` (`/`를 `-`로) |
| GitHub | https://github.com/Longtail-team/moon-news-app |
| Vercel | 팀 `id-9548s-projects`, 프로젝트 `moon-news-app`, Hobby(실사용 전 Pro로). 함수 지역 서울 `icn1`(`vercel.json`). 미리보기 보호 꺼짐 |
| Supabase | 조직 "moon news webapp"(Pro, 이 서비스 전용) / 프로젝트 `moon.news.app`, ref `mefmwetcfrmwdqcgxtpz`, 서울 |
| DNS | `momthereader.com`은 호스트코코아 관리. `news` CNAME → Vercel. 호스트코코아는 이름 칸에 전체 주소(`news.momthereader.com`)를 넣어야 저장됨 |
| 구글 클라우드 | 회사 계정 프로젝트 `moon-news-content`(번호 140098722985), 서비스 계정 `content-sync@moon-news-content.iam.gserviceaccount.com`(키 없음), Workload Identity 풀 `github` / 제공자 `github-actions`(이 저장소 main만) |
| 콘텐츠 드라이브 | `[진행중] 새벽달 영어 뉴스 프로젝트 / 새벽달 영어뉴스 웹앱 게시 자료` (상위, 서비스 계정 보기 공유) `/ 1기` (시트 + 1기 파일) |
| 1기 콘텐츠 시트 | https://docs.google.com/spreadsheets/d/1Pkt4uPnv59n-j65_yXteETNCVlx8wR6B0RTlaOAFAEw |
| 1기 자료 폴더 | https://drive.google.com/drive/folders/1HO0RPbLFyJdmiABeS9Oz2ZxBq7tNh3a5 |
| 파일명 규칙 문서(팀 공유) | https://docs.google.com/document/d/1pVcQmiBi8wd4brO77cZ6QhufsFIQ_hv4CS_srRGMyJQ |
| 로컬 폴더 | `C:\Users\marie\Desktop\클로드코드\새벽달 뉴스낭독웹앱` |

### 샘플 학습자로 들어가기 (운영 DB의 샘플 데이터)
| 학습자 | 링크 |
|---|---|
| 김지우 (정상) | https://news.momthereader.com/a/sample-token-S-0001 |
| 박서연 (게시 밀림, 올릴 것 8개) | https://news.momthereader.com/a/sample-token-S-0002 |
| 이도윤 자녀 링크 (학습 밀림) | https://news.momthereader.com/a/sample-token-S-0003-child |
| 윤시우·강다은 보호자 (형제) | https://news.momthereader.com/a/sample-token-S-0007 |
| 정민준 (환불 → 들어올 수 없음) | https://news.momthereader.com/a/sample-token-S-0005 |

샘플 토큰은 고정 문자열이다. 실제 링크는 무작위로 만든다.

### 결제 → 첫 접속 시험 (아임웹 연결 전)
```
node --env-file=.env.local scripts/test-order.mjs 01000009001 2 1 <주소>   # 샘플 번호, 형제 2명, 1기 → 보호자 링크 출력
node --env-file=.env.local scripts/delete-test-order.mjs 01000009001       # 시험 데이터 지우기 (0100000xxxx 번호만)
```
미리보기 주소에서는 **시험 번호(0100000xxxx)일 때만** 자녀 링크·다시 들어가기 링크가 화면에 보인다(`DEV_OUTBOX=1`, Preview 환경변수). 미리보기도 운영 DB를 쓰므로 실제 번호의 링크는 보이지 않게 막았다. 운영 주소에는 보이지 않는다.

## 3. 로컬에서 실행

```
npm install
npm run dev        # http://localhost:3000  (predev가 ffmpeg 워커를 public/ffmpeg로 복사)
npm test           # vitest: DB 규칙(PGlite) + 단위 테스트, 122개
npm run build
```

`.env.local` (git에 올리지 않음, 값은 담당자에게 받거나 대시보드에서 확인)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: 서버 전용. Vercel Production·Preview, GitHub Secrets에도 같은 이름으로 등록돼 있다
- `SUPABASE_DB_PASSWORD`: 마이그레이션 적용용. 모르면 Supabase 대시보드에서 재설정
- `ANTHROPIC_API_KEY`: 작성지 사진 글자 읽기(기자수첩). 없으면 버튼이 숨겨진다. `OCR_MODEL`(선택)로 모델을 바꾼다(기본 claude-haiku-5-5). 키는 Claude Console 서비스 계정 moon-news-app, 이름 moon-news-ocr

DB 변경
```
supabase link --project-ref mefmwetcfrmwdqcgxtpz -p <DB 비밀번호>
supabase db push -p <DB 비밀번호>            # supabase/migrations 적용
```
- 마이그레이션은 추가만 한다(이미 적용된 파일은 고치지 않는다). 지금까지 20개 모두 운영에 적용됨.

### Windows 주의
- 프로젝트 경로에 한글이 있으면 Node `fs.cpSync`가 오류 없이 종료된다 → `copyFileSync` 사용(`scripts/copy-ffmpeg-worker.mjs`)
- Git Bash에서 `vercel api /v9/...`를 쓸 때 `export MSYS_NO_PATHCONV=1` (경로가 윈도우 경로로 바뀌는 문제)
- `next dev`가 CLAUDE.md 끝에 Next.js 안내 블록을 자동으로 붙인다(지워도 다시 생김, 그대로 둠)

## 4. 구조

```
app/
  page.tsx               홈 (세션 없으면 안내, 첫 접속이면 3단계, 형제면 /profiles)
  a/[token]/route.ts     접속 링크 열기 → 세션 쿠키 → /?k=<토큰> (홈 화면 아이콘용)
  p/[sid]/route.ts       형제 프로필 고르기
  profiles/ add-learner/ reentry/   학습자 고르기·추가, 다시 들어가기(번호 → 새 링크)
  activity/              활동 고르기
  read/[week]/[kind]/    기사 읽기·VOCA 단어 (en | kr | voca)
  write/[week]/[kind]/   작성 활동 (voca | summary | debate)
  upload/                인스타 올리기
  materials/             이번 주 자료 (주차별 순차 공개)
  record/                내 기록 탭 (학습자별 기록·지난 기수·설정), record/book 뉴스북 보기, record/book/pdf PDF(종강 다음 날부터)
  files/[week]/[type]/   학습 자료 파일 → 확인 후 짧은 주소로 이동
  media/[activity]/      녹음·사진 → 주인 확인 후 1분 주소로 이동 (화면에 저장소 주소를 싣지 않음)
  live/[session]/        라이브 입장·다시보기 (입장 기록)
  */loading.tsx          불러오는 동안 뼈대 (components/student/PageLoading)
  api/activity/*  api/onboarding/*  api/reentry
  lab/                   T01 기기 검증 페이지
components/student|reading|work|upload|materials|onboarding/
lib/
  server/                서버 전용(db, session, home, reading, media, learner, guardian, onboarding, notify, materials, ocr)
                         learner.ts: API용 requireLearner, 화면용 pageLearner(세션·학습자 없으면 이동)
  client-api.ts          브라우저 → 서버 API, 파일 직접 업로드
  format.ts phone.ts korean.ts insta.ts image.ts   날짜·이름 표시, 번호 정리·가리기, 조사·학년, 인스타 링크 정리, 사진 줄이기
  lab/                   /lab 기기 검증 페이지 전용
  pdf/                   뉴스북 PDF (react-pdf), fonts/ Pretendard TTF + LICENSE
  content/parse.mjs      콘텐츠 시트 검사·변환, 파일명 규칙
  video/                 2단계 영상 모듈 연결 규칙 (지금은 자리만, MAX_RECORDING_SEC=300)
  reading/               지문·하이라이트 순서, 녹음기
scripts/sync-content.mjs 콘텐츠 반영 (GitHub Actions에서 실행)
.github/workflows/content-sync.yml
supabase/
  migrations/            20개
  seed.sql               샘플 데이터
  sample-cleanup.sql     개강 전 샘플 지우기
tests/db/ tests/unit/
docs/ spec.md · tasks/ · devlog.md · spike-results.md · content/ · reference/
```

### 보안·데이터 흐름
- 브라우저는 우리 서버(Next.js)하고만 통신한다. 서버가 service_role로 Supabase에 접근하고, 학습자 범위는 세션에서 정한다.
- 접속 링크·세션은 원문을 저장하지 않고 SHA-256 해시만 둔다. 세션 쿠키 `nd_s`(httpOnly, 180일), 학습자 선택 `nd_p`.
- 지금 기수 = 환불하지 않은 수강 중 시작한 기수의 가장 최근 것(없으면 가장 최근 기수). `app.current_enrollment`
- 파일: 비공개 버킷 `media`(녹음 `recordings/<수강id>/…`, 사진 `photos/<수강id>/…`), `course`(학습 자료). 학생 화면에는 앱 주소(`/files/...`, `/media/...`)만 싣고, 누를 때 수강·주차 공개를 확인한 뒤 짧은 유효시간 주소로 보낸다. 경로에 이름·연락처 없음.
- 아직 시작하지 않은 주차의 기사 제목·파일은 브라우저로 보내지 않는다.
- 구글 시트·드라이브는 브라우저도 Vercel도 읽지 않는다. GitHub Actions가 키 없는 연결로 1시간 토큰을 받아 "보기"로만 읽고 DB·Storage로 복사한다.
- RLS는 2중 안전장치. 지금 앱은 service_role로만 접근한다.

## 5. 콘텐츠 운영 (T05)
- 운영팀은 기수 시트에 기사·문장(끊어 읽기 " / ")·단어·추가 자료·라이브를 쓰고, 파일은 기수 폴더에 `news01_week01_<pdf|article|kren|voca|tem>.<확장자>`로 올린다. 규칙은 팀 공유 문서와 시트 "작성 안내" 탭.
- 학생에게는 주차 시작(월 0시) + 기사 상태 "공개"일 때만 보인다.
- 반영: GitHub → Actions → "콘텐츠 시트 반영" → Run workflow(기본 "검사만"). 매일 03시 자동 반영은 저장소 변수 `CONTENT_SYNC_ENABLED=true`로 켠다(지금 꺼짐).
- 공개 주차에 오류가 있으면 그 주차는 반영하지 않고 실패(GitHub 알림 메일). 바뀐 파일만 md5로 골라 새 version으로 올린다.
- 새 기수: 기수 폴더·시트 만들기 → `content_sources`에 (기수, 시트 ID, 폴더 ID) 추가하는 마이그레이션. 상위 폴더 공유를 물려받으므로 따로 공유할 필요 없음.
- 마지막 검사(2026-10-08): 정상. 1·2주차 반영 가능, 경고는 한국어 빈칸과 "초안" 상태. 폴더에 파일은 아직 없음.

## 6. 결정 기록 (spec.md 반영됨)
- 영상은 휴대폰 합성, 서버 합성 미도입. 개발은 1단계(영상 외 전부)·2단계(영상 모듈 V01)로 나누고 출시는 한 번. 녹음 최대 임시 5분
- 접속은 로그인 화면 없이 알림톡 링크만. 보호자 링크는 보호자(결제자)에, 자녀 링크는 자녀에. 다시 들어가기 = 번호 → 새 링크(인증번호 없음)
- 아임웹 주문 1건 = 한 가정, 학습자 최대 4명, 인원·금액 대조 안 함. 결제자 혼자 학습 가능("저 혼자 학습해요", 성인, 가정당 1명)
- 수강 상태 `paid`/`refunded`, 환불은 관리자 확인 후. 재수강생이 새 기수를 환불하면 링크 유지, 그 기수 페이지만 가림
- 지난 주차 소급 허용, 시작 전 주차 불가. 종강일은 완주 단계 판정에만. 누적 낭독 단어 수는 영어만
- 인스타 게시물 1개 = 학습 1회(같은 링크 중복 인증 금지)
- 이번 주 자료는 주차별 순차 공개. PDF는 주차당 1개로 묶고 내려받기만(자료 확정 후 작업)
- 호스팅은 Vercel 유지(실사용 전 Pro), 함수 지역 서울. 콘텐츠는 GitHub Actions + 키 없는 구글 연결
- 자료 폴더는 기수별, 파일명 규칙으로 자동 연결
- 활동 이름: 한국어 기사 읽기 / 영어 기사 읽기 / VOCA / 기사 요약 / 찬반토론

## 7. 임시로 적용한 것 (확정 필요)
- 링크 여러 번 사용, 마지막 기수 종강 후 3개월까지 유효, 새 링크 보내도 이전 링크 유지. 세션 180일(쿠키 연장은 아직 없음)
- 홈 화면 앱 설정 파일(manifest)은 아직 없다. 아이폰 홈 화면 아이콘이 링크(`/?k=`)로 열리는지 실기기 확인 필요
- 사진은 긴 변 2048px·JPEG 85%로 줄여 저장
- 하이라이트는 예상 시간(영어 단어당 0.4초, 한국어 글자당 0.11초). 음원·시간 정보 파일이 들어오면 교체
- 속도 기억은 기기(브라우저)별 localStorage
- 인스타 게시물이 실제로 있는지 확인하지 않음

## 8. 다음 작업 (제안 순서)
1. 콘텐츠: 1기 시트 한국어 해석 채우기 → 상태 "공개" → 파일 업로드 → 실제 반영 실행 → 자동 반영 켜기. 실제 음원 시간 정보(일레븐랩스 정렬)
2. 주차 PDF 1개 묶음과 받기 버튼(자료 확정 후 요청 예정)
3. 아임웹 결제 신호 → `record_order` + 보호자 링크 + 시작 안내 알림톡, 솔라피 실제 발송(`lib/server/notify.ts`, 카카오 템플릿 사전 승인, 버튼은 외부 브라우저로 열기)
4. 관리자 최소(학습자 목록, 반영 기록 `sync_runs`, 링크 발급)
5. 완주 화면·상장, 종강 이후 홈
6. 2단계 영상 모듈은 `docs/tasks/V01-영상-합성-모듈.md`로 별도 진행 후 `lib/video` 교체
7. 실사용 전: Vercel Pro, 샘플 데이터 정리, main 보호 설정

## 9. 주의
- **운영 DB에 샘플 데이터가 있다.** 실제 수강생 등록 전에 `supabase/sample-cleanup.sql` 실행(파일 안의 확인 쿼리 먼저). 시험하며 생긴 기록도 함께 지워진다.
- 시험으로 녹음·사진을 올리면 `media` 버킷에 파일이 남는다. 샘플 정리 때 버킷의 `recordings/`, `photos/`도 비운다.
- 미리보기에서 만든 시험 주문(01000009061)이 남아 있다. 확인이 끝나면 `delete-test-order.mjs`로 지운다.
- 콘텐츠 드라이브는 공유 드라이브라 Claude 연결 계정으로는 파일 이동이 안 된다(만들기·이름 바꾸기는 됨).
- 브랜치 규칙: main = 운영 배포, 작업은 `feat/…`·`fix/…` 브랜치 → PR → 합치기. main 보호 설정은 아직 안 함.
- 비밀 값(서비스 키, DB 비밀번호)은 저장소·문서·채팅에 넣지 않는다.
