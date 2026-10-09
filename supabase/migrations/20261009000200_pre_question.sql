-- 듣기 전 질문 (2026-10-09): 기사마다 질문 1개. 콘텐츠 시트 기사 탭 "듣기 전 질문" 칸 → 낭독 화면 1단계(듣기)에 보여 준다. 답은 받지 않는다.
alter table articles add column pre_question text check (char_length(pre_question) <= 300);

-- 시트 반영에 질문 칸을 더한다 (20261008000800_content_sync.sql의 sync_week와 같고 pre_question 한 줄만 추가)
create or replace function public.sync_week(p_cohort uuid, p_week int, p jsonb)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_article uuid;
  a jsonb;
begin
  select article_id into v_article from cohort_weeks where cohort_id = p_cohort and week_no = p_week for update;
  if not found then raise exception 'week % not in cohort', p_week using errcode = 'check_violation'; end if;

  if v_article is null then
    insert into articles (title_en, status) values (p->>'title_en', 'draft') returning article_id into v_article;
    update cohort_weeks set article_id = v_article where cohort_id = p_cohort and week_no = p_week;
  end if;

  update articles set
    title_en = p->>'title_en',
    subtitle = nullif(p->>'subtitle', ''),
    title_ko = nullif(p->>'title_ko', ''),
    word_count = nullif(p->>'word_count', '')::int,
    level = nullif(p->>'level', ''),
    ar_level = nullif(p->>'ar_level', ''),
    pre_question = nullif(btrim(p->>'pre_question'), ''),
    status = p->>'status'
  where article_id = v_article;

  delete from sentences where article_id = v_article;
  insert into sentences (article_id, para_no, sent_no, en, ko)
  select v_article, (s->>'para_no')::int, (s->>'sent_no')::int, s->>'en', coalesce(s->>'ko', '')
  from jsonb_array_elements(p->'sentences') s;

  delete from vocab where article_id = v_article;
  insert into vocab (article_id, no, word, meaning, example)
  select v_article, (v->>'no')::int, v->>'word', v->>'meaning', nullif(v->>'example', '')
  from jsonb_array_elements(coalesce(p->'vocab', '[]'::jsonb)) v;

  delete from week_items where article_id = v_article;
  insert into week_items (article_id, sort_no, kind, title, url, body)
  select v_article, (i->>'sort_no')::int, i->>'kind', i->>'title', nullif(i->>'url', ''), nullif(i->>'body', '')
  from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) i;

  -- 파일: 같은 원본(md5)이 이미 최신이면 그대로, 바뀌었으면 새 version으로 연결만 바꾼다(spec 17장)
  for a in select * from jsonb_array_elements(coalesce(p->'assets', '[]'::jsonb)) loop
    if not exists (
      select 1 from assets x
      where x.article_id = v_article and x.type = a->>'type' and x.source_md5 = a->>'source_md5'
        and x.version = (select max(version) from assets y where y.article_id = v_article and y.type = a->>'type')
    ) then
      insert into assets (article_id, type, file_name, storage_key, version, source_file_id, source_md5)
      values (v_article, a->>'type', a->>'file_name', a->>'storage_key',
              coalesce((select max(version) from assets y where y.article_id = v_article and y.type = a->>'type'), 0) + 1,
              a->>'source_file_id', a->>'source_md5');
    end if;
  end loop;

  return v_article;
end
$$;

-- 낭독 화면 자료에 질문을 싣는다
create or replace function public.reading_material(p_student text, p_week int, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id, c.weekly_target, c.deadline
    from enrollments en join cohorts c using (cohort_id)
    where en.enrollment_id = app.current_enrollment(p_student, p_at)
  ),
  w as (
    select w.week_no, ar.article_id, ar.title_en, ar.word_count, ar.pre_question
    from en
    join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p_week and w.starts_at <= p_at
    join articles ar on ar.article_id = w.article_id and ar.status = 'published'
  )
  select jsonb_build_object(
    'week_no', w.week_no,
    'weekly_target', en.weekly_target,
    'deadline', en.deadline,
    'week_completed', (select count(*) from activities a where a.enrollment_id = en.enrollment_id and a.week_no = w.week_no and a.completed_at is not null),
    'title', w.title_en,
    'word_count', w.word_count,
    'pre_question', w.pre_question,
    'sentences', (select jsonb_agg(jsonb_build_object('para_no', s.para_no, 'sent_no', s.sent_no, 'en', s.en, 'ko', s.ko) order by s.sent_no)
                  from sentences s where s.article_id = w.article_id),
    'assets', (select coalesce(jsonb_agg(jsonb_build_object('type', a.type, 'storage_key', a.storage_key, 'timing_key', a.timing_key)), '[]'::jsonb)
               from assets a
               where a.article_id = w.article_id and a.type in ('article_audio', 'kr_en_repeat_audio', 'article_pdf')
                 and a.version = (select max(a2.version) from assets a2 where a2.article_id = a.article_id and a2.type = a.type))
  )
  from en, w
$$;
