# 구글 클라우드 설정: 콘텐츠 시트 반영 (키 파일 없는 연결)

목적: GitHub Actions가 매일 콘텐츠 시트와 자료 폴더를 **읽기만** 해서 앱 DB·Storage에 반영한다.  
방식: GitHub가 실행마다 발급하는 신원 토큰을 구글이 확인하고 1시간짜리 토큰을 준다(Workload Identity Federation). **서비스 계정 키(JSON)는 만들지 않는다.**  
계정: 회사 구글 계정. 콘솔: https://console.cloud.google.com

> 아래 이름(프로젝트 `moon-news-content`, 서비스 계정 `content-sync`, 풀 `github`, 공급자 `github-actions`)은 예시다. 바꾸면 끝에서 알려 주면 된다.

## 1. 프로젝트 만들기
1. 콘솔 맨 위 프로젝트 선택 → **새 프로젝트**
2. 이름 `moon-news-content`, 조직은 회사 조직 그대로 → 만들기
3. 대시보드에서 **프로젝트 ID**와 **프로젝트 번호**(숫자)를 적어 둔다

## 2. API 켜기
"API 및 서비스 → 라이브러리"에서 아래 4개를 검색해 각각 **사용**을 누른다.
- Google Sheets API
- Google Drive API
- IAM Service Account Credentials API
- Security Token Service API

## 3. 서비스 계정 만들기 (키 없음)
1. "IAM 및 관리자 → 서비스 계정 → 서비스 계정 만들기"
2. 이름 `content-sync` → 만들고 계속하기
3. "역할"은 **아무것도 주지 않는다** → 계속 → 완료
4. **키 만들기를 하지 않는다**
5. 서비스 계정 이메일(`content-sync@<프로젝트ID>.iam.gserviceaccount.com`)을 적어 둔다

## 4. Workload Identity 풀과 공급자
1. "IAM 및 관리자 → Workload Identity 제휴 → 풀 만들기"
2. 풀: 이름 `github`, ID `github` → 계속
3. 공급자 추가:
   - 공급자 선택: **OpenID Connect(OIDC)**
   - 공급자 이름·ID: `github-actions`
   - 발급기관(URL): `https://token.actions.githubusercontent.com`
   - 대상: **기본 대상** 그대로
4. 공급자 속성 매핑:
   | Google | OIDC |
   |---|---|
   | `google.subject` | `assertion.sub` |
   | `attribute.repository` | `assertion.repository` |
   | `attribute.ref` | `assertion.ref` |
5. **속성 조건**(꼭 넣는다. 이 저장소의 main 브랜치만 통과):
   ```
   assertion.repository == 'Longtail-team/moon-news-app' && assertion.ref == 'refs/heads/main'
   ```
6. 저장

## 5. 풀이 서비스 계정을 쓸 수 있게 허용
1. 만든 풀(`github`) 화면 → **액세스 권한 부여**
2. "서비스 계정 가장(impersonation)으로 액세스 권한 부여" 선택
3. 서비스 계정: `content-sync`
4. 주 구성원 선택: 속성 이름 `repository`, 속성 값 `Longtail-team/moon-news-app`
5. 저장 (역할 "Workload Identity 사용자"가 붙는다)

## 6. 시트와 자료 폴더 공유 (보기만)
1. 콘텐츠 시트 → 공유 → 서비스 계정 이메일 추가 → **뷰어** → 알림 보내지 않기
2. 자료(PDF·음원·템플릿) 드라이브 폴더 → 같은 방법으로 **뷰어**
- 회사 워크스페이스가 "외부 공유 제한"이면 서비스 계정 이메일이 막힐 수 있다. 그때는 워크스페이스 관리자에게 이 이메일만 허용을 요청한다.

## 7. 알려 줄 값 (비밀 아님)
아래 값만 알려 주면 GitHub Actions 설정은 개발 쪽에서 한다. 비밀 키가 아니라 이름·번호라 채팅으로 보내도 된다.
- 프로젝트 ID
- 프로젝트 번호
- 서비스 계정 이메일
- 풀 ID(`github`), 공급자 ID(`github-actions`) — 바꿨다면
- 콘텐츠 시트 주소(이미 받음), 자료 폴더 주소

## 보안 정리
- 키 파일이 없어 유출될 비밀이 없다. 토큰은 GitHub Actions 실행 중에만 1시간 유효하다.
- 이 저장소의 main 브랜치에서 돈 작업만 통과한다(다른 저장소·브랜치·포크는 거절).
- 서비스 계정은 프로젝트 역할이 없고, 공유받은 시트·폴더를 **보기**만 할 수 있다.
- Supabase 쓰기 키는 GitHub Actions 비밀값(Secrets)에 둔다(Vercel과 같은 서버 전용 키).
