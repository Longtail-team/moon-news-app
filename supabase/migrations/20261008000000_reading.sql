-- 활동 선택과 낭독 (spec.md 6·8장)
-- 모두 서버(service_role)만 부른다. p_student는 서버가 세션에서 확인한 학습자다.

-- ───────── 파일 저장소: 비공개 버킷 ─────────
-- 녹음·작성지 사진. 짧은 유효시간 주소로만 주고받는다(spec 16장).
-- (테스트용 PGlite에는 storage 스키마가 없어 있을 때만 만든다)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('media', 'media', false, 20 * 1024 * 1024, array['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/aac', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
    on conflict (id) do nothing;
    -- 학습 자료(음원·PDF·인스타 템플릿). 자료 반영(동기화) 때 채운다
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('course', 'course', false, 100 * 1024 * 1024)
    on conflict (id) do nothing;
  end if;
end
$$;

-- 학습자의 지금 수강 (환불하지 않은 가장 최근 기수)
create function app.current_enrollment(p_student text) returns uuid
language sql stable as $$
  select en.enrollment_id
  from enrollments en join cohorts c using (cohort_id)
  where en.student_id = p_student and en.refunded_at is null
  order by c.start_date desc
  limit 1
$$;

-- ───────── 활동 선택 화면 ─────────
-- 시작된 주차만, 최근 주차부터. 주차별 학습 완료 수, 활동별 횟수, 작성 중(시작했지만 완료 안 함) 활동
create function public.activity_picker(p_student text, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, c.weekly_target
    from enrollments en join cohorts c using (cohort_id)
    where en.enrollment_id = app.current_enrollment(p_student)
  )
  select jsonb_build_object(
    'weekly_target', en.weekly_target,
    'current_week', (select w.week_no from cohort_weeks w where w.cohort_id = en.cohort_id and p_at >= w.starts_at and p_at < w.ends_at),
    'weeks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'week_no', w.week_no,
        'title', (select ar.title_en from articles ar where ar.article_id = w.article_id and ar.status = 'published'),
        'completed', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.completed_at is not null),
        'counts', (select coalesce(jsonb_object_agg(t.activity_type, t.n), '{}'::jsonb) from (
            select a.activity_type, count(*) as n from activities a
            where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.completed_at is not null
            group by a.activity_type) t),
        'in_progress', (select coalesce(jsonb_agg(distinct a.activity_type), '[]'::jsonb) from activities a
            where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.completed_at is null)
      ) order by w.week_no desc)
      from cohort_weeks w
      where w.cohort_id = en.cohort_id and w.starts_at <= p_at
    ), '[]'::jsonb)
  )
  from en
$$;

-- ───────── 낭독 화면 자료 ─────────
-- 시작된 주차의 공개 기사만. 문장(끊어 읽기 포함)과 음원 파일 정보
create function public.reading_material(p_student text, p_week int, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, c.weekly_target
    from enrollments en join cohorts c using (cohort_id)
    where en.enrollment_id = app.current_enrollment(p_student)
  ),
  w as (
    select w.week_no, ar.article_id, ar.title_en, ar.word_count
    from en
    join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p_week and w.starts_at <= p_at
    join articles ar on ar.article_id = w.article_id and ar.status = 'published'
  )
  select jsonb_build_object(
    'week_no', w.week_no,
    'weekly_target', en.weekly_target,
    'week_completed', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.completed_at is not null),
    'title', w.title_en,
    'word_count', w.word_count,
    'sentences', (select jsonb_agg(jsonb_build_object('para_no', s.para_no, 'sent_no', s.sent_no, 'en', s.en, 'ko', s.ko) order by s.sent_no)
                  from sentences s where s.article_id = w.article_id),
    'assets', (select coalesce(jsonb_agg(jsonb_build_object('type', a.type, 'storage_key', a.storage_key, 'timing_key', a.timing_key)), '[]'::jsonb)
               from assets a
               where a.article_id = w.article_id and a.type in ('article_audio', 'kr_en_repeat_audio')
                 and a.version = (select max(a2.version) from assets a2 where a2.article_id = a.article_id and a2.type = a.type))
  )
  from en, w
$$;

-- ───────── 낭독 시작 ─────────
-- 같은 주차·같은 활동의 작성 중(완료 전) 기록이 있으면 이어서 쓴다. 없으면 새로 만든다.
create function public.start_activity(p_student text, p_week int, p_type text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_en uuid := app.current_enrollment(p_student);
  v_id uuid;
begin
  if v_en is null then
    raise exception 'no active enrollment' using errcode = 'check_violation';
  end if;
  select a.activity_id into v_id from activities a
  where a.enrollment_id = v_en and a.week_no = p_week and a.activity_type = p_type and a.completed_at is null
  order by a.started_at desc limit 1;
  if v_id is null then
    insert into activities (enrollment_id, week_no, activity_type, state)
    values (v_en, p_week, p_type, 'STARTED')
    returning activity_id into v_id;
  end if;
  return jsonb_build_object('activity_id', v_id, 'enrollment_id', v_en);
end
$$;

-- ───────── 낭독 완료 (이대로 완료) ─────────
-- 녹음 파일 키를 남기고 학습 완료로 바꾼다. 첫 영어 낭독이면 first_en = true (spec 9장 팝업)
create function public.complete_reading(p_student text, p_activity uuid, p_media_key text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_en uuid := app.current_enrollment(p_student);
  v_act activities%rowtype;
  v_first boolean;
begin
  select * into v_act from activities where activity_id = p_activity and enrollment_id = v_en for update;
  if v_act.activity_id is null then
    raise exception 'activity not found for this learner' using errcode = 'check_violation';
  end if;
  if v_act.activity_type not in ('KR_READING', 'EN_READING') then
    raise exception 'not a reading activity' using errcode = 'check_violation';
  end if;
  if v_act.completed_at is not null then
    raise exception 'already completed' using errcode = 'check_violation';
  end if;
  if p_media_key is null or p_media_key not like 'recordings/' || v_en || '/%' then
    raise exception 'invalid media key' using errcode = 'check_violation';
  end if;

  select not exists (
    select 1 from activities a where a.enrollment_id = v_en and a.activity_type = 'EN_READING' and a.completed_at is not null
  ) and v_act.activity_type = 'EN_READING' into v_first;

  update activities set state = 'COMPLETED', completed_at = now(), media_key = p_media_key
  where activity_id = p_activity;

  return jsonb_build_object(
    'week_no', v_act.week_no,
    'week_completed', (select count(*) from activities a where a.enrollment_id = v_en and a.week_no = v_act.week_no and a.completed_at is not null),
    'first_en', v_first
  );
end
$$;

-- 업로드 주소를 만들기 전에 활동이 이 학습자 것인지 확인
create function public.activity_owner(p_student text, p_activity uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('activity_id', a.activity_id, 'enrollment_id', a.enrollment_id, 'activity_type', a.activity_type, 'completed', a.completed_at is not null)
  from activities a
  where a.activity_id = p_activity and a.enrollment_id = app.current_enrollment(p_student)
$$;

revoke all on function public.activity_picker(text, timestamptz), public.reading_material(text, int, timestamptz),
  public.start_activity(text, int, text), public.complete_reading(text, uuid, text), public.activity_owner(text, uuid)
  from public, anon, authenticated;
grant execute on function public.activity_picker(text, timestamptz), public.reading_material(text, int, timestamptz),
  public.start_activity(text, int, text), public.complete_reading(text, uuid, text), public.activity_owner(text, uuid)
  to service_role;
grant execute on function app.current_enrollment(text) to service_role;
