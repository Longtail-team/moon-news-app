-- T04 첫 접속 3단계와 다시 들어가기 (spec.md 11장 2026-10-08 접속 방식 결정)
-- 보호자 링크는 보호자(결제자)에 붙는다. 아임웹 주문 1건 = orders 1행, 수량 = 형제 수.

-- ───────── 주문 ─────────
create table orders (
  order_id uuid primary key default gen_random_uuid(),
  imweb_order_no text unique,
  guardian_id uuid not null references guardians on delete restrict,
  cohort_id uuid not null references cohorts on delete restrict,
  quantity int not null default 1 check (quantity between 1 and 10), -- 형제 수
  paid_at timestamptz,
  paid_amount int,
  coupon_code text,
  source text,
  created_at timestamptz not null default now()
);
create index orders_guardian_idx on orders (guardian_id);
alter table orders enable row level security;
revoke all on orders from anon, authenticated;

alter table enrollments add column order_id uuid references orders on delete restrict;
create index enrollments_order_idx on enrollments (order_id);

-- ───────── 보호자 링크는 보호자에 ─────────
alter table access_tokens add column guardian_id uuid references guardians on delete cascade;
alter table access_tokens alter column student_id drop not null;
update access_tokens t set guardian_id = s.guardian_id, student_id = null
from students s where t.student_id = s.student_id and t.holder = 'guardian';
alter table access_tokens add constraint access_tokens_holder_ck check (
  (holder = 'guardian' and guardian_id is not null and student_id is null)
  or (holder = 'child' and student_id is not null and guardian_id is null)
);
create index access_tokens_guardian_idx on access_tokens (guardian_id);

-- 학습자가 없을 때(결제 직후) 보내는 알림도 기록할 수 있게
alter table notifications alter column student_id drop not null;
alter table notifications add column guardian_id uuid references guardians on delete restrict;
alter table notifications add constraint notifications_target_ck check (student_id is not null or guardian_id is not null);
create index notifications_phone_idx on notifications (sent_to_phone, sent_at);

-- ───────── 학년 (출생 연월 → 학년, 3월 새 학년) ─────────
create function app.grade_label(p_birth date, p_at date default (now() at time zone 'Asia/Seoul')::date) returns text
language sql immutable as $$
  select case
    when g between 1 and 6 then '초' || g
    when g between 7 and 9 then '중' || (g - 6)
    when g between 10 and 12 then '고' || (g - 9)
  end
  from (select (extract(year from p_at)::int - case when extract(month from p_at) < 3 then 1 else 0 end)
               - extract(year from p_birth)::int - 6 as g) x
$$;

-- ───────── 보호자에게 남은 접속 이유가 있는지 ─────────
-- 환불하지 않은 자녀 수강이 있거나, 주문 수량 중 아직 등록하지 않은 자리가 있으면 보호자 링크를 살린다
create function app.guardian_active(p_guardian uuid) returns boolean
language sql stable as $$
  select exists (
      select 1 from enrollments e join students s on s.student_id = e.student_id
      where s.guardian_id = p_guardian and e.refunded_at is null)
    or exists (
      select 1 from orders o
      where o.guardian_id = p_guardian
        and o.quantity > (select count(*) from enrollments e where e.order_id = o.order_id))
$$;

-- 환불하면 접속 링크 폐기 (보호자 링크·자녀 링크 나눠서)
create or replace function app.revoke_tokens_on_refund() returns trigger
language plpgsql as $$
declare
  v_guardian uuid;
begin
  if new.refunded_at is not null and old.refunded_at is null then
    -- 자녀 링크: 이 학습자에게 환불하지 않은 다른 수강(재수강의 지난 기수 등)이 없으면 폐기
    if not exists (
      select 1 from enrollments e
      where e.student_id = new.student_id and e.enrollment_id <> new.enrollment_id and e.refunded_at is null)
    then
      update access_tokens set revoked_at = now()
      where student_id = new.student_id and holder = 'child' and revoked_at is null;
    end if;
    -- 보호자 링크: 다른 자녀 수강도, 등록 안 한 자리도 없으면 폐기
    select guardian_id into v_guardian from students where student_id = new.student_id;
    if not app.guardian_active(v_guardian) then
      update access_tokens set revoked_at = now()
      where guardian_id = v_guardian and holder = 'guardian' and revoked_at is null;
    end if;
  end if;
  return new;
end
$$;

-- 링크 유효기간: 마지막 기수 종강 후 3개월(보관 기간 끝) 한국 시간 자정까지
create function app.token_expiry(p_guardian uuid) returns timestamptz
language sql stable as $$
  select app.kst_day_end((max(c.deadline) + interval '3 months')::date)
  from cohorts c
  where c.cohort_id in (
    select o.cohort_id from orders o where o.guardian_id = p_guardian
    union
    select e.cohort_id from enrollments e join students s on s.student_id = e.student_id where s.guardian_id = p_guardian)
$$;

-- ───────── 세션 범위 (보호자 링크 = 보호자 기준) ─────────
-- 세션이 살아 있으면 최소 1행. 볼 수 있는 학습자가 없으면(결제 직후) student_id가 비어 있다.
create or replace function public.session_scope(p_session_hash text)
returns table (
  session_id uuid,
  holder text,
  guardian_id uuid,
  student_id text,
  student_name text,
  grade text
)
language sql stable security definer set search_path = public, pg_temp as $$
  with s as (
    select se.session_id, t.holder, t.student_id as token_student, coalesce(t.guardian_id, st.guardian_id) as guardian_id
    from sessions se
    join access_tokens t on t.token_id = se.token_id
    left join students st on st.student_id = t.student_id
    where se.session_hash = p_session_hash
      and se.revoked_at is null and se.expires_at > now()
      and t.revoked_at is null and (t.expires_at is null or t.expires_at > now())
  )
  select s.session_id, s.holder, s.guardian_id, l.student_id, l.name, l.grade
  from s
  left join lateral (
    select st.student_id, st.name,
      (select en.grade_at_enrollment from enrollments en join cohorts c using (cohort_id)
        where en.student_id = st.student_id and en.refunded_at is null
        order by c.start_date desc limit 1) as grade
    from students st
    where ((s.holder = 'guardian' and st.guardian_id = s.guardian_id) or (s.holder = 'child' and st.student_id = s.token_student))
      and exists (select 1 from enrollments en where en.student_id = st.student_id and en.refunded_at is null)
  ) l on true
  order by l.student_id
$$;

-- ───────── 주문 기록 (아임웹 결제 신호 / 시험용 스크립트) ─────────
create function public.record_order(
  p_imweb_order_no text, p_phone text, p_cohort uuid, p_quantity int,
  p_paid_at timestamptz default now(), p_paid_amount int default null, p_name text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_guardian uuid;
  v_order uuid;
begin
  insert into guardians (phone, name) values (p_phone, p_name)
  on conflict (phone) do update set name = coalesce(guardians.name, excluded.name)
  returning guardian_id into v_guardian;
  insert into orders (imweb_order_no, guardian_id, cohort_id, quantity, paid_at, paid_amount)
  values (p_imweb_order_no, v_guardian, p_cohort, p_quantity, p_paid_at, p_paid_amount)
  returning order_id into v_order;
  return jsonb_build_object('order_id', v_order, 'guardian_id', v_guardian);
end
$$;

-- ───────── 링크 발급 (원문은 서버가 만들고 해시만 받는다) ─────────
create function public.issue_token(p_holder text, p_guardian uuid, p_student text, p_phone text, p_token_hash text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_g uuid := coalesce(p_guardian, (select guardian_id from students where student_id = p_student));
  v_exp timestamptz := app.token_expiry(v_g);
  v_id uuid;
begin
  insert into access_tokens (holder, guardian_id, student_id, sent_to_phone, token_hash, expires_at)
  values (p_holder, case when p_holder = 'guardian' then p_guardian end, case when p_holder = 'child' then p_student end, p_phone, p_token_hash, v_exp)
  returning token_id into v_id;
  return jsonb_build_object('token_id', v_id, 'expires_at', v_exp);
end
$$;

-- ───────── 첫 접속 상태 ─────────
-- step: welcome(보호자 정보) → learners(학습자 등록) → access(접속 방법·동의) → done
-- 주문이 없는 보호자(예: 샘플)는 바로 done
create function public.onboarding_state(p_guardian uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with g as (select * from guardians where guardian_id = p_guardian),
  o as (
    select o.order_id, o.quantity, c.course_title, c.cohort_no, c.start_date, c.deadline, c.cohort_id,
      (select count(*) from enrollments e where e.order_id = o.order_id)::int as registered
    from orders o join cohorts c using (cohort_id)
    where o.guardian_id = p_guardian
  ),
  pending as (
    select s.student_id, s.name, e.grade_at_enrollment as grade
    from students s join enrollments e on e.student_id = s.student_id
    where s.guardian_id = p_guardian and e.order_id in (select order_id from o) and e.refunded_at is null and s.consent_at is null
  )
  select jsonb_build_object(
    'step', case
      when not exists (select 1 from o) then 'done'
      when (select alimtalk_agreed_at from g) is null then 'welcome'
      when exists (select 1 from o where registered < quantity) then 'learners'
      when exists (select 1 from pending) then 'access'
      else 'done' end,
    'guardian', (select jsonb_build_object('name', g.name, 'phone', g.phone) from g),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
        'order_id', o.order_id, 'course_title', o.course_title, 'cohort_no', o.cohort_no,
        'start_date', o.start_date, 'deadline', o.deadline, 'quantity', o.quantity, 'registered', o.registered) order by o.start_date desc) from o), '[]'::jsonb),
    -- 재수강: 이 보호자의 지난 학습자 중 아직 이번 주문 기수에 등록하지 않은 사람
    'returning', coalesce((select jsonb_agg(jsonb_build_object('student_id', s.student_id, 'name', s.name, 'birth_ym', s.birth_ym, 'instagram_id', s.instagram_id))
        from students s
        where s.guardian_id = p_guardian
          and not exists (select 1 from enrollments e where e.student_id = s.student_id and e.cohort_id in (select cohort_id from o))), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('student_id', p.student_id, 'name', p.name, 'grade', p.grade)) from pending p), '[]'::jsonb)
  )
$$;

-- 1단계: 보호자 이름, 알림톡 수신 동의
create function public.onboarding_welcome(p_guardian uuid, p_name text)
returns void
language sql security definer set search_path = public, pg_temp as $$
  update guardians set name = nullif(trim(p_name), ''), alimtalk_agreed_at = coalesce(alimtalk_agreed_at, now())
  where guardian_id = p_guardian
$$;

-- 2단계: 학습자 등록 (새 학습자 또는 지난 기수 학습자). 주문 수량을 넘을 수 없다.
create function public.register_learner(
  p_guardian uuid, p_order uuid, p_existing text,
  p_name text, p_birth_ym date, p_grade text, p_instagram text
) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_o orders%rowtype;
  v_student text;
begin
  select * into v_o from orders where order_id = p_order and guardian_id = p_guardian for update;
  if v_o.order_id is null then raise exception 'order not found' using errcode = 'check_violation'; end if;
  if (select count(*) from enrollments where order_id = p_order) >= v_o.quantity then
    raise exception 'no seats left' using errcode = 'check_violation';
  end if;

  if p_existing is not null then
    select student_id into v_student from students where student_id = p_existing and guardian_id = p_guardian;
    if v_student is null then raise exception 'student not found' using errcode = 'check_violation'; end if;
    update students set instagram_id = coalesce(nullif(trim(p_instagram), ''), instagram_id) where student_id = v_student;
  else
    if nullif(trim(p_name), '') is null or p_birth_ym is null then raise exception 'name and birth required' using errcode = 'check_violation'; end if;
    insert into students (guardian_id, name, birth_ym, instagram_id)
    values (p_guardian, trim(p_name), date_trunc('month', p_birth_ym)::date, nullif(trim(p_instagram), ''))
    returning student_id into v_student;
  end if;

  insert into enrollments (student_id, cohort_id, order_id, grade_at_enrollment, imweb_order_no, paid_at, paid_amount, coupon_code, source)
  values (v_student, v_o.cohort_id, v_o.order_id,
          coalesce(nullif(trim(p_grade), ''), app.grade_label((select birth_ym from students where student_id = v_student))),
          v_o.imweb_order_no, v_o.paid_at, v_o.paid_amount, v_o.coupon_code, v_o.source);
  return v_student;
end
$$;

-- 3단계: 접속 방법과 동의 (학습자마다)
create function public.onboarding_access(p_guardian uuid, p_student text, p_own_phone text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update students set own_phone = p_own_phone, consent_at = coalesce(consent_at, now())
  where student_id = p_student and guardian_id = p_guardian;
  if not found then raise exception 'student not found' using errcode = 'check_violation'; end if;
end
$$;

-- ───────── 다시 들어가기 ─────────
-- 번호로 링크를 받을 사람 찾기. 보호자 번호 우선, 아니면 자녀 본인 번호. 접속할 이유가 없으면 없음.
create function public.reentry_target(p_phone text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select jsonb_build_object('holder', 'guardian', 'guardian_id', g.guardian_id)
     from guardians g where g.phone = p_phone and app.guardian_active(g.guardian_id)),
    (select jsonb_build_object('holder', 'child', 'student_id', s.student_id)
     from students s
     where s.own_phone = p_phone
       and exists (select 1 from enrollments e where e.student_id = s.student_id and e.refunded_at is null)
     order by s.student_id limit 1)
  )
$$;

-- 같은 번호로 최근 1시간 안에 보낸 새 링크 수 (반복 요청 막기)
create function public.recent_link_requests(p_phone text)
returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from notifications
  where sent_to_phone = p_phone and template = 'new_link' and sent_at > now() - interval '1 hour'
$$;

revoke all on function
  public.record_order(text, text, uuid, int, timestamptz, int, text),
  public.issue_token(text, uuid, text, text, text),
  public.onboarding_state(uuid), public.onboarding_welcome(uuid, text),
  public.register_learner(uuid, uuid, text, text, date, text, text),
  public.onboarding_access(uuid, text, text),
  public.reentry_target(text), public.recent_link_requests(text)
  from public, anon, authenticated;
grant execute on function
  public.record_order(text, text, uuid, int, timestamptz, int, text),
  public.issue_token(text, uuid, text, text, text),
  public.onboarding_state(uuid), public.onboarding_welcome(uuid, text),
  public.register_learner(uuid, uuid, text, text, date, text, text),
  public.onboarding_access(uuid, text, text),
  public.reentry_target(text), public.recent_link_requests(text)
  to service_role;
grant execute on all functions in schema app to service_role;
