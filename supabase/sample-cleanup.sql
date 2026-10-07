-- 샘플 데이터 지우기 (개강 전, 실제 수강생 데이터를 넣기 전에 한 번만 실행)
-- 경고: 모든 테이블의 행을 지운다. 실제 수강생이 등록된 뒤에는 절대 실행하지 않는다.
-- 실행 전 확인: 보호자가 샘플 번호(0100000xxxx)뿐인지
--   select phone from guardians where phone !~ '^0100000[0-9]{4}$';  → 결과가 없어야 한다

truncate table
  live_clicks, notifications, activities, access_tokens, enrollments, students, guardians,
  live_sessions, cohort_weeks, cohorts, assets, vocab, sentences, articles
restart identity;

select setval('student_no_seq', 1, false);
