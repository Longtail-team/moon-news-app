-- 환불한 수강의 기수 페이지는 학습자 앱에서 보이지 않게 한다 (2026-10-07 결정)
-- 재수강생이 새 기수(예: 1기)를 환불해도 지난 기수(0기) 수강이 남아 있으면 접속 링크는 유지된다.
-- 이때 0기 페이지는 계속 보이고, 환불한 1기의 수강·기록·주차·자료는 보이지 않는다.
-- (활동·기수·주차·라이브 정책은 enrollments를 거쳐 판단하므로 이 정책 하나로 함께 가려진다)

drop policy enrollments_self on enrollments;
create policy enrollments_self on enrollments for select to authenticated
  using (student_id = any (app.jwt_student_ids()) and refunded_at is null);

create or replace function app.visible_article_ids() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select cw.article_id
  from cohort_weeks cw
  join enrollments en on en.cohort_id = cw.cohort_id
  join articles ar on ar.article_id = cw.article_id
  where en.student_id = any (app.jwt_student_ids())
    and en.refunded_at is null
    and cw.starts_at <= now()
    and ar.status = 'published'
$$;
