-- 뉴스북 활동 카드·기사 요약·VOCA 카드(T07 PR G, 2026-10-10 결정)
-- - 뉴스북 주차 쪽에 활동 카드를 모두(청독·읽기 완료·기사 요약·VOCA·토론)
-- - 인스타에는 활동 카드 한 장(기사 요약·VOCA도 작성지 사진 대신 카드). 낭독은 카드 + 녹음 영상(2단계)
-- - 찬반 결과에 잘 모르겠어요
-- 기존 화면과 호환(함수 결과에 칸을 더함)

-- 활동 카드 그림 키: card_key, 없으면 카드인 활동 파일(청독·토론). 학습자 본인의 수강(환불 제외)만
create function public.activity_card(p_student text, p_activity uuid)
returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(a.card_key, case when a.media_key like 'cards/%' then a.media_key end)
  from activities a
  join enrollments en on en.enrollment_id = a.enrollment_id and en.student_id = p_student and en.refunded_at is null
  where a.activity_id = p_activity
$$;

-- 기사 요약·VOCA 카드 머리글 값(지금 수강의 내 활동): 기수·이름·날짜·기사 제목, VOCA는 이번 주 단어와 지금까지 익힌 단어 수(이번 주 포함)
create function public.card_head(p_student text, p_activity uuid, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with a as (
    select a.*, en.cohort_id from activities a join enrollments en using (enrollment_id)
    where a.activity_id = p_activity and a.enrollment_id = app.current_enrollment(p_student, p_at)
      and a.activity_type in ('SUMMARY', 'VOCA')
  ),
  art as (
    select w.week_no, ar.article_id, ar.title_en from a
    join cohort_weeks w on w.cohort_id = a.cohort_id and w.week_no = a.week_no
    left join articles ar on ar.article_id = w.article_id and ar.status = 'published'
  )
  select jsonb_build_object(
    'activity_id', a.activity_id,
    'type', a.activity_type,
    'week_no', a.week_no,
    'cohort_no', c.cohort_no,
    'name', s.name,
    'date', (coalesce(a.completed_at, p_at) at time zone 'Asia/Seoul')::date,
    'title', (select title_en from art),
    'vocab', case when a.activity_type = 'VOCA' then
      (select coalesce(jsonb_agg(v.word order by v.no), '[]'::jsonb) from vocab v where v.article_id = (select article_id from art)) end,
    'vocab_total', case when a.activity_type = 'VOCA' then
      (select count(*) from vocab v join cohort_weeks w on w.article_id = v.article_id and w.cohort_id = a.cohort_id
       where w.week_no in (select x.week_no from activities x where x.enrollment_id = a.enrollment_id and x.activity_type = 'VOCA'
                           and (x.completed_at is not null or x.activity_id = a.activity_id))) end
  )
  from a join cohorts c on c.cohort_id = a.cohort_id
  join enrollments en on en.enrollment_id = a.enrollment_id
  join students s on s.student_id = en.student_id
$$;

-- 인스타 올리기: 카드가 있으면 카드를 저장(청독·토론·기사 요약·VOCA). 낭독은 카드 + 녹음 영상(2단계)이라 그대로 영상
-- (가장 최근 정의 20261009000900_listening_card_styles.sql에 card_key와 종류 규칙을 더함)
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
        'completed_at', a.completed_at, 'media_key', a.media_key, 'card_key', a.card_key,
        'kind', case when a.activity_type in ('KR_READING', 'EN_READING') then 'video'
                     when a.card_key is not null or a.media_key like 'photos/%' or a.media_key like 'cards/%' then 'photo'
                     else 'video' end,
        -- 청독: 인스타용 카드를 휴대폰에서 다시 그릴 값(20261009000900과 같음)
        'card', case when a.activity_type = 'LISTENING' then (
          select jsonb_build_object('activity_id', a.activity_id, 'week_no', a.week_no, 'title', ar.title_en,
            'cohort_no', c.cohort_no, 'name', s.name, 'date', lc.card_date,
            'plays', lc.plays, 'session_seconds', lc.session_seconds, 'total_seconds', lc.total_seconds)
          from listening_cards lc
          join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = a.week_no
          join cohorts c on c.cohort_id = en.cohort_id
          join enrollments e2 on e2.enrollment_id = en.enrollment_id
          join students s on s.student_id = e2.student_id
          left join articles ar on ar.article_id = w.article_id
          where lc.activity_id = a.activity_id) end,
        'template_key', (select s.storage_key from cohort_weeks w join assets s on s.article_id = w.article_id and s.type = 'insta_template'
                         where w.cohort_id = en.cohort_id and w.week_no = a.week_no order by s.version desc limit 1)
      ) order by a.completed_at)
      from activities a
      where a.enrollment_id = en.enrollment_id and a.completed_at is not null and a.verified_at is null
    ), '[]'::jsonb)
  )
  from en
$$;

-- 뉴스북: 주차마다 활동 카드 모두(완료 순), 찬반 결과에 잘 모르겠어요
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
    select a.week_no, a.activity_id, a.activity_type, a.completed_at from en
    join activities a on a.enrollment_id = en.enrollment_id and a.completed_at is not null
      and (a.card_key is not null or a.media_key like 'cards/%')
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
        'cards', coalesce((select jsonb_agg(jsonb_build_object('activity_id', c.activity_id, 'type', c.activity_type) order by c.completed_at) from cards c where c.week_no = wk.week_no), '[]'::jsonb),
        'summary', (select jsonb_build_object('activity_id', s.activity_id, 'title', s.title, 'body', s.body, 'has_photo', s.has_photo) from summary s where s.week_no = wk.week_no),
        'opinion', (select jsonb_build_object('stance', o.stance, 'reason', o.reason) from opinion o where o.week_no = wk.week_no),
        'tally', (select jsonb_build_object('agree', t.agree, 'disagree', t.disagree, 'unsure', t.unsure, 'final', p_at >= wk.ends_at)
                  from opinion o, app.debate_tally(en.cohort_id, wk.week_no) t where o.week_no = wk.week_no)
      ) order by wk.week_no) from wk), '[]'::jsonb),
    'others', coalesce((select jsonb_agg(jsonb_build_object('enrollment_id', e2.enrollment_id, 'course_title', c2.course_title, 'cohort_no', c2.cohort_no, 'deadline', c2.deadline) order by c2.start_date desc)
                        from enrollments e2 join cohorts c2 using (cohort_id)
                        where e2.student_id = p_student and e2.refunded_at is null and e2.enrollment_id <> en.enrollment_id), '[]'::jsonb)
  )
  from en
$$;

revoke all on function public.activity_card(text, uuid), public.card_head(text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.activity_card(text, uuid), public.card_head(text, uuid, timestamptz) to service_role;
