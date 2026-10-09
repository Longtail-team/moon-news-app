-- 작성지 사진 글자 읽기(외부 AI)는 보호자가 따로 동의한 학습자만 (2026-10-09)
-- 첫 접속 3단계의 선택 동의 상자. 동의하지 않으면 글자 읽기를 쓰지 않고 요약은 직접 입력한다(학습에는 영향 없음).
alter table students add column ai_ocr_consent_at timestamptz;

-- 동의 저장·철회: 그 보호자의 학습자만
create function public.set_ai_consent(p_guardian uuid, p_student text, p_on boolean)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update students set ai_ocr_consent_at = case when p_on then coalesce(ai_ocr_consent_at, now()) end
  where student_id = p_student and guardian_id = p_guardian;
  if not found then raise exception 'student not found' using errcode = 'check_violation'; end if;
end
$$;

-- 글자 읽기 전에 동의를 확인한다
create or replace function public.ocr_take(p_student text, p_activity uuid)
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
  if not exists (select 1 from students where student_id = p_student and ai_ocr_consent_at is not null) then
    raise exception 'no ai consent' using errcode = 'check_violation';
  end if;
  insert into activity_notes (activity_id, ocr_count) values (p_activity, 1)
  on conflict (activity_id) do update set ocr_count = activity_notes.ocr_count + 1, updated_at = now()
    where activity_notes.ocr_count < 3
  returning ocr_count into v_n;
  if v_n is null then raise exception 'ocr limit' using errcode = 'check_violation'; end if;
  return v_key;
end
$$;

-- 작성 화면에 동의 여부를 싣는다
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
    'ocr_consent', (select s.ai_ocr_consent_at is not null from students s where s.student_id = p_student),
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

revoke all on function public.set_ai_consent(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.set_ai_consent(uuid, text, boolean) to service_role;
