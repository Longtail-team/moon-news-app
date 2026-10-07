-- T03 세션과 학생 홈 데이터
-- 브라우저는 우리 서버(Next.js)하고만 통신하고, 서버가 service_role로 이 함수·테이블을 쓴다.

-- ───────── 세션 (출입증) ─────────
-- 접속 링크로 한 번 들어오면 만들어진다. 쿠키 값의 원문은 저장하지 않고 해시만 둔다.
-- 세션의 범위(볼 수 있는 학습자)는 요청 때마다 접속 링크에서 다시 계산한다. 링크가 폐기되면 세션도 함께 막힌다.
create table sessions (
  session_id uuid primary key default gen_random_uuid(),
  session_hash text not null unique,
  token_id uuid not null references access_tokens on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index sessions_token_idx on sessions (token_id);
alter table sessions enable row level security;
revoke all on sessions from anon, authenticated;

-- 서버(service_role)가 app 스키마 함수를 쓸 수 있게 한다
grant usage on schema app to service_role;
grant execute on all functions in schema app to service_role;

-- ───────── 세션 확인 ─────────
-- 쿠키 해시로 세션을 찾고, 볼 수 있는 학습자 목록을 돌려준다.
-- 보호자 링크 = 그 보호자의 자녀 전부, 자녀 링크 = 그 자녀만. 환불로 가려진 수강만 남은 학습자는 뺀다.
create function public.session_scope(p_session_hash text)
returns table (
  session_id uuid,
  holder text,
  guardian_id uuid,
  student_id text,
  student_name text,
  grade text
)
language sql stable security definer set search_path = public, pg_temp as $$
  with s as (
    select se.session_id, t.holder, t.student_id as token_student, st.guardian_id
    from sessions se
    join access_tokens t on t.token_id = se.token_id
    join students st on st.student_id = t.student_id
    where se.session_hash = p_session_hash
      and se.revoked_at is null and se.expires_at > now()
      and t.revoked_at is null and (t.expires_at is null or t.expires_at > now())
  )
  select s.session_id, s.holder, s.guardian_id, st.student_id, st.name,
    (select en.grade_at_enrollment from enrollments en join cohorts c using (cohort_id)
      where en.student_id = st.student_id and en.refunded_at is null
      order by c.start_date desc limit 1)
  from s
  join students st on (s.holder = 'guardian' and st.guardian_id = s.guardian_id)
                   or (s.holder = 'child' and st.student_id = s.token_student)
  where exists (select 1 from enrollments en where en.student_id = st.student_id and en.refunded_at is null)
  order by st.student_id
$$;

-- ───────── 학생 홈 (spec.md 7장) ─────────
-- 환불하지 않은 수강 중 가장 최근 기수 하나를 기준으로 한다.
create function public.student_home(p_student text, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, c.course_title, c.cohort_no, c.deadline, c.start_date,
      c.weekly_target, c.total_target
    from enrollments en join cohorts c using (cohort_id)
    where en.student_id = p_student and en.refunded_at is null
    order by c.start_date desc
    limit 1
  ),
  p as (
    select pr.* from en, app.enrollment_progress(p_at) pr where pr.enrollment_id = en.enrollment_id
  ),
  wk as (
    select w.week_no, w.starts_at, w.ends_at, ar.title_en,
      coalesce((
        select jsonb_agg(a.activity_type order by a.completed_at)
        from activities a
        where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.completed_at <= p_at
      ), '[]'::jsonb) as acts
    from en
    join cohort_weeks w on w.cohort_id = en.cohort_id
    left join articles ar on ar.article_id = w.article_id and ar.status = 'published'
  ),
  live as (
    select ls.session_no, ls.starts_at
    from en join live_sessions ls on ls.cohort_id = en.cohort_id
    where p_at >= ls.starts_at - interval '3 days' and p_at <= ls.starts_at + interval '3 hours'
    order by ls.starts_at
    limit 1
  )
  select case when not exists (select 1 from en) then null else jsonb_build_object(
    'student', (select jsonb_build_object('student_id', s.student_id, 'name', s.name) from students s where s.student_id = p_student),
    'cohort', (select jsonb_build_object(
      'course_title', en.course_title, 'cohort_no', en.cohort_no, 'deadline', en.deadline, 'start_date', en.start_date,
      'weekly_target', en.weekly_target, 'total_target', en.total_target) from en),
    'progress', (select jsonb_build_object(
      'current_week', p.current_week, 'this_week_completed', p.this_week_completed, 'total_completed', p.total_completed,
      'verified_count', p.verified_count, 'pending_post_count', p.pending_post_count, 'reading_words', p.reading_words,
      'completion_tier', p.completion_tier) from p),
    'weeks', (select jsonb_agg(jsonb_build_object(
      'week_no', wk.week_no, 'starts_at', wk.starts_at, 'ends_at', wk.ends_at, 'title', wk.title_en, 'acts', wk.acts)
      order by wk.week_no) from wk),
    'live', (select jsonb_build_object('session_no', live.session_no, 'starts_at', live.starts_at) from live)
  ) end
$$;

revoke all on function public.session_scope(text) from public, anon, authenticated;
revoke all on function public.student_home(text, timestamptz) from public, anon, authenticated;
grant execute on function public.session_scope(text) to service_role;
grant execute on function public.student_home(text, timestamptz) to service_role;

-- 환불로 접속 링크가 폐기되면 그 링크의 세션도 함께 끝낸다(요청 때마다 링크 상태를 보지만 기록을 남겨 둔다)
create function app.revoke_sessions_on_token_revoke() returns trigger
language plpgsql as $$
begin
  if new.revoked_at is not null and old.revoked_at is null then
    update sessions set revoked_at = new.revoked_at where token_id = new.token_id and revoked_at is null;
  end if;
  return new;
end
$$;

create trigger access_tokens_revoke_sessions
after update of revoked_at on access_tokens
for each row execute function app.revoke_sessions_on_token_revoke();
