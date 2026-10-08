-- T04 실기기 피드백 반영 (2026-10-08)
-- 1) 주문 수량보다 적게 등록해도 진행: 주문마다 1명 이상 등록하면 다음 단계로. 남은 자리는 나중에 "학습자 추가"
-- 2) 자녀 본인 번호에 보호자 번호를 넣을 수 없다(보호자 휴대폰으로 하면 "아니요")

create or replace function public.onboarding_state(p_guardian uuid)
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
      when exists (select 1 from o where registered = 0) then 'learners'
      when exists (select 1 from pending) then 'access'
      else 'done' end,
    'open_seats', coalesce((select sum(quantity - registered) from o where registered < quantity), 0)::int,
    'guardian', (select jsonb_build_object('name', g.name, 'phone', g.phone) from g),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
        'order_id', o.order_id, 'course_title', o.course_title, 'cohort_no', o.cohort_no,
        'start_date', o.start_date, 'deadline', o.deadline, 'quantity', o.quantity, 'registered', o.registered) order by o.start_date desc) from o), '[]'::jsonb),
    'returning', coalesce((select jsonb_agg(jsonb_build_object('student_id', s.student_id, 'name', s.name, 'birth_ym', s.birth_ym, 'instagram_id', s.instagram_id))
        from students s
        where s.guardian_id = p_guardian
          and not exists (select 1 from enrollments e where e.student_id = s.student_id and e.cohort_id in (select cohort_id from o))), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('student_id', p.student_id, 'name', p.name, 'grade', p.grade)) from pending p), '[]'::jsonb)
  )
$$;

create or replace function public.onboarding_access(p_guardian uuid, p_student text, p_own_phone text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_own_phone is not null and p_own_phone = (select phone from guardians where guardian_id = p_guardian) then
    raise exception 'same as guardian phone' using errcode = 'check_violation';
  end if;
  update students set own_phone = p_own_phone, consent_at = coalesce(consent_at, now())
  where student_id = p_student and guardian_id = p_guardian;
  if not found then raise exception 'student not found' using errcode = 'check_violation'; end if;
end
$$;
