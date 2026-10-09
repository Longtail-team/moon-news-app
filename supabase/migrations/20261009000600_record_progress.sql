-- 내 기록의 "이번 기수 기록"을 완주 화면 모양으로 (2026-10-09): 인스타 올리기 N / 60, 활동별 횟수, 소리 내어 읽은 영어 단어 수
-- (20261009000500_newsbook.sql의 newsbook과 같고 stats에 completed·verified·acts·reading_words, cohort에 total_target을 더함)
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
      'reading_words', coalesce((select sum(ar.word_count) from activities a
                                 join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = a.week_no
                                 join articles ar on ar.article_id = w.article_id
                                 where a.enrollment_id = en.enrollment_id and a.activity_type = 'EN_READING' and a.completed_at is not null), 0)),
    'weeks', coalesce((select jsonb_agg(jsonb_build_object(
        'week_no', wk.week_no, 'starts_at', wk.starts_at, 'title_en', wk.title_en, 'title_ko', wk.title_ko,
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
