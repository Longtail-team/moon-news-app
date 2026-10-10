-- 찬반토론을 합친 기사 화면으로(T07 PR E, 2026-10-10 결정, T06 6장)
-- - 작성지 없이 투표(찬성 / 반대 / 잘 모르겠어요) + 이유 한 줄 = 학습 1회. 인스타는 토론 카드(개인 의견 없음) = 활동 파일(cards/)
-- - 낸 의견은 고치지 않는다(완료 뒤 저장 막힘은 기존 save_note 그대로)
-- - 친구 의견은 이름 없이 공개, 부적절한 글은 숨김(hidden_at, 거르기는 PR F). 숨긴 글도 쓴 본인에게는 보인다
-- - 마감(주차 끝) 뒤에도 결과·친구 의견은 계속 보인다. 마감 뒤에 낸 의견은 학습 1회로 인정하되 비율·친구 의견에는 넣지 않는다(after_close)
-- 기존 화면과 호환: 칸·선택지만 더하고, 비율 함수는 같은 칸(agree, disagree)에 unsure를 더한다

-- 입장에 "잘 모르겠어요"
alter table activity_notes drop constraint activity_notes_stance_check;
alter table activity_notes add constraint activity_notes_stance_check check (stance in ('agree', 'disagree', 'unsure'));
alter table activity_notes add column hidden_at timestamptz;   -- 부적절한 글 숨김(친구들에게만, PR F)
alter table activity_notes add column after_close boolean not null default false; -- 마감 뒤에 낸 의견(비율·친구 의견에서 뺌)

-- 기사별 토론 질문(콘텐츠 시트 연결은 질문을 받아 온 뒤 논의, 지금은 비어 있으면 "준비 중")
alter table articles add column debate_question text check (char_length(debate_question) <= 200);

-- 토론 카드도 찬반토론의 파일로(예전 작성지 사진도 그대로 인정)
create or replace function app.media_key_ok(p_type text, p_enrollment uuid, p_key text) returns boolean
language sql immutable as $$
  select p_key is not null and case
    when p_type in ('KR_READING', 'EN_READING') then p_key like 'recordings/' || p_enrollment || '/%'
    when p_type = 'SUMMARY' then p_key like 'photos/' || p_enrollment || '/%'
    when p_type = 'DEBATE' then p_key like 'photos/' || p_enrollment || '/%' or p_key like 'cards/' || p_enrollment || '/%'
    when p_type = 'VOCA' then p_key like 'recordings/' || p_enrollment || '/%' or p_key like 'photos/' || p_enrollment || '/%'
    when p_type = 'LISTENING' then p_key like 'cards/' || p_enrollment || '/%'
    else false
  end
$$;

-- 의견 저장: 잘 모르겠어요 허용, 마감 뒤에는 막지 않고 after_close로 표시
create or replace function public.save_note(p_student text, p_activity uuid, p_title text, p_body text, p_stance text, p_reason text, p_at timestamptz default now())
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
    insert into activity_notes (activity_id, stance, reason, after_close)
    values (p_activity, p_stance, case when p_stance is null then null else nullif(btrim(p_reason), '') end, p_at >= v_ends)
    on conflict (activity_id) do update set stance = excluded.stance, reason = excluded.reason, after_close = excluded.after_close, updated_at = now();
  else
    raise exception 'notes only for summary and debate' using errcode = 'check_violation';
  end if;
  return jsonb_build_object('activity_id', p_activity);
end
$$;

-- 찬반 비율: 그 기수·주차, 마감 전에 낸 의견, 학습자(수강)마다 마지막 1개. 잘 모르겠어요 포함
drop function app.debate_tally(uuid, int);
create function app.debate_tally(p_cohort uuid, p_week int)
returns table (agree int, disagree int, unsure int)
language sql stable as $$
  with last as (
    select distinct on (a.enrollment_id) n.stance
    from activities a
    join enrollments en on en.enrollment_id = a.enrollment_id and en.cohort_id = p_cohort and en.refunded_at is null
    join activity_notes n on n.activity_id = a.activity_id and not n.after_close
    where a.week_no = p_week and a.activity_type = 'DEBATE'
    order by a.enrollment_id, n.updated_at desc
  )
  select (count(*) filter (where stance = 'agree'))::int, (count(*) filter (where stance = 'disagree'))::int, (count(*) filter (where stance = 'unsure'))::int from last
$$;

-- 찬반토론 판(기사 화면): 질문, 마감 여부, 다른 친구들의 비율(나 빼고), 내 의견, 친구 의견(이름 없이, 숨긴 글·마감 뒤 글 빼고)
-- 비율·친구 의견은 화면에서 내가 고른 뒤 또는 마감 뒤에만 보여 준다
create function public.debate_board(p_student text, p_week int, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (select en.enrollment_id, en.cohort_id from enrollments en where en.enrollment_id = app.current_enrollment(p_student, p_at)),
  w as (
    select w.week_no, w.ends_at, ar.debate_question
    from en join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p_week and w.starts_at <= p_at
    join articles ar on ar.article_id = w.article_id and ar.status = 'published'
  ),
  last as (
    select distinct on (a.enrollment_id) a.enrollment_id, n.stance, n.reason, n.hidden_at, n.after_close, a.completed_at, n.updated_at
    from en join activities a on a.week_no = p_week and a.activity_type = 'DEBATE' and a.completed_at is not null
    join enrollments e2 on e2.enrollment_id = a.enrollment_id and e2.cohort_id = en.cohort_id and e2.refunded_at is null
    join activity_notes n on n.activity_id = a.activity_id and n.stance is not null
    order by a.enrollment_id, n.updated_at desc
  ),
  others as (select l.* from last l, en where l.enrollment_id <> en.enrollment_id and not l.after_close)
  select jsonb_build_object(
    'week_no', w.week_no,
    'cohort_no', (select c.cohort_no from en join cohorts c using (cohort_id)),
    'question', w.debate_question,
    'open', p_at < w.ends_at,
    'ends_at', w.ends_at,
    'counts', jsonb_build_object(
      'agree', (select count(*) from others where stance = 'agree'),
      'disagree', (select count(*) from others where stance = 'disagree'),
      'unsure', (select count(*) from others where stance = 'unsure')),
    'mine', (select jsonb_build_object('stance', l.stance, 'reason', l.reason, 'at', l.completed_at, 'counted', not l.after_close)
             from last l, en where l.enrollment_id = en.enrollment_id),
    'opinions', coalesce((select jsonb_agg(jsonb_build_object('stance', o.stance, 'reason', o.reason, 'at', o.completed_at) order by o.completed_at desc)
                          from others o where o.reason is not null and o.hidden_at is null), '[]'::jsonb)
  )
  from w
$$;

revoke all on function public.debate_board(text, int, timestamptz) from public, anon, authenticated;
grant execute on function public.debate_board(text, int, timestamptz) to service_role;
