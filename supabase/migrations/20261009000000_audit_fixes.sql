-- 2026-10-09 점검 수정
-- 1) 지금 기수: 재수강생이 다음 기수를 결제해도 그 기수가 시작하기 전까지는 진행 중인 기수를 보여 준다
-- 2) 화면이 홈 데이터를 따로 부르지 않게 자료 함수에 종강일·올릴 것 수를 함께 싣는다
-- 3) 낭독 화면에 기사 PDF 받기 (spec 17장)
-- 4) 녹음·사진 주소를 화면에 미리 싣지 않도록 활동 파일 조회 함수 (/media/<활동>)
-- 5) 라이브 줌 주소는 시작 10분 전 ~ 시작 3시간 뒤에만 준다

-- ───────── 1) 지금 기수 ─────────
-- 환불하지 않은 수강 중 시작한 기수를 먼저(그중 가장 최근), 시작한 기수가 없으면 가장 최근 기수
-- (함수 본문의 호출은 의존성으로 묶이지 않아 다시 만들어도 기존 함수들이 그대로 부른다)
drop function app.current_enrollment(text);
create function app.current_enrollment(p_student text, p_at timestamptz default now()) returns uuid
language sql stable as $$
  select en.enrollment_id
  from enrollments en join cohorts c using (cohort_id)
  where en.student_id = p_student and en.refunded_at is null
  order by (c.start_date <= (p_at at time zone 'Asia/Seoul')::date) desc, c.start_date desc
  limit 1
$$;

create or replace function public.student_home(p_student text, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, c.course_title, c.cohort_no, c.deadline, c.start_date,
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

-- ───────── 2·3) 자료 함수에 종강일·올릴 것 수·기사 PDF ─────────
create or replace function public.reading_material(p_student text, p_week int, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, c.weekly_target, c.deadline
    from enrollments en join cohorts c using (cohort_id)
    where en.enrollment_id = app.current_enrollment(p_student, p_at)
  ),
  w as (
    select w.week_no, ar.article_id, ar.title_en, ar.word_count
    from en
    join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p_week and w.starts_at <= p_at
    join articles ar on ar.article_id = w.article_id and ar.status = 'published'
  )
  select jsonb_build_object(
    'week_no', w.week_no,
    'weekly_target', en.weekly_target,
    'deadline', en.deadline,
    'week_completed', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.completed_at is not null),
    'title', w.title_en,
    'word_count', w.word_count,
    'sentences', (select jsonb_agg(jsonb_build_object('para_no', s.para_no, 'sent_no', s.sent_no, 'en', s.en, 'ko', s.ko) order by s.sent_no)
                  from sentences s where s.article_id = w.article_id),
    'assets', (select coalesce(jsonb_agg(jsonb_build_object('type', a.type, 'storage_key', a.storage_key, 'timing_key', a.timing_key)), '[]'::jsonb)
               from assets a
               where a.article_id = w.article_id and a.type in ('article_audio', 'kr_en_repeat_audio', 'article_pdf')
                 and a.version = (select max(a2.version) from assets a2 where a2.article_id = a.article_id and a2.type = a.type))
  )
  from en, w
$$;

create or replace function public.work_material(p_student text, p_week int, p_type text, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, c.weekly_target, c.deadline
    from enrollments en join cohorts c using (cohort_id)
    where en.enrollment_id = app.current_enrollment(p_student, p_at)
  ),
  w as (
    select w.week_no, ar.article_id, ar.title_en
    from en
    join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p_week and w.starts_at <= p_at
    join articles ar on ar.article_id = w.article_id and ar.status = 'published'
  )
  select jsonb_build_object(
    'week_no', w.week_no,
    'weekly_target', en.weekly_target,
    'deadline', en.deadline,
    'week_completed', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.completed_at is not null),
    'title', w.title_en,
    'vocab', (select coalesce(jsonb_agg(jsonb_build_object('no', v.no, 'word', v.word, 'meaning', v.meaning) order by v.no), '[]'::jsonb)
              from vocab v where v.article_id = w.article_id),
    'assets', (select coalesce(jsonb_agg(jsonb_build_object('type', a.type, 'storage_key', a.storage_key, 'file_name', a.file_name)), '[]'::jsonb)
               from assets a
               where a.article_id = w.article_id and a.type in ('article_pdf', 'voca_pdf', 'voca_repeat_audio')
                 and a.version = (select max(a2.version) from assets a2 where a2.article_id = a.article_id and a2.type = a.type)),
    'draft', (select jsonb_build_object('activity_id', a.activity_id, 'media_key', a.media_key)
              from activities a
              where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.activity_type = p_type and a.completed_at is null
              order by a.started_at desc limit 1)
  )
  from en, w
$$;

create or replace function public.materials(p_student text, p_week int default null, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id
    from enrollments en
    where en.enrollment_id = app.current_enrollment(p_student, p_at)
  ),
  wk as (
    select w.week_no, w.starts_at, w.ends_at, w.article_id,
      (select ar.title_en from articles ar where ar.article_id = w.article_id and ar.status = 'published') as title
    from en join cohort_weeks w on w.cohort_id = en.cohort_id
  ),
  opened as (select * from wk where starts_at <= p_at),
  cur as (select week_no from wk where p_at >= starts_at and p_at < ends_at),
  sel as (
    select o.* from opened o
    where o.week_no = coalesce(p_week, (select week_no from cur), (select max(week_no) from opened))
  )
  select jsonb_build_object(
    'current_week', (select week_no from cur),
    'pending_post_count', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.completed_at is not null and a.verified_at is null),
    'opened', coalesce((select jsonb_agg(jsonb_build_object('week_no', o.week_no, 'title', o.title) order by o.week_no desc) from opened o), '[]'::jsonb),
    'next_open', (select jsonb_build_object('week_no', w.week_no, 'starts_at', w.starts_at) from wk w where w.starts_at > p_at order by w.starts_at limit 1),
    'selected', (select jsonb_build_object(
        'week_no', s.week_no,
        'title_en', ar.title_en, 'title_ko', ar.title_ko, 'level', ar.level, 'word_count', ar.word_count,
        'assets', (select coalesce(jsonb_agg(jsonb_build_object('type', a.type, 'storage_key', a.storage_key, 'file_name', a.file_name)), '[]'::jsonb)
                   from assets a
                   where a.article_id = ar.article_id and a.type <> 'insta_template'
                     and a.version = (select max(a2.version) from assets a2 where a2.article_id = a.article_id and a2.type = a.type)),
        'items', (select coalesce(jsonb_agg(jsonb_build_object('kind', i.kind, 'title', i.title, 'url', i.url, 'body', i.body) order by i.sort_no), '[]'::jsonb)
                  from week_items i where i.article_id = ar.article_id))
      from sel s left join articles ar on ar.article_id = s.article_id and ar.status = 'published'),
    'live', coalesce((select jsonb_agg(jsonb_build_object(
        'session_id', l.session_id, 'session_no', l.session_no, 'starts_at', l.starts_at,
        'has_zoom', l.zoom_url is not null, 'has_replay', l.replay_url is not null) order by l.session_no)
      from en join live_sessions l on l.cohort_id = en.cohort_id), '[]'::jsonb)
  )
  from en
$$;

-- ───────── 4) 활동 파일 (녹음·사진) ─────────
-- 지금 학습자의 지금 수강 기록일 때만 파일 키를 준다. 서버가 누를 때마다 짧은 주소로 바꿔 보낸다.
create function public.activity_media(p_student text, p_activity uuid)
returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select a.media_key from activities a
  where a.activity_id = p_activity and a.enrollment_id = app.current_enrollment(p_student) and a.media_key is not null
$$;

-- ───────── 5) 라이브 입장 시간 ─────────
drop function public.live_click(text, uuid, boolean);
create function public.live_click(p_student text, p_session uuid, p_replay boolean, p_at timestamptz default now())
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_url text;
begin
  select case
      when p_replay then l.replay_url
      when p_at between l.starts_at - interval '10 minutes' and l.starts_at + interval '3 hours' then l.zoom_url
    end into v_url
  from live_sessions l
  join enrollments en on en.cohort_id = l.cohort_id and en.enrollment_id = app.current_enrollment(p_student, p_at)
  where l.session_id = p_session;
  if v_url is null then return null; end if;
  if not p_replay then
    insert into live_clicks (student_id, session_id, clicked_at) values (p_student, p_session, p_at);
  end if;
  return v_url;
end
$$;

revoke all on function public.activity_media(text, uuid), public.live_click(text, uuid, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.activity_media(text, uuid), public.live_click(text, uuid, boolean, timestamptz) to service_role;
grant execute on function app.current_enrollment(text, timestamptz) to service_role;
