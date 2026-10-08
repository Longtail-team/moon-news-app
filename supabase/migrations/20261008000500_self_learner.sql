-- 결제자 본인 학습자 (2026-10-08 결정)
-- 보호자(결제자)가 직접 학습할 수 있다. 학습자로 한 번 더 등록하고 is_self = true. 한 가정에 1명까지.
-- 학년 대신 "성인", 출생 연월 없음, 자녀 본인 휴대폰 질문 없음(이미 결제자 번호), 동의 문구는 본인용.

alter table students add column is_self boolean not null default false;
create unique index students_one_self_per_guardian on students (guardian_id) where is_self;

drop function public.register_learner(uuid, uuid, text, text, date, text, text);

create function public.register_learner(
  p_guardian uuid, p_order uuid, p_existing text,
  p_name text, p_birth_ym date, p_grade text, p_instagram text,
  p_self boolean default false
) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_o orders%rowtype;
  v_student text;
  v_self boolean;
begin
  select * into v_o from orders where order_id = p_order and guardian_id = p_guardian for update;
  if v_o.order_id is null then raise exception 'order not found' using errcode = 'check_violation'; end if;
  if (select count(*) from enrollments where order_id = p_order) >= app.max_learners_per_order() then
    raise exception 'no seats left' using errcode = 'check_violation';
  end if;

  if p_existing is not null then
    select student_id into v_student from students where student_id = p_existing and guardian_id = p_guardian;
    if v_student is null then raise exception 'student not found' using errcode = 'check_violation'; end if;
    update students set instagram_id = coalesce(nullif(trim(p_instagram), ''), instagram_id) where student_id = v_student;
  elsif p_self then
    if exists (select 1 from students where guardian_id = p_guardian and is_self) then
      raise exception 'self already registered' using errcode = 'check_violation';
    end if;
    insert into students (guardian_id, name, birth_ym, instagram_id, is_self)
    values (p_guardian, coalesce(nullif(trim(p_name), ''), (select name from guardians where guardian_id = p_guardian)), null, nullif(trim(p_instagram), ''), true)
    returning student_id into v_student;
  else
    if nullif(trim(p_name), '') is null or p_birth_ym is null then raise exception 'name and birth required' using errcode = 'check_violation'; end if;
    insert into students (guardian_id, name, birth_ym, instagram_id)
    values (p_guardian, trim(p_name), date_trunc('month', p_birth_ym)::date, nullif(trim(p_instagram), ''))
    returning student_id into v_student;
  end if;

  select is_self into v_self from students where student_id = v_student;
  insert into enrollments (student_id, cohort_id, order_id, grade_at_enrollment, imweb_order_no, paid_at, paid_amount, coupon_code, source)
  values (v_student, v_o.cohort_id, v_o.order_id,
          case when v_self then '성인'
               else coalesce(nullif(trim(p_grade), ''), app.grade_label((select birth_ym from students where student_id = v_student))) end,
          v_o.imweb_order_no, v_o.paid_at, v_o.paid_amount, v_o.coupon_code, v_o.source);
  return v_student;
end
$$;

-- 본인은 자녀 본인 휴대폰 질문이 없다(번호를 넣을 수 없다)
create or replace function public.onboarding_access(p_guardian uuid, p_student text, p_own_phone text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_own_phone is not null and p_own_phone = (select phone from guardians where guardian_id = p_guardian) then
    raise exception 'same as guardian phone' using errcode = 'check_violation';
  end if;
  if p_own_phone is not null and exists (select 1 from students where student_id = p_student and is_self) then
    raise exception 'self has no own phone' using errcode = 'check_violation';
  end if;
  update students set own_phone = p_own_phone, consent_at = coalesce(consent_at, now())
  where student_id = p_student and guardian_id = p_guardian;
  if not found then raise exception 'student not found' using errcode = 'check_violation'; end if;
end
$$;

-- 첫 접속 상태에 본인 여부를 담는다
create or replace function public.onboarding_state(p_guardian uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with g as (select * from guardians where guardian_id = p_guardian),
  o as (
    select o.order_id, c.course_title, c.cohort_no, c.start_date, c.deadline, c.cohort_id,
      (select count(*) from enrollments e where e.order_id = o.order_id)::int as registered
    from orders o join cohorts c using (cohort_id)
    where o.guardian_id = p_guardian
  ),
  pending as (
    select s.student_id, s.name, e.grade_at_enrollment as grade, s.is_self
    from students s join enrollments e on e.student_id = s.student_id
    where s.guardian_id = p_guardian and e.order_id in (select order_id from o) and e.refunded_at is null and s.consent_at is null
  )
  select jsonb_build_object(
    'step', case
      when not exists (select 1 from o) then 'done'
      when (select alimtalk_agreed_at from g) is null then 'welcome'
      when exists (select 1 from o where registered = 0) then 'learners'
      when exists (select 1 from pending) then 'access'
      else 'done' end,
    'open_seats', coalesce((select app.max_learners_per_order() - o.registered from o order by o.start_date desc limit 1), 0),
    'has_self', exists (select 1 from students where guardian_id = p_guardian and is_self),
    'guardian', (select jsonb_build_object('name', g.name, 'phone', g.phone) from g),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
        'order_id', o.order_id, 'course_title', o.course_title, 'cohort_no', o.cohort_no,
        'start_date', o.start_date, 'deadline', o.deadline, 'registered', o.registered) order by o.start_date desc) from o), '[]'::jsonb),
    'returning', coalesce((select jsonb_agg(jsonb_build_object('student_id', s.student_id, 'name', s.name, 'birth_ym', s.birth_ym, 'instagram_id', s.instagram_id, 'is_self', s.is_self))
        from students s
        where s.guardian_id = p_guardian
          and not exists (select 1 from enrollments e where e.student_id = s.student_id and e.cohort_id in (select cohort_id from o))), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('student_id', p.student_id, 'name', p.name, 'grade', p.grade, 'is_self', p.is_self)) from pending p), '[]'::jsonb)
  )
$$;

revoke all on function public.register_learner(uuid, uuid, text, text, date, text, text, boolean) from public, anon, authenticated;
grant execute on function public.register_learner(uuid, uuid, text, text, date, text, text, boolean) to service_role;
