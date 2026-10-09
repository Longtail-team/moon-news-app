-- 청독 카드 두 가지 스타일 (2026-10-09): 앱 화면·뉴스북용(제목 68/58px)은 서버에 보관, 인스타용(제목 100px)은 저장할 때 휴대폰에서 같은 값으로 다시 그린다
-- → 카드 날짜를 기억하고, 인스타 올리기 목록에 카드 값을 싣는다

alter table listening_cards add column card_date date;
update listening_cards lc set card_date = (a.completed_at at time zone 'Asia/Seoul')::date from activities a where a.activity_id = lc.activity_id and lc.card_date is null;

create or replace function public.start_listening(p_student text, p_week int, p_plays jsonb, p_session_seconds int, p_at timestamptz default now())
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
  insert into listening_cards (activity_id, plays, session_seconds, total_seconds, card_date)
  values (v_id, p_plays, greatest(p_session_seconds, 0), v_total, (p_at at time zone 'Asia/Seoul')::date)
  on conflict (activity_id) do update set plays = excluded.plays, session_seconds = excluded.session_seconds, total_seconds = excluded.total_seconds,
    card_date = excluded.card_date, updated_at = now();
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
        -- 청독: 인스타용 카드를 휴대폰에서 다시 그릴 값
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
