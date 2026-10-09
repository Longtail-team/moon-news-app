-- 청독 미션 (2026-10-09 결정): 음원을 90% 이상 들으면 "청독 완료" → 학습 1회. 영어 기사·한영·VOCA 음원 모두
-- 청독량 = 앱 어디서 듣든 실제로 재생된 시간(반복 포함)을 모두 쌓는다(listening_logs)
-- 청독 완료 1번 = 카드 1장(그동안 들은 음원을 한 장에). 카드는 휴대폰에서 1080×1350(4:5)으로 그려 cards/<수강>/에 올리고,
-- 인스타 올리기(사진처럼 저장)와 뉴스북(주차 쪽 4열)에 쓴다. 청독만으로 완주 인정

alter table activities drop constraint activities_activity_type_check;
alter table activities add constraint activities_activity_type_check
  check (activity_type in ('KR_READING', 'EN_READING', 'VOCA', 'SUMMARY', 'DEBATE', 'LISTENING'));

-- 실제 재생 시간 기록: 휴대폰이 재생 중에 15초 안팎으로 나눠 보낸다(한 번에 최대 120초)
create table listening_logs (
  log_id bigint generated always as identity primary key,
  enrollment_id uuid not null references enrollments on delete cascade,
  week_no int not null,
  audio_type text not null check (audio_type in ('article_audio', 'kr_en_repeat_audio', 'voca_repeat_audio')),
  seconds numeric(6, 1) not null check (seconds > 0 and seconds <= 120),
  played_at timestamptz not null default now()
);
create index listening_logs_enrollment_idx on listening_logs (enrollment_id);
alter table listening_logs enable row level security;
revoke all on listening_logs from anon, authenticated;

-- 청독 카드에 들어간 값 (완료 시점에 고정)
create table listening_cards (
  activity_id uuid primary key references activities on delete cascade,
  plays jsonb not null default '{}'::jsonb,   -- {"article_audio": 2, "kr_en_repeat_audio": 1}
  session_seconds int not null default 0 check (session_seconds >= 0),
  total_seconds int not null default 0 check (total_seconds >= 0), -- 그때까지 누적 청독 시간
  updated_at timestamptz not null default now()
);
alter table listening_cards enable row level security;
revoke all on listening_cards from anon, authenticated;

-- 파일 키 규칙에 청독 카드(cards/<수강>/...)를 더한다
create or replace function app.media_key_ok(p_type text, p_enrollment uuid, p_key text) returns boolean
language sql immutable as $$
  select p_key is not null and case
    when p_type in ('KR_READING', 'EN_READING') then p_key like 'recordings/' || p_enrollment || '/%'
    when p_type in ('SUMMARY', 'DEBATE') then p_key like 'photos/' || p_enrollment || '/%'
    when p_type = 'VOCA' then p_key like 'recordings/' || p_enrollment || '/%' or p_key like 'photos/' || p_enrollment || '/%'
    when p_type = 'LISTENING' then p_key like 'cards/' || p_enrollment || '/%'
    else false
  end
$$;

-- 재생 시간 기록 (지금 수강, 시작한 주차만)
create function public.log_listening(p_student text, p_week int, p_audio text, p_seconds numeric, p_at timestamptz default now())
returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into listening_logs (enrollment_id, week_no, audio_type, seconds, played_at)
  select en.enrollment_id, p_week, p_audio, round(least(greatest(p_seconds, 0.1), 120), 1), p_at
  from enrollments en
  join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p_week and w.starts_at <= p_at
  where en.enrollment_id = app.current_enrollment(p_student, p_at)
$$;

-- 청독 완료 준비: 작성 중 청독 기록을 만들거나 이어 쓰고 카드 값을 고정해 돌려준다. 카드 그림을 올린 뒤 complete_activity로 완료
create function public.start_listening(p_student text, p_week int, p_plays jsonb, p_session_seconds int, p_at timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_act jsonb := public.start_activity(p_student, p_week, 'LISTENING');
  v_id uuid := (v_act->>'activity_id')::uuid;
  v_en uuid := (v_act->>'enrollment_id')::uuid;
  v_total int;
begin
  if not exists (select 1 from jsonb_each_text(coalesce(p_plays, '{}'::jsonb)) p where p.value::int > 0
                 and p.key in ('article_audio', 'kr_en_repeat_audio', 'voca_repeat_audio')) then
    raise exception 'no plays' using errcode = 'check_violation';
  end if;
  select coalesce(sum(seconds), 0)::int into v_total from listening_logs where enrollment_id = v_en;
  insert into listening_cards (activity_id, plays, session_seconds, total_seconds)
  values (v_id, p_plays, greatest(p_session_seconds, 0), v_total)
  on conflict (activity_id) do update set plays = excluded.plays, session_seconds = excluded.session_seconds, total_seconds = excluded.total_seconds, updated_at = now();
  return (
    select jsonb_build_object(
      'activity_id', v_id,
      'week_no', p_week,
      'title', ar.title_en,
      'course_title', c.course_title, 'cohort_no', c.cohort_no,
      'name', s.name,
      'date', (p_at at time zone 'Asia/Seoul')::date,
      'plays', p_plays, 'session_seconds', greatest(p_session_seconds, 0), 'total_seconds', v_total)
    from enrollments en join cohorts c using (cohort_id) join students s on s.student_id = en.student_id
    join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p_week
    left join articles ar on ar.article_id = w.article_id and ar.status = 'published'
    where en.enrollment_id = v_en
  );
end
$$;

-- 인스타 올리기: 청독 카드도 사진처럼 저장
create or replace function public.upload_queue(p_student text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, c.deadline, c.total_target
    from enrollments en join cohorts c using (cohort_id)
    where en.enrollment_id = app.current_enrollment(p_student)
  )
  select jsonb_build_object(
    'deadline', en.deadline,
    'total_target', en.total_target,
    'verified_count', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.verified_at is not null),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'activity_id', a.activity_id, 'week_no', a.week_no, 'activity_type', a.activity_type,
        'completed_at', a.completed_at, 'media_key', a.media_key,
        'kind', case when a.media_key like 'photos/%' or a.media_key like 'cards/%' then 'photo' else 'video' end,
        'template_key', (select s.storage_key from cohort_weeks w join assets s on s.article_id = w.article_id and s.type = 'insta_template'
                         where w.cohort_id = en.cohort_id and w.week_no = a.week_no order by s.version desc limit 1)
      ) order by a.completed_at)
      from activities a
      where a.enrollment_id = en.enrollment_id and a.completed_at is not null and a.verified_at is null
    ), '[]'::jsonb)
  )
  from en
$$;

-- 뉴스북: 주차마다 청독 카드(모두), 기록에 누적 청독 시간
create or replace function public.newsbook(p_student text, p_enrollment uuid default null, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, c.course_title, c.cohort_no, c.start_date, c.deadline, c.weekly_target, c.total_target
    from enrollments en join cohorts c using (cohort_id)
    where en.student_id = p_student and en.refunded_at is null
      and en.enrollment_id = coalesce(p_enrollment, app.current_enrollment(p_student, p_at))
  ),
  wk as (
    select w.week_no, w.starts_at, w.ends_at, ar.title_en, ar.title_ko
    from en join cohort_weeks w on w.cohort_id = en.cohort_id and w.starts_at <= p_at
    left join articles ar on ar.article_id = w.article_id and ar.status = 'published'
  ),
  done as (
    select a.week_no, a.activity_type, count(*)::int as n
    from en join activities a on a.enrollment_id = en.enrollment_id and a.completed_at is not null
    group by a.week_no, a.activity_type
  ),
  summary as (
    select distinct on (a.week_no) a.week_no, a.activity_id, n.title, n.body, a.media_key like 'photos/%' as has_photo
    from en join activities a on a.enrollment_id = en.enrollment_id and a.activity_type = 'SUMMARY' and a.completed_at is not null
    join activity_notes n on n.activity_id = a.activity_id and (n.title is not null or n.body is not null)
    order by a.week_no, a.completed_at desc
  ),
  cards as (
    select a.week_no, a.activity_id, a.completed_at from en
    join activities a on a.enrollment_id = en.enrollment_id and a.activity_type = 'LISTENING' and a.completed_at is not null and a.media_key like 'cards/%'
  ),
  opinion as (
    select * from (
      select distinct on (a.week_no) a.week_no, n.stance, n.reason
      from en join activities a on a.enrollment_id = en.enrollment_id and a.activity_type = 'DEBATE'
      join activity_notes n on n.activity_id = a.activity_id
      order by a.week_no, n.updated_at desc
    ) o where o.stance is not null
  )
  select jsonb_build_object(
    'enrollment_id', en.enrollment_id,
    'is_current', en.enrollment_id = app.current_enrollment(p_student, p_at),
    'student', (select jsonb_build_object('name', s.name, 'ai_consent', s.ai_ocr_consent_at is not null) from students s where s.student_id = p_student),
    'cohort', jsonb_build_object('course_title', en.course_title, 'cohort_no', en.cohort_no, 'start_date', en.start_date, 'deadline', en.deadline,
                                 'weeks_total', (select count(*) from cohort_weeks w where w.cohort_id = en.cohort_id), 'total_target', en.total_target),
    'download_from', en.deadline + 1,
    'can_download', p_at >= app.kst_day_end(en.deadline),
    'pending_post_count', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.completed_at is not null and a.verified_at is null),
    'stats', jsonb_build_object(
      'readings', coalesce((select sum(n) from done where activity_type in ('KR_READING', 'EN_READING')), 0),
      'articles', (select count(distinct week_no) from done),
      'summaries', coalesce((select sum(n) from done where activity_type = 'SUMMARY'), 0),
      'opinions', (select count(*) from opinion),
      'weeks_met', (select count(*) from (select week_no from done group by week_no having sum(n) >= en.weekly_target) m),
      'completed', coalesce((select sum(n) from done), 0),
      'verified', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.verified_at is not null),
      'acts', coalesce((select jsonb_object_agg(x.activity_type, x.n) from (select activity_type, sum(n) as n from done group by activity_type) x), '{}'::jsonb),
      'listening_seconds', coalesce((select sum(l.seconds) from listening_logs l where l.enrollment_id = en.enrollment_id), 0)::int,
      'reading_words', coalesce((select sum(ar.word_count) from activities a
                                 join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = a.week_no
                                 join articles ar on ar.article_id = w.article_id
                                 where a.enrollment_id = en.enrollment_id and a.activity_type = 'EN_READING' and a.completed_at is not null), 0)),
    'weeks', coalesce((select jsonb_agg(jsonb_build_object(
        'week_no', wk.week_no, 'starts_at', wk.starts_at, 'title_en', wk.title_en, 'title_ko', wk.title_ko,
        'cards', coalesce((select jsonb_agg(jsonb_build_object('activity_id', c.activity_id) order by c.completed_at) from cards c where c.week_no = wk.week_no), '[]'::jsonb),
        'summary', (select jsonb_build_object('activity_id', s.activity_id, 'title', s.title, 'body', s.body, 'has_photo', s.has_photo) from summary s where s.week_no = wk.week_no),
        'opinion', (select jsonb_build_object('stance', o.stance, 'reason', o.reason) from opinion o where o.week_no = wk.week_no),
        'tally', (select jsonb_build_object('agree', t.agree, 'disagree', t.disagree, 'final', p_at >= wk.ends_at)
                  from opinion o, app.debate_tally(en.cohort_id, wk.week_no) t where o.week_no = wk.week_no)
      ) order by wk.week_no) from wk), '[]'::jsonb),
    'others', coalesce((select jsonb_agg(jsonb_build_object('enrollment_id', e2.enrollment_id, 'course_title', c2.course_title, 'cohort_no', c2.cohort_no, 'deadline', c2.deadline) order by c2.start_date desc)
                        from enrollments e2 join cohorts c2 using (cohort_id)
                        where e2.student_id = p_student and e2.refunded_at is null and e2.enrollment_id <> en.enrollment_id), '[]'::jsonb)
  )
  from en
$$;

-- 완주 화면에 누적 청독 시간 (청독만으로 완주한 학생도 쌓인 양을 본다)
create or replace function public.finish_data(p_student text, p_enrollment uuid default null, p_at timestamptz default now())
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
    'listening_seconds', coalesce((select sum(l.seconds) from listening_logs l where l.enrollment_id = en.enrollment_id), 0)::int,
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

revoke all on function public.log_listening(text, int, text, numeric, timestamptz), public.start_listening(text, int, jsonb, int, timestamptz) from public, anon, authenticated;
grant execute on function public.log_listening(text, int, text, numeric, timestamptz), public.start_listening(text, int, jsonb, int, timestamptz) to service_role;
