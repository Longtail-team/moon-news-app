-- 형제 인원은 결제 시점이 아니라 자녀 정보를 등록할 때 정해진다 (2026-10-08 결정)
-- 주문 1건(결제자 1명)에 학습자 최대 4명. orders.quantity는 아임웹 기록으로만 남기고 등록 제한에 쓰지 않는다.

create function app.max_learners_per_order() returns int language sql immutable as $$ select 4 $$;

-- 보호자에게 남은 접속 이유: 환불하지 않은 자녀 수강이 있거나, 아직 아무도 등록하지 않은 주문이 있다
create or replace function app.guardian_active(p_guardian uuid) returns boolean
language sql stable as $$
  select exists (
      select 1 from enrollments e join students s on s.student_id = e.student_id
      where s.guardian_id = p_guardian and e.refunded_at is null)
    or exists (
      select 1 from orders o
      where o.guardian_id = p_guardian
        and not exists (select 1 from enrollments e where e.order_id = o.order_id))
$$;

create or replace function public.register_learner(
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
  if (select count(*) from enrollments where order_id = p_order) >= app.max_learners_per_order() then
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

-- open_seats = 가장 최근 주문에 더 등록할 수 있는 인원(최대 4명 기준)
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
    select s.student_id, s.name, e.grade_at_enrollment as grade
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
    'guardian', (select jsonb_build_object('name', g.name, 'phone', g.phone) from g),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
        'order_id', o.order_id, 'course_title', o.course_title, 'cohort_no', o.cohort_no,
        'start_date', o.start_date, 'deadline', o.deadline, 'registered', o.registered) order by o.start_date desc) from o), '[]'::jsonb),
    'returning', coalesce((select jsonb_agg(jsonb_build_object('student_id', s.student_id, 'name', s.name, 'birth_ym', s.birth_ym, 'instagram_id', s.instagram_id))
        from students s
        where s.guardian_id = p_guardian
          and not exists (select 1 from enrollments e where e.student_id = s.student_id and e.cohort_id in (select cohort_id from o))), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('student_id', p.student_id, 'name', p.name, 'grade', p.grade)) from pending p), '[]'::jsonb)
  )
$$;

grant execute on function app.max_learners_per_order() to service_role;
