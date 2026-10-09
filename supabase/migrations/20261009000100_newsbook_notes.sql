-- 기자수첩과 의견·찬반 투표 (뉴스북 구성안 2026-10-09, 결정은 docs/spec.md 6장)
-- 기사 요약: 내가 붙인 제목 + 요약 텍스트(사진 글자 인식 후 학생이 확인한 최종본). 선택 입력
-- 찬반토론: 내 입장(찬성/반대) + 이유 한 문장. 선택 입력, 그 주차 일요일 자정(주차 끝)까지만. 마감 뒤에는 저장하지 않는다
-- 찬반 비율 = 그 기수·주차에서 마감 전에 학습 완료한 찬반토론의 입장, 학습자마다 마지막 1개
-- 보관: 사진과 같이 종강 후 3개월에 지운다(삭제 작업은 사진 삭제와 함께 만든다)

create table activity_notes (
  activity_id uuid primary key references activities on delete cascade,
  title text check (char_length(title) <= 60),
  body text check (char_length(body) <= 2000),
  stance text check (stance in ('agree', 'disagree')),
  reason text check (char_length(reason) <= 300),
  ocr_count int not null default 0 check (ocr_count between 0 and 3), -- 사진 글자 읽기 횟수(비용 상한)
  updated_at timestamptz not null default now(),
  check (reason is null or stance is not null)
);
alter table activity_notes enable row level security;
revoke all on activity_notes from anon, authenticated;

-- 기록 저장: 지금 수강의 완료 전 활동만. 요약은 제목·요약, 찬반토론은 입장·이유. 빈 값은 비움
create function public.save_note(p_student text, p_activity uuid, p_title text, p_body text, p_stance text, p_reason text, p_at timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_act activities%rowtype;
  v_ends timestamptz;
begin
  select a.* into v_act from activities a
  where a.activity_id = p_activity and a.enrollment_id = app.current_enrollment(p_student, p_at);
  if v_act.activity_id is null then raise exception 'activity not found for this learner' using errcode = 'check_violation'; end if;
  if v_act.completed_at is not null then raise exception 'already completed' using errcode = 'check_violation'; end if;

  if v_act.activity_type = 'SUMMARY' then
    insert into activity_notes (activity_id, title, body)
    values (p_activity, nullif(btrim(p_title), ''), nullif(btrim(p_body), ''))
    on conflict (activity_id) do update set title = excluded.title, body = excluded.body, updated_at = now();
  elsif v_act.activity_type = 'DEBATE' then
    select w.ends_at into v_ends from cohort_weeks w join enrollments en on en.cohort_id = w.cohort_id
    where en.enrollment_id = v_act.enrollment_id and w.week_no = v_act.week_no;
    if p_at >= v_ends then raise exception 'vote closed' using errcode = 'check_violation'; end if;
    insert into activity_notes (activity_id, stance, reason)
    values (p_activity, p_stance, case when p_stance is null then null else nullif(btrim(p_reason), '') end)
    on conflict (activity_id) do update set stance = excluded.stance, reason = excluded.reason, updated_at = now();
  else
    raise exception 'notes only for summary and debate' using errcode = 'check_violation';
  end if;
  return jsonb_build_object('activity_id', p_activity);
end
$$;

-- 사진 글자 읽기 1회: 지금 수강의 완료 전 기사 요약 사진이고 3회 미만이면 횟수를 올리고 사진 키를 준다
create function public.ocr_take(p_student text, p_activity uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_key text;
  v_n int;
begin
  select a.media_key into v_key from activities a
  where a.activity_id = p_activity and a.enrollment_id = app.current_enrollment(p_student)
    and a.activity_type = 'SUMMARY' and a.completed_at is null and a.media_key like 'photos/%';
  if v_key is null then return null; end if;
  insert into activity_notes (activity_id, ocr_count) values (p_activity, 1)
  on conflict (activity_id) do update set ocr_count = activity_notes.ocr_count + 1, updated_at = now()
    where activity_notes.ocr_count < 3
  returning ocr_count into v_n;
  if v_n is null then raise exception 'ocr limit' using errcode = 'check_violation'; end if;
  return v_key;
end
$$;

-- 찬반 비율: 그 기수·주차, 마감(주차 끝) 전에 학습 완료한 찬반토론, 학습자(수강)마다 마지막 입장 1개
create function app.debate_tally(p_cohort uuid, p_week int)
returns table (agree int, disagree int)
language sql stable as $$
  with w as (select ends_at from cohort_weeks where cohort_id = p_cohort and week_no = p_week),
  last as (
    select distinct on (a.enrollment_id) n.stance
    from activities a
    join enrollments en on en.enrollment_id = a.enrollment_id and en.cohort_id = p_cohort and en.refunded_at is null
    join activity_notes n on n.activity_id = a.activity_id and n.stance is not null
    where a.week_no = p_week and a.activity_type = 'DEBATE' and a.completed_at < (select ends_at from w)
    order by a.enrollment_id, a.completed_at desc
  )
  select (count(*) filter (where stance = 'agree'))::int, (count(*) filter (where stance = 'disagree'))::int from last
$$;

-- 작성 활동 자료에 의견 마감 시각과 작성 중 기록의 메모를 더한다
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

revoke all on function public.save_note(text, uuid, text, text, text, text, timestamptz), public.ocr_take(text, uuid) from public, anon, authenticated;
grant execute on function public.save_note(text, uuid, text, text, text, text, timestamptz), public.ocr_take(text, uuid) to service_role;
