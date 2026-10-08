-- 이번 주 자료 탭 (spec.md 17장 "자료 제공 위치")
-- 자료는 주차가 시작되어야(월 0시, cohort_weeks.starts_at) 그리고 기사가 "공개"여야 열린다 → 주차별로 순차적으로 열린다.

-- 주차(기사)별 추가 자료: 링크와 안내 텍스트. 콘텐츠 시트에서 들어온다.
create table week_items (
  item_id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles on delete cascade,
  sort_no int not null default 1,
  kind text not null check (kind in ('link', 'text')),
  title text not null,
  url text check (url is null or url ~ '^https://'),
  body text,
  created_at timestamptz not null default now(),
  unique (article_id, sort_no),
  check ((kind = 'link') = (url is not null))
);
alter table week_items enable row level security;
revoke all on week_items from anon, authenticated;

-- 열린 주차 목록, 다음에 열릴 주차, 고른 주차의 자료, 기수 라이브
create function public.materials(p_student text, p_week int default null, p_at timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with en as (
    select en.enrollment_id, en.cohort_id
    from enrollments en
    where en.enrollment_id = app.current_enrollment(p_student)
  ),
  wk as (
    select w.week_no, w.starts_at, w.ends_at, w.article_id,
      (select ar.title_en from articles ar where ar.article_id = w.article_id and ar.status = 'published') as title
    from en join cohort_weeks w on w.cohort_id = en.cohort_id
  ),
  opened as (select * from wk where starts_at <= p_at),
  cur as (select week_no from wk where p_at >= starts_at and p_at < ends_at),
  sel as (
    select o.* from opened o
    where o.week_no = coalesce(p_week, (select week_no from cur), (select max(week_no) from opened))
  )
  select jsonb_build_object(
    'current_week', (select week_no from cur),
    'opened', coalesce((select jsonb_agg(jsonb_build_object('week_no', o.week_no, 'title', o.title) order by o.week_no desc) from opened o), '[]'::jsonb),
    'next_open', (select jsonb_build_object('week_no', w.week_no, 'starts_at', w.starts_at) from wk w where w.starts_at > p_at order by w.starts_at limit 1),
    'selected', (select jsonb_build_object(
        'week_no', s.week_no,
        'title_en', ar.title_en, 'title_ko', ar.title_ko, 'level', ar.level, 'word_count', ar.word_count,
        'assets', (select coalesce(jsonb_agg(jsonb_build_object('type', a.type, 'storage_key', a.storage_key, 'file_name', a.file_name)), '[]'::jsonb)
                   from assets a
                   where a.article_id = ar.article_id and a.type <> 'insta_template'
                     and a.version = (select max(a2.version) from assets a2 where a2.article_id = a.article_id and a2.type = a.type)),
        'items', (select coalesce(jsonb_agg(jsonb_build_object('kind', i.kind, 'title', i.title, 'url', i.url, 'body', i.body) order by i.sort_no), '[]'::jsonb)
                  from week_items i where i.article_id = ar.article_id))
      from sel s left join articles ar on ar.article_id = s.article_id and ar.status = 'published'),
    'live', coalesce((select jsonb_agg(jsonb_build_object(
        'session_id', l.session_id, 'session_no', l.session_no, 'starts_at', l.starts_at,
        'has_zoom', l.zoom_url is not null, 'has_replay', l.replay_url is not null) order by l.session_no)
      from en join live_sessions l on l.cohort_id = en.cohort_id), '[]'::jsonb)
  )
  from en
$$;

-- 라이브 입장·다시보기 누름 기록 (spec 13장: 입장 클릭을 기록해 참여율을 본다) → 이동할 주소
create function public.live_click(p_student text, p_session uuid, p_replay boolean)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_url text;
begin
  select case when p_replay then l.replay_url else l.zoom_url end into v_url
  from live_sessions l
  join enrollments en on en.cohort_id = l.cohort_id and en.enrollment_id = app.current_enrollment(p_student)
  where l.session_id = p_session;
  if v_url is null then return null; end if;
  if not p_replay then
    insert into live_clicks (student_id, session_id) values (p_student, p_session);
  end if;
  return v_url;
end
$$;

revoke all on function public.materials(text, int, timestamptz), public.live_click(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.materials(text, int, timestamptz), public.live_click(text, uuid, boolean) to service_role;
