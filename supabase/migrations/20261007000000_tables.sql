-- T02 데이터 계층 1/2: 테이블 (spec.md 16장)
-- 코드 값은 영문으로 저장하고, 화면 문구는 앱에서 붙인다.
-- 횟수(주간 학습, 인증 수, 게시 대기 등)는 저장하지 않고 2/2의 함수로 계산한다.

-- ───────── 학습 자료 (자료 시트에서 동기화) ─────────

create table articles (
  article_id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_ko text,
  level text,                       -- 렉사일 등. 추정치는 화면에서 "난이도"로 표기
  word_count int check (word_count > 0),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'published')), -- 초안/검수완료/공개
  created_at timestamptz not null default now()
);

create table sentences (
  article_id uuid not null references articles on delete cascade,
  para_no int not null check (para_no > 0),
  sent_no int not null check (sent_no > 0),
  en text not null,                 -- 끊어 읽기 " / " 포함. 정렬할 때는 뺀다
  ko text not null,
  primary key (article_id, sent_no)
);

create table vocab (
  article_id uuid not null references articles on delete cascade,
  no int not null check (no > 0),
  word text not null,
  meaning text not null,
  example text,
  primary key (article_id, no)
);

create table assets (
  asset_id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles on delete cascade,
  type text not null check (type in (
    'article_audio',       -- 영어 기사 AI 음원
    'kr_en_repeat_audio',  -- 새벽달 한영 구간반복
    'voca_repeat_audio',   -- VOCA 구간반복
    'article_pdf',         -- 기사 PDF (원문·요약 작성지·토론 질문지)
    'voca_pdf',            -- VOCA 정리 PDF
    'insta_template'       -- 인스타 템플릿 이미지 (영상 화면)
  )),
  file_name text not null,
  storage_key text not null,
  version int not null default 1 check (version > 0),
  timing_key text,                  -- 음원 시간 정보 파일 (일레븐랩스 강제 정렬)
  align_score numeric,
  created_at timestamptz not null default now(),
  unique (article_id, type, version)
);

-- ───────── 기수 ─────────

create table cohorts (
  cohort_id uuid primary key default gen_random_uuid(),
  course_title text not null,       -- 예: 새벽달 영어뉴스
  cohort_no int not null check (cohort_no >= 0),
  start_date date not null,
  deadline date not null check (extract(isodow from deadline) = 7), -- 종강일 = 12주차 일요일
  grace_until date generated always as (deadline + 7) stored,       -- 유예 = 종강 후 1주
  weekly_target int not null default 5 check (weekly_target > 0),
  total_target int not null default 60 check (total_target > 0),
  reward_pdf_key text,
  created_at timestamptz not null default now(),
  unique (course_title, cohort_no),
  check (start_date < deadline)
);

create table cohort_weeks (
  cohort_id uuid not null references cohorts on delete cascade,
  week_no int not null check (week_no > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  article_id uuid references articles,
  primary key (cohort_id, week_no),
  check (starts_at < ends_at)
);

create table live_sessions (
  session_id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts on delete cascade,
  session_no int not null check (session_no > 0),
  starts_at timestamptz not null,
  zoom_url text,
  replay_url text,
  unique (cohort_id, session_no)
);

-- ───────── 회원 ─────────

create table guardians (
  guardian_id uuid primary key default gen_random_uuid(),
  name text,
  phone text not null unique check (phone ~ '^01[0-9]{8,9}$'), -- 결제자(신청) 연락처, 숫자만. 보호자 1명 = 번호 1개
  alimtalk_agreed_at timestamptz,
  reenroll_marketing_agreed_at timestamptz,
  created_at timestamptz not null default now()
);

create sequence student_no_seq;

create table students (
  -- 변하지 않는 내부 식별자. 관리자 화면 표기(S-0012)와 같다.
  student_id text primary key default ('S-' || lpad(nextval('student_no_seq')::text, 4, '0')),
  guardian_id uuid not null references guardians on delete restrict,
  name text not null,               -- 완주 상장에 들어가는 이름(한국어)
  birth_ym date check (extract(day from birth_ym) = 1), -- 출생 연월. 매월 1일로 저장
  own_phone text check (own_phone ~ '^01[0-9]{8,9}$'), -- 자녀 본인 휴대폰으로 진행할 때만, 숫자만
  instagram_id text,
  consent_at timestamptz,           -- 음성·이미지 수집 보호자 동의
  admin_memo text,
  created_at timestamptz not null default now()
);
create index students_guardian_idx on students (guardian_id);

create table access_tokens (
  token_id uuid primary key default gen_random_uuid(),
  student_id text not null references students on delete cascade,
  holder text not null check (holder in ('guardian', 'child')),
  sent_to_phone text not null,
  token_hash text not null unique,  -- 원문은 저장하지 않는다
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index access_tokens_student_idx on access_tokens (student_id);

-- ───────── 수강·기록 ─────────

create table enrollments (
  enrollment_id uuid primary key default gen_random_uuid(),
  student_id text not null references students on delete restrict,
  cohort_id uuid not null references cohorts on delete restrict,
  grade_at_enrollment text,         -- 수강 당시 학년 (예: 초5)
  imweb_order_no text,
  paid_at timestamptz,
  paid_amount int,
  coupon_code text,
  source text,                      -- 유입 경로
  -- 수강 상태: paid = 이 기수를 결제함(수강 중), refunded = 환불·과정 취소 완료
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  -- 환불 처리 단계(관리자 확인 후 수동): requested = 요청 접수·확인 대기, approved = 환불 완료, rejected = 환불 불가
  refund_status text check (refund_status in ('requested', 'approved', 'rejected')),
  refunded_at timestamptz,          -- 환불 완료 시각 (approved일 때만)
  refund_amount int,
  refund_reason text,
  completed_at timestamptz,         -- 상장 발급 시점의 기록. 판정은 enrollment_progress()로 계산
  completion_tier text check (completion_tier in ('on_time', 'grace', 'late')),
  certificate_name text,
  certificate_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, cohort_id),
  check ((status = 'refunded') = (refund_status is not distinct from 'approved')),
  check ((refund_status is not distinct from 'approved') = (refunded_at is not null))
);
create index enrollments_cohort_idx on enrollments (cohort_id);

create table activities (
  activity_id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments on delete restrict,
  week_no int not null check (week_no > 0), -- 지난 주차 소급 가능
  activity_type text not null check (activity_type in ('KR_READING', 'EN_READING', 'VOCA', 'SUMMARY', 'DEBATE')),
  state text not null default 'STARTED' check (state in ('NOT_STARTED', 'STARTED', 'RECORDED', 'CONTENT_READY', 'COMPLETED', 'VERIFIED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,         -- 학습 완료
  post_url text,                    -- 인스타 게시물 링크
  verified_at timestamptz,          -- 인스타 인증
  media_key text,                   -- 녹음 또는 작성지 사진 (Storage 키)
  media_deleted_at timestamptz,
  -- 학습 완료와 인증은 별도 상태지만, 인증은 학습 완료 뒤에만 있다
  check ((state in ('COMPLETED', 'VERIFIED')) = (completed_at is not null)),
  check ((state = 'VERIFIED') = (verified_at is not null)),
  check (verified_at is null or (completed_at is not null and post_url is not null and verified_at >= completed_at))
);
create index activities_enrollment_week_idx on activities (enrollment_id, week_no);
create index activities_verified_idx on activities (enrollment_id) where verified_at is not null;
create index activities_pending_idx on activities (enrollment_id) where completed_at is not null and verified_at is null;

create table notifications (
  notification_id uuid primary key default gen_random_uuid(),
  student_id text not null references students on delete restrict,
  enrollment_id uuid references enrollments on delete restrict,
  template text not null check (template in (
    'start_guide',     -- 시작 안내
    'nudge',           -- 진도 독려
    'live_day',        -- 라이브 당일
    'closing_notice',  -- 종강 예고
    'child_link',      -- 자녀 접속 링크
    'new_link',        -- 새 접속 링크
    'certificate'      -- 완주 상장
  )),
  checkpoint text,                  -- 진도 독려 회차: nudge_1 / nudge_2 / nudge_3 / manual_YYYY-MM-DD
  recipient text not null check (recipient in ('guardian', 'child')),
  sent_to_phone text not null,
  sent_at timestamptz not null default now(),
  result text,
  check (template <> 'nudge' or (enrollment_id is not null and checkpoint is not null))
);
create index notifications_student_idx on notifications (student_id);
-- 같은 회차 독려는 받는 사람마다 한 번만 (보호자·자녀 두 번호로 보내도 회차는 1회)
create unique index notifications_nudge_once_idx on notifications (enrollment_id, checkpoint, recipient) where template = 'nudge';

create table live_clicks (
  click_id bigint generated always as identity primary key,
  student_id text not null references students on delete restrict,
  session_id uuid not null references live_sessions on delete cascade,
  clicked_at timestamptz not null default now()
);
create index live_clicks_session_idx on live_clicks (session_id);
