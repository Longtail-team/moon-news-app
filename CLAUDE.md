# 새벽달 영어뉴스 낭독 챌린지 웹앱

초등 고학년~중학생이 12주 동안 매주 영어 기사 1편을 낭독·VOCA·요약·찬반토론으로 학습하고,
학습 1회마다 인스타그램에 올려 인증하는 유료 챌린지 웹앱. 보호자와 자녀가 함께 쓴다.

## 먼저 읽을 것
- `docs/spec.md` : 기준 문서(제품 규칙, 화면, 데이터 명세, 미확정 목록). 충돌하면 이 문서가 우선한다.
- `docs/tasks/` : 작업 지시. 지금 할 일은 지시받은 Tnn 파일 하나뿐이다.
- `docs/reference/mockup-student.html` : 수강생 화면 클릭형 목업. 화면 구성·문구·색은 여기를 따른다.
- `docs/reference/feature-spec.xlsx` : 기능 정의서(운영팀 공유용).
- `docs/content/` : 지문 데이터(끊어 읽기, 해석).

## 기술 스택
- Next.js (App Router) + TypeScript(strict), Vercel 배포, 브랜치마다 미리보기 주소.
- Supabase: PostgreSQL, Storage(비공개 버킷), Edge Functions, pg_cron.
- 외부: 솔라피(알림톡·문자), 아임웹(신청 정보), 구글 시트·드라이브(학습 자료 입력), 일레븐랩스(음원 강제 정렬).
- 스택 변경이 필요하다고 판단되면 바꾸지 말고 이유를 적어 제안한다.

## 반드시 지킬 제품 규칙 (자세한 내용은 spec.md)
- 진도는 요일이 아니라 횟수다. 주 5회, 12주 60회. 활동·순서 자유, 반복 허용, 하루 상한 없음, 지난 주차 소급 가능.
- "학습 완료"와 "인스타 인증"은 별도 상태다. 홈의 주간 숫자는 학습 완료, 완주 진행률은 인증 기준.
- 완주 = 인스타 인증 60회. 제때(종강일까지) / 유예(종강 후 1주) / 늦은(기한 없음) 3단계.
- 영상은 서버에 저장하지 않는다. 휴대폰에서 녹음 + 기사 이미지로 만든다(T01에서 가능 여부 검증 중).
- 녹음·사진은 종강 후 3개월 보관 후 삭제. 첫·마지막 낭독은 인스타 게시물 링크로 기억한다.
- 하이라이트: 영어는 끊어 읽기 구("/") 단위, 한국어는 문장 단위. 속도 0.5 / 0.8 / 1 / 1.2배.

## 화면 문구 용어 (통일)
- 학습 완료 / 인스타 올리기 / 종강일 / 이번 주 자료 / 12주 기록 / 완주
- 쓰지 않는 말: 게시 대기, 마감, 결제 연락처(→ 신청 연락처), 인증 완료(버튼은 "완료")
- 과정명 예: "새벽달 영어뉴스 1기", 기간은 "12주"로만 표시.

## 화면 톤
- 배경 #F6F8F8, 카드 흰색, 테두리 #E3E9E8, 비활성 #EEF2F2
- 메인 #76D4CC, 연한 톤 #E2F6F3, 진한 톤 #1F7F77(작은 글자용), 글자 #2D2D2D / #5A5A5A
- 서체 Pretendard. 한 화면에 여러 색을 쓰지 않는다. 다크 배경 금지.
- 모바일 우선(폭 390 기준). 터치 영역 최소 44px. 글자 최소 13px.

## 개인정보·보안
- 사용자 대부분이 만 14세 미만이다. 아이 음성·사진·연락처를 화면, URL, 로그에 불필요하게 노출하지 않는다.
- 접속 링크 토큰은 원문 저장 금지(해시만). 비밀 키는 클라이언트 코드에 넣지 않는다.
- 저장소에 실제 수강생 데이터를 커밋하지 않는다. 샘플 데이터만 쓴다.

## 작업 방식
- 브랜치: `main`(보호, 운영 배포) + 작업별 짧은 브랜치 `spike/…`, `feat/…`, `fix/…`. PR로 합친다.
- 커밋 메시지는 한국어로 무엇을 왜 바꿨는지 한 줄.
- 문서에 없는 결정이 필요하면 짐작해서 구현하지 말고, 작업 결과 보고의 "질문" 목록에 남긴다.
- 제품 규칙을 바꿔야 할 것 같으면 "기존안 / 변경안 / 이유 / 영향 범위"로 제안한다.
- 결정이 확정되면 `docs/spec.md`를 함께 고친다.
- 작업이 끝나면 tasks 파일의 "완료 보고" 형식대로 보고한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
