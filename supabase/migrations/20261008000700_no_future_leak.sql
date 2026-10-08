-- 브라우저(개발자 도구)로 보낼 데이터에서 아직 열리지 않은 주차 정보를 뺀다 (2026-10-08 보안 점검)
-- 1) 홈의 12주 기록: 시작하지 않은 주차는 기사 제목을 싣지 않는다
-- 2) 학습 자료 파일: 화면에는 앱 주소(/files/...)만 싣고, 누를 때 서버가 수강·주차 공개를 확인한 뒤 짧은 주소를 준다

create or replace function public.student_home(p_student text, p_at timestamptz default now())
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
    select w.week_no, w.starts_at, w.ends_at,
      case when w.starts_at <= p_at then ar.title_en end as title_en,
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

-- 학습 자료 파일 하나: 이 학습자의 기수에서 그 주차가 시작됐고 기사가 공개일 때만
create function public.course_asset(p_student text, p_week int, p_type text, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('storage_key', a.storage_key, 'file_name', a.file_name)
  from enrollments en
  join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p_week and w.starts_at <= p_at
  join articles ar on ar.article_id = w.article_id and ar.status = 'published'
  join assets a on a.article_id = ar.article_id and a.type = p_type
  where en.enrollment_id = app.current_enrollment(p_student)
    and a.version = (select max(a2.version) from assets a2 where a2.article_id = a.article_id and a2.type = a.type)
$$;

revoke all on function public.course_asset(text, int, text, timestamptz) from public, anon, authenticated;
grant execute on function public.course_asset(text, int, text, timestamptz) to service_role;
