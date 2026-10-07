-- T02 데이터 계층 2/2: 집계 함수, 규칙(트리거), 권한(RLS)
-- 집계는 모두 p_at(기준 시각)을 받는다. 운영에서는 now(), 테스트에서는 고정 시각을 넣는다.
-- 함수는 app 스키마에 두어 Supabase API(public)로 바로 노출하지 않는다. 서버(service_role)가 부른다.

create schema app;

-- 한국 날짜 d가 끝나는 시각(다음 날 0시, KST)
create function app.kst_day_end(d date) returns timestamptz
language sql stable as $$
  select ((d + 1)::timestamp at time zone 'Asia/Seoul')
$$;

-- ───────── 학습자별 진도 (수강 1건 = 1행) ─────────
-- 주간 학습 = 이번 주차 학습 완료 건수, 완주 진행률 = 인증 건수 ÷ total_target,
-- 게시 대기(화면 문구: 올릴 것) = 학습 완료했지만 인증 안 한 건수, 밀린 양 = 지난 주차 수 × 주간 목표 − 누적 학습 완료(소급분 포함)
create function app.enrollment_progress(p_at timestamptz default now())
returns table (
  enrollment_id uuid,
  student_id text,
  cohort_id uuid,
  current_week int,            -- 기준 시각이 속한 주차. 기수 시작 전·종강 후면 null
  weeks_passed int,            -- 끝난 주차 수
  this_week_completed int,
  total_completed int,
  verified_count int,
  pending_post_count int,
  expected_by_now int,
  behind_count int,
  reading_words int,           -- 누적 낭독 단어 수 (영어 낭독 학습 완료 × 그 주차 기사 단어 수)
  completion_at timestamptz,   -- total_target번째 인증 시각
  completion_tier text,        -- on_time / grace / late
  refunded boolean,
  last_activity_at timestamptz
)
language sql stable as $$
  with e as (
    select en.enrollment_id, en.student_id, en.cohort_id,
      c.weekly_target, c.total_target, c.deadline, c.grace_until,
      (en.refunded_at is not null and en.refunded_at <= p_at) as refunded,
      (select w.week_no from cohort_weeks w
        where w.cohort_id = en.cohort_id and p_at >= w.starts_at and p_at < w.ends_at) as current_week,
      (select count(*) from cohort_weeks w
        where w.cohort_id = en.cohort_id and w.ends_at <= p_at)::int as weeks_passed
    from enrollments en
    join cohorts c on c.cohort_id = en.cohort_id
  ),
  a as (
    -- 기준 시각에서 본 활동: 그 뒤의 완료·인증은 아직 없는 것으로 본다
    select act.enrollment_id, act.week_no, act.activity_type,
      case when act.completed_at <= p_at then act.completed_at end as completed_at,
      case when act.verified_at <= p_at then act.verified_at end as verified_at,
      greatest(act.started_at,
        case when act.completed_at <= p_at then act.completed_at end,
        case when act.verified_at <= p_at then act.verified_at end) as last_at
    from activities act
    where act.started_at <= p_at
  )
  select e.enrollment_id, e.student_id, e.cohort_id, e.current_week, e.weeks_passed,
    (count(*) filter (where a.completed_at is not null and a.week_no = e.current_week))::int,
    count(a.completed_at)::int,
    count(a.verified_at)::int,
    (count(*) filter (where a.completed_at is not null and a.verified_at is null))::int,
    e.weeks_passed * e.weekly_target,
    greatest(e.weeks_passed * e.weekly_target - count(a.completed_at), 0)::int,
    coalesce(sum(ar.word_count) filter (where a.activity_type = 'EN_READING' and a.completed_at is not null), 0)::int,
    fin.verified_at,
    case
      when fin.verified_at is null then null
      when fin.verified_at < app.kst_day_end(e.deadline) then 'on_time'
      when fin.verified_at < app.kst_day_end(e.grace_until) then 'grace'
      else 'late'
    end,
    e.refunded,
    max(a.last_at)
  from e
  left join a on a.enrollment_id = e.enrollment_id
  left join cohort_weeks cw on cw.cohort_id = e.cohort_id and cw.week_no = a.week_no
  left join articles ar on ar.article_id = cw.article_id
  left join lateral (
    select x.verified_at from activities x
    where x.enrollment_id = e.enrollment_id and x.verified_at <= p_at
    order by x.verified_at
    offset e.total_target - 1 limit 1
  ) fin on true
  group by e.enrollment_id, e.student_id, e.cohort_id, e.current_week, e.weeks_passed, e.weekly_target,
    e.deadline, e.grace_until, e.refunded, fin.verified_at
$$;

-- ───────── 관리자 목록 (spec.md 14장) ─────────
create function app.admin_enrollment_list(p_at timestamptz default now())
returns table (
  enrollment_id uuid,
  cohort_id uuid,
  student_id text,
  student_name text,
  guardian_phone text,
  own_phone text,
  instagram_id text,
  current_week int,
  this_week_completed int,
  total_completed int,
  verified_count int,
  pending_post_count int,
  behind_count int,
  study_behind boolean,        -- 학습 밀림: 지난 주차 분량을 다 채우지 못함 (환불 제외)
  post_behind boolean,         -- 게시 밀림: 게시 대기 3개 이상 (환불 제외)
  reading_not_started boolean, -- 낭독 미진행: 학습 완료한 낭독(한국어·영어)이 없음
  not_started boolean,         -- 미시작: 시작한 활동이 없음
  nudges_received int,         -- 받은 진도 독려 회차 수 (수동 포함, 최대 3)
  completion_tier text,
  refunded boolean,
  last_activity_at timestamptz
)
language sql stable as $$
  select p.enrollment_id, p.cohort_id, p.student_id, s.name, g.phone, s.own_phone, s.instagram_id,
    p.current_week, p.this_week_completed, p.total_completed, p.verified_count, p.pending_post_count, p.behind_count,
    p.behind_count > 0 and not p.refunded,
    p.pending_post_count >= 3 and not p.refunded,
    not exists (
      select 1 from activities x
      where x.enrollment_id = p.enrollment_id and x.activity_type in ('KR_READING', 'EN_READING') and x.completed_at <= p_at),
    p.last_activity_at is null,
    (select count(distinct n.checkpoint) from notifications n
      where n.enrollment_id = p.enrollment_id and n.template = 'nudge' and n.sent_at <= p_at)::int,
    p.completion_tier, p.refunded, p.last_activity_at
  from app.enrollment_progress(p_at) p
  join students s on s.student_id = p.student_id
  join guardians g on g.guardian_id = s.guardian_id
$$;

-- ───────── 진도 독려 대상 (spec.md 12장) ─────────
-- 1차 2주차 월요일(1주 분량 이상 밀림), 2차 4주차 월요일(2주 분량), 3차 7주차 월요일(3주 분량).
-- 회차마다 독립 판정. 환불 제외, 같은 회차 이미 받은 사람 제외, 독려 3회(수동 포함) 받은 사람 제외.
create function app.nudge_targets(p_cohort uuid, p_checkpoint text, p_at timestamptz default now())
returns table (
  enrollment_id uuid,
  student_id text,
  student_name text,
  expected int,
  completed int,
  behind int
)
language plpgsql stable as $$
declare
  v_week int;
  v_weeks_behind int;
  v_weekly int;
begin
  select cfg.week_no, cfg.weeks_behind into v_week, v_weeks_behind
  from (values ('nudge_1', 2, 1), ('nudge_2', 4, 2), ('nudge_3', 7, 3)) cfg(checkpoint, week_no, weeks_behind)
  where cfg.checkpoint = p_checkpoint;
  if v_week is null then
    raise exception 'unknown nudge checkpoint: %', p_checkpoint;
  end if;
  select c.weekly_target into v_weekly from cohorts c where c.cohort_id = p_cohort;

  return query
  select p.enrollment_id, p.student_id, s.name,
    (v_week - 1) * v_weekly,
    p.total_completed,
    (v_week - 1) * v_weekly - p.total_completed
  from app.enrollment_progress(p_at) p
  join students s on s.student_id = p.student_id
  where p.cohort_id = p_cohort
    and not p.refunded
    and (v_week - 1) * v_weekly - p.total_completed >= v_weeks_behind * v_weekly
    and not exists (
      select 1 from notifications n
      where n.enrollment_id = p.enrollment_id and n.template = 'nudge' and n.checkpoint = p_checkpoint)
    and (select count(distinct n.checkpoint) from notifications n
      where n.enrollment_id = p.enrollment_id and n.template = 'nudge') < 3
  order by s.name;
end
$$;

-- ───────── 알림 받는 사람 (spec.md 12장 받는 사람 표) ─────────
-- 자녀 본인 휴대폰으로 진행 = students.own_phone이 있음.
-- 새 접속 링크는 요청한 번호가 등록된 번호일 때만 돌려준다(등록 여부를 화면에 드러내지 않는 것은 앱의 몫).
create function app.notification_recipients(p_student text, p_template text, p_requested_phone text default null)
returns table (recipient text, phone text)
language sql stable as $$
  select r.recipient, r.phone
  from students s
  join guardians g on g.guardian_id = s.guardian_id
  cross join lateral (values ('guardian', g.phone), ('child', s.own_phone)) r(recipient, phone)
  where s.student_id = p_student
    and r.phone is not null
    and (
      (p_template = 'start_guide' and r.recipient = 'guardian')
      or p_template in ('nudge', 'live_day', 'closing_notice', 'certificate')
      or (p_template = 'child_link' and r.recipient = 'child')
      or (p_template = 'new_link' and r.phone = p_requested_phone)
    )
$$;

-- ───────── 규칙: 진도 독려 최대 3회 ─────────
create function app.enforce_nudge_cap() returns trigger
language plpgsql as $$
begin
  if new.template = 'nudge'
    and not exists (
      select 1 from notifications n
      where n.enrollment_id = new.enrollment_id and n.template = 'nudge' and n.checkpoint = new.checkpoint)
    and (select count(distinct n.checkpoint) from notifications n
      where n.enrollment_id = new.enrollment_id and n.template = 'nudge') >= 3
  then
    raise exception 'nudge cap reached for enrollment %', new.enrollment_id using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger notifications_nudge_cap
before insert on notifications
for each row execute function app.enforce_nudge_cap();

-- ───────── 규칙: 환불하면 접속 링크 폐기 ─────────
-- 접속 링크는 수강이 아니라 학습자에 붙어 있으므로, 환불하지 않은 다른 수강(재수강 등)이 남아 있으면 폐기하지 않는다.
create function app.revoke_tokens_on_refund() returns trigger
language plpgsql as $$
begin
  if new.refunded_at is not null and old.refunded_at is null
    and not exists (
      select 1 from enrollments e
      where e.student_id = new.student_id and e.enrollment_id <> new.enrollment_id and e.refunded_at is null)
  then
    update access_tokens set revoked_at = now()
    where student_id = new.student_id and revoked_at is null;
  end if;
  return new;
end
$$;

create trigger enrollments_refund_revoke
after update of refunded_at on enrollments
for each row execute function app.revoke_tokens_on_refund();

-- ───────── 권한 (RLS) ─────────
-- 학습자 앱의 요청은 세션 JWT의 값으로 구분한다(발급 방식은 접속 링크 작업에서 정한다).
--   student_ids: 이 세션이 볼 수 있는 학습자 (보호자 = 자녀 전부, 자녀 = 본인)
--   guardian_id: 보호자 세션일 때만
-- 학습자 앱은 읽기만 한다. 쓰기(학습 완료, 인증 등)는 서버(service_role)를 거친다.

create function app.jwt_student_ids() returns text[]
language sql stable as $$
  select coalesce(array(select jsonb_array_elements_text(auth.jwt() -> 'student_ids')), '{}'::text[])
$$;

create function app.jwt_guardian_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'guardian_id', '')::uuid
$$;

alter table articles enable row level security;
alter table sentences enable row level security;
alter table vocab enable row level security;
alter table assets enable row level security;
alter table cohorts enable row level security;
alter table cohort_weeks enable row level security;
alter table live_sessions enable row level security;
alter table guardians enable row level security;
alter table students enable row level security;
alter table access_tokens enable row level security;
alter table enrollments enable row level security;
alter table activities enable row level security;
alter table notifications enable row level security;
alter table live_clicks enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on articles, sentences, vocab, assets, cohorts, cohort_weeks, live_sessions,
  guardians, students, enrollments, activities, live_clicks to authenticated;
-- access_tokens, notifications: 학습자 앱에서 읽지 않는다 (정책 없음 = 접근 불가)

revoke all on all functions in schema app from public;
grant usage on schema app to authenticated;
grant execute on function app.jwt_student_ids(), app.jwt_guardian_id() to authenticated;

create policy guardians_self on guardians for select to authenticated
  using (guardian_id = app.jwt_guardian_id());

create policy students_self on students for select to authenticated
  using (student_id = any (app.jwt_student_ids()));

create policy enrollments_self on enrollments for select to authenticated
  using (student_id = any (app.jwt_student_ids()));

create policy activities_self on activities for select to authenticated
  using (enrollment_id in (select en.enrollment_id from enrollments en where en.student_id = any (app.jwt_student_ids())));

create policy live_clicks_self on live_clicks for select to authenticated
  using (student_id = any (app.jwt_student_ids()));

create policy cohorts_enrolled on cohorts for select to authenticated
  using (cohort_id in (select en.cohort_id from enrollments en where en.student_id = any (app.jwt_student_ids())));

create policy cohort_weeks_enrolled on cohort_weeks for select to authenticated
  using (cohort_id in (select en.cohort_id from enrollments en where en.student_id = any (app.jwt_student_ids())));

create policy live_sessions_enrolled on live_sessions for select to authenticated
  using (cohort_id in (select en.cohort_id from enrollments en where en.student_id = any (app.jwt_student_ids())));

-- 학습 자료는 수강 중인 기수에서 주차가 시작된 공개 기사만 (spec.md 17장: 자료는 주차가 시작되어야 열린다)
-- articles 정책이 다시 articles를 읽으면 RLS가 재귀하므로 security definer로 둔다. 범위는 JWT의 student_ids로만 정해진다.
create function app.visible_article_ids() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select cw.article_id
  from cohort_weeks cw
  join enrollments en on en.cohort_id = cw.cohort_id
  join articles ar on ar.article_id = cw.article_id
  where en.student_id = any (app.jwt_student_ids())
    and cw.starts_at <= now()
    and ar.status = 'published'
$$;
grant execute on function app.visible_article_ids() to authenticated;

create policy articles_visible on articles for select to authenticated
  using (article_id in (select app.visible_article_ids()));
create policy sentences_visible on sentences for select to authenticated
  using (article_id in (select app.visible_article_ids()));
create policy vocab_visible on vocab for select to authenticated
  using (article_id in (select app.visible_article_ids()));
create policy assets_visible on assets for select to authenticated
  using (article_id in (select app.visible_article_ids()));
