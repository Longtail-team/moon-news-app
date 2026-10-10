-- 활동 평가(T07 PR D, 2026-10-10 결정)
-- 청독 이해도 5단계(listen_understanding 1~5): 같은 주차 기사 첫 청독은 필수, 다시 청독은 선택
-- 토론 주제 반응 4가지(debate_feel 1~4): 찬반토론(PR E)
-- 학생 화면에는 점수를 보여 주지 않는다. 운영 데이터(운영 시트·관리자 대시보드)로만 쓴다.
create table activity_ratings (
  activity_id uuid primary key references activities on delete cascade,
  enrollment_id uuid not null references enrollments on delete restrict,
  week_no int not null,
  kind text not null check (kind in ('listen_understanding', 'debate_feel')),
  value int not null,
  is_first boolean not null, -- 그 주차·그 종류의 첫 평가인지(같은 기사 첫 청독)
  created_at timestamptz not null default now(),
  check ((kind = 'listen_understanding' and value between 1 and 5) or (kind = 'debate_feel' and value between 1 and 4))
);
create index activity_ratings_enrollment_idx on activity_ratings (enrollment_id, week_no, kind);
alter table activity_ratings enable row level security;
revoke all on activity_ratings from anon, authenticated;

-- 이 주차에 아직 평가가 없으면 true(= 이번 평가는 필수)
create function public.rating_needed(p_student text, p_week int, p_kind text, p_at timestamptz default now())
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select not exists (
    select 1 from activity_ratings r
    where r.enrollment_id = app.current_enrollment(p_student, p_at) and r.week_no = p_week and r.kind = p_kind
  )
$$;

-- 평가 남기기: 내 활동, 종류가 활동에 맞을 때만(청독 = 이해도, 찬반토론 = 반응). 한 활동에 한 번(다시 누르면 고침)
create function public.rate_activity(p_student text, p_activity uuid, p_kind text, p_value int)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_en uuid := app.current_enrollment(p_student);
  v_act activities%rowtype;
  v_first boolean;
begin
  select * into v_act from activities where activity_id = p_activity and enrollment_id = v_en;
  if v_act.activity_id is null then raise exception 'activity not found for this learner' using errcode = 'check_violation'; end if;
  if not ((p_kind = 'listen_understanding' and v_act.activity_type = 'LISTENING') or (p_kind = 'debate_feel' and v_act.activity_type = 'DEBATE')) then
    raise exception 'rating kind does not match activity' using errcode = 'check_violation';
  end if;
  select not exists (
    select 1 from activity_ratings r where r.enrollment_id = v_en and r.week_no = v_act.week_no and r.kind = p_kind and r.activity_id <> p_activity
  ) into v_first;
  insert into activity_ratings (activity_id, enrollment_id, week_no, kind, value, is_first)
  values (p_activity, v_en, v_act.week_no, p_kind, p_value, v_first)
  on conflict (activity_id) do update set value = excluded.value, created_at = now();
  return jsonb_build_object('activity_id', p_activity, 'is_first', v_first);
end
$$;

revoke all on function public.rating_needed(text, int, text, timestamptz), public.rate_activity(text, uuid, text, int) from public, anon, authenticated;
grant execute on function public.rating_needed(text, int, text, timestamptz), public.rate_activity(text, uuid, text, int) to service_role;
