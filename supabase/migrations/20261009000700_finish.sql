-- 완주 화면·상장·마감 이후 홈 (spec 5·7·9장, 2026-10-09)
-- 홈: 종강일이 지나면 마감 이후 홈(유예 중 / 유예 끝)으로 바뀐다 → 유예 마감일과 녹음 보관 기한을 싣는다
-- 완주 화면: 인증 수, 활동별 횟수, 소리 내어 읽은 영어 단어, 첫·마지막 영어 낭독(제때·유예 완주만), 상장
-- 상장: 이름 확인 후 발급. 고칠 때마다 새로 발급하고 알림 기록을 남긴다(솔라피 연결 전이라 기록만). 보상 PDF는 뺐다

create or replace function public.student_home(p_student text, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, c.course_title, c.cohort_no, c.deadline, c.grace_until, c.start_date,
      c.weekly_target, c.total_target
    from enrollments en join cohorts c using (cohort_id)
    where en.enrollment_id = app.current_enrollment(p_student, p_at)
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
    select ls.session_id, ls.session_no, ls.starts_at, ls.zoom_url is not null as has_zoom
    from en join live_sessions ls on ls.cohort_id = en.cohort_id
    where p_at >= ls.starts_at - interval '3 days' and p_at <= ls.starts_at + interval '3 hours'
    order by ls.starts_at
    limit 1
  )
  select case when not exists (select 1 from en) then null else jsonb_build_object(
    'student', (select jsonb_build_object('student_id', s.student_id, 'name', s.name) from students s where s.student_id = p_student),
    'cohort', (select jsonb_build_object(
      'course_title', en.course_title, 'cohort_no', en.cohort_no, 'deadline', en.deadline, 'start_date', en.start_date,
      'grace_until', en.grace_until, 'grace_open', p_at < app.kst_day_end(en.grace_until), 'retention_until', (en.deadline + interval '3 months')::date,
      'weekly_target', en.weekly_target, 'total_target', en.total_target) from en),
    'progress', (select jsonb_build_object(
      'current_week', p.current_week, 'this_week_completed', p.this_week_completed, 'total_completed', p.total_completed,
      'verified_count', p.verified_count, 'pending_post_count', p.pending_post_count, 'reading_words', p.reading_words,
      'completion_tier', p.completion_tier) from p),
    'weeks', (select jsonb_agg(jsonb_build_object(
      'week_no', wk.week_no, 'starts_at', wk.starts_at, 'ends_at', wk.ends_at, 'title', wk.title_en, 'acts', wk.acts)
      order by wk.week_no) from wk),
    'live', (select jsonb_build_object('session_id', live.session_id, 'session_no', live.session_no, 'starts_at', live.starts_at, 'has_zoom', live.has_zoom) from live)
  ) end
$$;

create function public.finish_data(p_student text, p_enrollment uuid default null, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, en.certificate_name, en.certificate_sent_at,
      c.course_title, c.cohort_no, c.start_date, c.deadline, c.grace_until, c.total_target
    from enrollments en join cohorts c using (cohort_id)
    where en.student_id = p_student and en.refunded_at is null
      and en.enrollment_id = coalesce(p_enrollment, app.current_enrollment(p_student, p_at))
  ),
  fin as (
    select a.verified_at from en join activities a on a.enrollment_id = en.enrollment_id and a.verified_at <= p_at
    order by a.verified_at offset (select total_target - 1 from en) limit 1
  ),
  tier as (
    select case
      when (select verified_at from fin) is null then null
      when (select verified_at from fin) < app.kst_day_end(en.deadline) then 'on_time'
      when (select verified_at from fin) < app.kst_day_end(en.grace_until) then 'grace'
      else 'late' end as t
    from en
  ),
  readings as (
    select a.activity_id, a.week_no, a.completed_at, a.post_url, (a.media_key is not null and a.media_deleted_at is null) as has_audio
    from en join activities a on a.enrollment_id = en.enrollment_id
    where a.activity_type = 'EN_READING' and a.verified_at is not null
  )
  select jsonb_build_object(
    'enrollment_id', en.enrollment_id,
    'is_current', en.enrollment_id = app.current_enrollment(p_student, p_at),
    'student', (select jsonb_build_object('name', s.name) from students s where s.student_id = p_student),
    'cohort', jsonb_build_object('course_title', en.course_title, 'cohort_no', en.cohort_no, 'start_date', en.start_date,
                                 'deadline', en.deadline, 'grace_until', en.grace_until, 'total_target', en.total_target),
    'verified', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.verified_at <= p_at),
    'completed_at', (select verified_at from fin),
    'tier', (select t from tier),
    'acts', coalesce((select jsonb_object_agg(x.activity_type, x.n) from (
        select a.activity_type, count(*) as n from activities a
        where a.enrollment_id = en.enrollment_id and a.completed_at is not null group by a.activity_type) x), '{}'::jsonb),
    'reading_words', coalesce((select sum(ar.word_count) from activities a
        join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = a.week_no
        join articles ar on ar.article_id = w.article_id
        where a.enrollment_id = en.enrollment_id and a.activity_type = 'EN_READING' and a.completed_at is not null), 0),
    -- 첫·마지막 낭독: 인스타에 올린 영어 낭독 중 가장 이른 것과 가장 늦은 것 (spec 9장), 제때·유예 완주만
    'first_reading', case when (select t from tier) in ('on_time', 'grace') then
        (select to_jsonb(r) from readings r order by r.completed_at limit 1) end,
    'last_reading', case when (select t from tier) in ('on_time', 'grace') and (select count(*) from readings) > 1 then
        (select to_jsonb(r) from readings r order by r.completed_at desc limit 1) end,
    'certificate_name', en.certificate_name,
    'certificate_sent_at', en.certificate_sent_at
  )
  from en
$$;

-- 상장 발급(이름 확인 후). 다시 부르면 이름을 바꿔 새로 발급한다. 받는 사람마다 알림 기록(솔라피 연결 전: 기록만)
create function public.issue_certificate(p_student text, p_enrollment uuid, p_name text, p_at timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name text := btrim(p_name);
  v_fin jsonb := public.finish_data(p_student, p_enrollment, p_at);
begin
  if v_fin is null then raise exception 'enrollment not found' using errcode = 'check_violation'; end if;
  if v_fin->>'tier' is null then raise exception 'not completed' using errcode = 'check_violation'; end if;
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 20 then raise exception 'bad name' using errcode = 'check_violation'; end if;
  update enrollments set
    certificate_name = v_name,
    certificate_sent_at = p_at,
    completed_at = coalesce(completed_at, (v_fin->>'completed_at')::timestamptz),
    completion_tier = coalesce(completion_tier, v_fin->>'tier')
  where enrollment_id = (v_fin->>'enrollment_id')::uuid;
  insert into notifications (student_id, enrollment_id, template, checkpoint, recipient, sent_to_phone, sent_at, result)
  select p_student, (v_fin->>'enrollment_id')::uuid, 'certificate', 'issued', r.recipient, r.phone, p_at, 'not_sent(솔라피 미연결)'
  from app.notification_recipients(p_student, 'certificate') r;
  return jsonb_build_object('certificate_name', v_name, 'certificate_sent_at', p_at);
end
$$;

revoke all on function public.finish_data(text, uuid, timestamptz), public.issue_certificate(text, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.finish_data(text, uuid, timestamptz), public.issue_certificate(text, uuid, text, timestamptz) to service_role;
