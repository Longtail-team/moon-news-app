-- 활동 카드 보관(T07 PR C, 2026-10-10 결정): 읽기 완료 카드처럼 녹음·사진과 따로 카드 그림을 둔다.
-- 청독은 지금처럼 media_key가 카드 그림이다. 다른 활동은 card_key에 둔다(앱·뉴스북용, cards/<수강>/<활동>-....png).
-- 카드 그림은 종강 후 3개월 삭제 대상에서 뺀다(청독 카드와 같음). 기존 화면과 호환(칸만 더함).
alter table activities add column card_key text;

-- 카드 붙이기: 학습 완료 전후 모두 가능(카드를 올린 뒤 완료하거나, 완료 뒤 붙임). 청독은 media_key가 카드라 쓰지 않는다
create function public.attach_card(p_student text, p_activity uuid, p_card_key text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_en uuid := app.current_enrollment(p_student);
  v_act activities%rowtype;
begin
  select * into v_act from activities where activity_id = p_activity and enrollment_id = v_en for update;
  if v_act.activity_id is null then raise exception 'activity not found for this learner' using errcode = 'check_violation'; end if;
  if v_act.activity_type = 'LISTENING' then raise exception 'listening card is media' using errcode = 'check_violation'; end if;
  if p_card_key is null or p_card_key not like 'cards/' || v_en || '/' || p_activity || '-%' then
    raise exception 'invalid card key' using errcode = 'check_violation';
  end if;
  update activities set card_key = p_card_key where activity_id = p_activity;
  return jsonb_build_object('activity_id', p_activity);
end
$$;

-- 읽기 완료 카드 값(한국어·영어 기사 읽기): 이 낭독을 포함한 누적(아직 완료 전이어도 이번 것을 셈)
-- 영어: 이 기사 단어 수 / 지금까지 소리 내어 읽은 영어 단어. 한국어: 지금까지 낭독 횟수(한국어 + 영어)
create function public.reading_card(p_student text, p_activity uuid, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with a as (
    select a.*, en.cohort_id from activities a join enrollments en using (enrollment_id)
    where a.activity_id = p_activity and a.enrollment_id = app.current_enrollment(p_student, p_at)
      and a.activity_type in ('KR_READING', 'EN_READING')
  ),
  mine as (
    select x.activity_type, coalesce(ar.word_count, 0) as words
    from a join activities x on x.enrollment_id = a.enrollment_id
      and x.activity_type in ('KR_READING', 'EN_READING')
      and (x.completed_at is not null or x.activity_id = a.activity_id)
    join enrollments en2 on en2.enrollment_id = x.enrollment_id
    left join cohort_weeks w2 on w2.cohort_id = en2.cohort_id and w2.week_no = x.week_no
    left join articles ar on ar.article_id = w2.article_id
  )
  select jsonb_build_object(
    'activity_id', a.activity_id,
    'week_no', a.week_no,
    'title', ar.title_en,
    'cohort_no', c.cohort_no,
    'name', s.name,
    'date', (coalesce(a.completed_at, p_at) at time zone 'Asia/Seoul')::date,
    'lang', case when a.activity_type = 'EN_READING' then 'en' else 'kr' end,
    'words', coalesce(ar.word_count, 0),
    'total_words', (select coalesce(sum(words), 0) from mine where activity_type = 'EN_READING'),
    'total_reads', (select count(*) from mine)
  )
  from a join cohorts c on c.cohort_id = a.cohort_id
  join enrollments en on en.enrollment_id = a.enrollment_id
  join students s on s.student_id = en.student_id
  left join cohort_weeks w on w.cohort_id = a.cohort_id and w.week_no = a.week_no
  left join articles ar on ar.article_id = w.article_id and ar.status = 'published'
$$;

revoke all on function public.attach_card(text, uuid, text), public.reading_card(text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.attach_card(text, uuid, text), public.reading_card(text, uuid, timestamptz) to service_role;
