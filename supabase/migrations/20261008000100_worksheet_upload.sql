-- 작성 활동(작성지 사진·VOCA 낭독)과 인스타 올리기 (spec.md 6·8장)
-- 모두 서버(service_role)만 부른다. p_student는 서버가 세션에서 확인한 학습자다.

-- 인스타 게시물은 학습 1회에 1개다(spec 6장). 같은 게시물 링크로 두 번 인증할 수 없다.
create unique index activities_post_url_unique on activities (post_url) where post_url is not null;

-- 파일 키 규칙: 녹음 recordings/<수강>/..., 사진 photos/<수강>/...
-- 한국어·영어 낭독 = 녹음만, 요약·토론 = 사진만, VOCA = 녹음 또는 사진 (spec 6장 완료 기준)
create function app.media_key_ok(p_type text, p_enrollment uuid, p_key text) returns boolean
language sql immutable as $$
  select p_key is not null and case
    when p_type in ('KR_READING', 'EN_READING') then p_key like 'recordings/' || p_enrollment || '/%'
    when p_type in ('SUMMARY', 'DEBATE') then p_key like 'photos/' || p_enrollment || '/%'
    when p_type = 'VOCA' then p_key like 'recordings/' || p_enrollment || '/%' or p_key like 'photos/' || p_enrollment || '/%'
    else false
  end
$$;

-- ───────── 파일 붙이기 (작성 중 상태) ─────────
-- 사진을 고르면 바로 올리고 붙여 둔다 → 나갔다 와도 "작성 중 · 이어서"
create function public.attach_media(p_student text, p_activity uuid, p_media_key text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_en uuid := app.current_enrollment(p_student);
  v_act activities%rowtype;
begin
  select * into v_act from activities where activity_id = p_activity and enrollment_id = v_en for update;
  if v_act.activity_id is null then raise exception 'activity not found for this learner' using errcode = 'check_violation'; end if;
  if v_act.completed_at is not null then raise exception 'already completed' using errcode = 'check_violation'; end if;
  if not app.media_key_ok(v_act.activity_type, v_en, p_media_key) then raise exception 'invalid media key' using errcode = 'check_violation'; end if;
  update activities
  set media_key = p_media_key,
      state = case when p_media_key like 'recordings/%' then 'RECORDED' else 'CONTENT_READY' end
  where activity_id = p_activity;
  return jsonb_build_object('activity_id', p_activity);
end
$$;

-- ───────── 학습 완료 (모든 활동 공통) ─────────
-- 파일 키를 주면 함께 붙인다. 없으면 이미 붙여 둔 파일로 완료한다.
create function public.complete_activity(p_student text, p_activity uuid, p_media_key text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_en uuid := app.current_enrollment(p_student);
  v_act activities%rowtype;
  v_key text;
  v_first boolean;
begin
  select * into v_act from activities where activity_id = p_activity and enrollment_id = v_en for update;
  if v_act.activity_id is null then raise exception 'activity not found for this learner' using errcode = 'check_violation'; end if;
  if v_act.completed_at is not null then raise exception 'already completed' using errcode = 'check_violation'; end if;
  v_key := coalesce(p_media_key, v_act.media_key);
  if not app.media_key_ok(v_act.activity_type, v_en, v_key) then raise exception 'invalid media key' using errcode = 'check_violation'; end if;

  select v_act.activity_type = 'EN_READING' and not exists (
    select 1 from activities a where a.enrollment_id = v_en and a.activity_type = 'EN_READING' and a.completed_at is not null
  ) into v_first;

  update activities set state = 'COMPLETED', completed_at = now(), media_key = v_key where activity_id = p_activity;

  return jsonb_build_object(
    'week_no', v_act.week_no,
    'week_completed', (select count(*) from activities a where a.enrollment_id = v_en and a.week_no = v_act.week_no and a.completed_at is not null),
    'first_en', v_first
  );
end
$$;

-- 낭독 완료는 공통 함수로 옮겼다
drop function public.complete_reading(text, uuid, text);

-- ───────── 인스타 인증 (링크 붙여넣기 → 완료) ─────────
-- 링크 모양은 서버에서 정리해서 넘긴다(https://www.instagram.com/p|reel/<코드>/). 실제 게시물 확인은 하지 않는다(spec 18장 미확정).
create function public.verify_activity(p_student text, p_activity uuid, p_post_url text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_en uuid := app.current_enrollment(p_student);
  v_act activities%rowtype;
begin
  select * into v_act from activities where activity_id = p_activity and enrollment_id = v_en for update;
  if v_act.activity_id is null then raise exception 'activity not found for this learner' using errcode = 'check_violation'; end if;
  if v_act.completed_at is null then raise exception 'not completed yet' using errcode = 'check_violation'; end if;
  if v_act.verified_at is not null then raise exception 'already verified' using errcode = 'check_violation'; end if;
  if p_post_url !~ '^https://www\.instagram\.com/(p|reel)/[A-Za-z0-9_-]+/$' then raise exception 'invalid post url' using errcode = 'check_violation'; end if;
  update activities set state = 'VERIFIED', verified_at = now(), post_url = p_post_url where activity_id = p_activity;
  return jsonb_build_object(
    'verified_count', (select count(*) from activities a where a.enrollment_id = v_en and a.verified_at is not null),
    'pending_count', (select count(*) from activities a where a.enrollment_id = v_en and a.completed_at is not null and a.verified_at is null)
  );
end
$$;

-- ───────── 인스타 올리기 목록 ─────────
-- 학습 완료했지만 아직 인증하지 않은 것(화면 문구: 올릴 것). 오래된 것부터.
create function public.upload_queue(p_student text)
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
        'kind', case when a.media_key like 'photos/%' then 'photo' else 'video' end,
        'template_key', (select s.storage_key from cohort_weeks w join assets s on s.article_id = w.article_id and s.type = 'insta_template'
                         where w.cohort_id = en.cohort_id and w.week_no = a.week_no order by s.version desc limit 1)
      ) order by a.completed_at)
      from activities a
      where a.enrollment_id = en.enrollment_id and a.completed_at is not null and a.verified_at is null
    ), '[]'::jsonb)
  )
  from en
$$;

-- ───────── 작성 활동 화면 자료 ─────────
-- 기사 제목, VOCA 단어, 작성지 PDF·VOCA 음원 파일 정보, 이어서 할 작성 중 기록
create function public.work_material(p_student text, p_week int, p_type text, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, c.weekly_target
    from enrollments en join cohorts c using (cohort_id)
    where en.enrollment_id = app.current_enrollment(p_student)
  ),
  w as (
    select w.week_no, ar.article_id, ar.title_en
    from en
    join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p_week and w.starts_at <= p_at
    join articles ar on ar.article_id = w.article_id and ar.status = 'published'
  )
  select jsonb_build_object(
    'week_no', w.week_no,
    'weekly_target', en.weekly_target,
    'week_completed', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.completed_at is not null),
    'title', w.title_en,
    'vocab', (select coalesce(jsonb_agg(jsonb_build_object('no', v.no, 'word', v.word, 'meaning', v.meaning) order by v.no), '[]'::jsonb)
              from vocab v where v.article_id = w.article_id),
    'assets', (select coalesce(jsonb_agg(jsonb_build_object('type', a.type, 'storage_key', a.storage_key, 'file_name', a.file_name)), '[]'::jsonb)
               from assets a
               where a.article_id = w.article_id and a.type in ('article_pdf', 'voca_pdf', 'voca_repeat_audio')
                 and a.version = (select max(a2.version) from assets a2 where a2.article_id = a.article_id and a2.type = a.type)),
    'draft', (select jsonb_build_object('activity_id', a.activity_id, 'media_key', a.media_key)
              from activities a
              where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.activity_type = p_type and a.completed_at is null
              order by a.started_at desc limit 1)
  )
  from en, w
$$;

revoke all on function public.attach_media(text, uuid, text), public.complete_activity(text, uuid, text),
  public.verify_activity(text, uuid, text), public.upload_queue(text), public.work_material(text, int, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.attach_media(text, uuid, text), public.complete_activity(text, uuid, text),
  public.verify_activity(text, uuid, text), public.upload_queue(text), public.work_material(text, int, text, timestamptz)
  to service_role;
grant execute on function app.media_key_ok(text, uuid, text) to service_role;
