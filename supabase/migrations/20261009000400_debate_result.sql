-- 찬반 결과는 내 의견을 고른 뒤에만 바로 보여 준다 (2026-10-09). 고르기 전에는 볼 수 없다.
-- 고르는 순간 의견을 저장하므로, 집계는 "마감 전에 저장된 의견, 학습자(수강)마다 마지막 1개"로 바꾼다.
-- 마감(주차 끝) 뒤에는 의견을 저장하지 않으므로 결과는 마감 시점에 고정된다.

create or replace function app.debate_tally(p_cohort uuid, p_week int)
returns table (agree int, disagree int)
language sql stable as $$
  with last as (
    select distinct on (a.enrollment_id) n.stance
    from activities a
    join enrollments en on en.enrollment_id = a.enrollment_id and en.cohort_id = p_cohort and en.refunded_at is null
    join activity_notes n on n.activity_id = a.activity_id
    where a.week_no = p_week and a.activity_type = 'DEBATE'
    order by a.enrollment_id, n.updated_at desc
  )
  select (count(*) filter (where stance = 'agree'))::int, (count(*) filter (where stance = 'disagree'))::int from last
$$;

-- 이 학습자가 그 주차에 의견을 골랐을 때만 결과를 준다(마지막 의견이 "고르지 않음"이면 없음)
create function public.my_debate_tally(p_student text, p_week int, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (select en.enrollment_id, en.cohort_id from enrollments en where en.enrollment_id = app.current_enrollment(p_student, p_at)),
  mine as (
    select n.stance from en join activities a on a.enrollment_id = en.enrollment_id and a.week_no = p_week and a.activity_type = 'DEBATE'
    join activity_notes n on n.activity_id = a.activity_id
    order by n.updated_at desc limit 1
  )
  select jsonb_build_object('agree', t.agree, 'disagree', t.disagree, 'mine', (select stance from mine))
  from en, app.debate_tally(en.cohort_id, p_week) t
  where (select stance from mine) is not null
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
    select w.week_no, w.ends_at, ar.article_id, ar.title_en
    from en
    join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p_week and w.starts_at <= p_at
    join articles ar on ar.article_id = w.article_id and ar.status = 'published'
  ),
  d as (
    select a.activity_id, a.media_key from en, w, activities a
    where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.activity_type = p_type and a.completed_at is null
    order by a.started_at desc limit 1
  )
  select jsonb_build_object(
    'week_no', w.week_no,
    'weekly_target', en.weekly_target,
    'deadline', en.deadline,
    'vote_open', p_at < w.ends_at,
    'tally', case when p_type = 'DEBATE' then public.my_debate_tally(p_student, p_week, p_at) end,
    'ocr_consent', (select s.ai_ocr_consent_at is not null from students s where s.student_id = p_student),
    'week_completed', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.completed_at is not null),
    'title', w.title_en,
    'vocab', (select coalesce(jsonb_agg(jsonb_build_object('no', v.no, 'word', v.word, 'meaning', v.meaning) order by v.no), '[]'::jsonb)
              from vocab v where v.article_id = w.article_id),
    'assets', (select coalesce(jsonb_agg(jsonb_build_object('type', a.type, 'storage_key', a.storage_key, 'file_name', a.file_name)), '[]'::jsonb)
               from assets a
               where a.article_id = w.article_id and a.type in ('article_pdf', 'voca_pdf', 'voca_repeat_audio')
                 and a.version = (select max(a2.version) from assets a2 where a2.article_id = a.article_id and a2.type = a.type)),
    'draft', (select jsonb_build_object('activity_id', d.activity_id, 'media_key', d.media_key,
                'note', (select jsonb_build_object('title', n.title, 'body', n.body, 'stance', n.stance, 'reason', n.reason, 'ocr_left', 3 - n.ocr_count)
                         from activity_notes n where n.activity_id = d.activity_id))
              from d)
  )
  from en, w
$$;

revoke all on function public.my_debate_tally(text, int, timestamptz) from public, anon, authenticated;
grant execute on function public.my_debate_tally(text, int, timestamptz) to service_role;
