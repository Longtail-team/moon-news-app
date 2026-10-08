-- T05 콘텐츠 시트 반영 (GitHub Actions → 키 없는 구글 연결 → 이 함수들)
-- 반영 작업은 service_role로만 실행한다. 학생 화면은 주차 시작 + 공개일 때만 보인다(이미 구현).

alter table articles add column subtitle text;
alter table articles add column ar_level text;

-- 드라이브 원본 파일과 연결: 같은 파일(md5)이면 다시 올리지 않는다
alter table assets add column source_file_id text;
alter table assets add column source_md5 text;

-- 기수마다 콘텐츠 시트 1개와 자료 폴더 1개 (ID는 비밀이 아니다)
create table content_sources (
  cohort_id uuid primary key references cohorts on delete cascade,
  sheet_id text not null,
  folder_id text not null,
  created_at timestamptz not null default now()
);
alter table content_sources enable row level security;
revoke all on content_sources from anon, authenticated;

-- 반영 기록 (관리자 화면에서 볼 것)
create table sync_runs (
  run_id uuid primary key default gen_random_uuid(),
  cohort_id uuid references cohorts on delete set null,
  trigger text not null, -- schedule / manual / local
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  summary jsonb
);
alter table sync_runs enable row level security;
revoke all on sync_runs from anon, authenticated;

-- 주차 하나 반영: 기사·문장·단어·추가 자료·파일을 한 번에(전부 되거나 전부 안 되거나)
-- p: {title_en, subtitle, title_ko, word_count, level, ar_level, status, sentences[], vocab[], items[], assets[]}
create function public.sync_week(p_cohort uuid, p_week int, p jsonb)
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

-- 지금 연결된 파일의 원본 md5 (바뀐 파일만 올리기 위해)
create function public.sync_asset_state(p_cohort uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('week_no', w.week_no, 'type', a.type, 'source_md5', a.source_md5, 'storage_key', a.storage_key)), '[]'::jsonb)
  from cohort_weeks w
  join assets a on a.article_id = w.article_id
  where w.cohort_id = p_cohort
    and a.version = (select max(version) from assets y where y.article_id = a.article_id and y.type = a.type)
$$;

-- 라이브: 회차 기준으로 넣거나 고친다(지우지는 않는다: 입장 기록이 붙어 있을 수 있다)
create function public.sync_live(p_cohort uuid, p_sessions jsonb)
returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into live_sessions (cohort_id, session_no, starts_at, zoom_url, replay_url)
  select p_cohort, (s->>'session_no')::int, (s->>'starts_at')::timestamptz, nullif(s->>'zoom_url', ''), nullif(s->>'replay_url', '')
  from jsonb_array_elements(p_sessions) s
  on conflict (cohort_id, session_no) do update
    set starts_at = excluded.starts_at, zoom_url = excluded.zoom_url, replay_url = excluded.replay_url
$$;

revoke all on function public.sync_week(uuid, int, jsonb), public.sync_asset_state(uuid), public.sync_live(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sync_week(uuid, int, jsonb), public.sync_asset_state(uuid), public.sync_live(uuid, jsonb) to service_role;

-- 1기 시트·폴더 연결 (샘플 1기와 같은 기수 번호)
insert into content_sources (cohort_id, sheet_id, folder_id)
select cohort_id, '1Pkt4uPnv59n-j65_yXteETNCVlx8wR6B0RTlaOAFAEw', '1NbWGeeRcaKRBkpi7Ty-M_65-H39BBRvL'
from cohorts where course_title = '새벽달 영어뉴스' and cohort_no = 1
on conflict (cohort_id) do nothing;
