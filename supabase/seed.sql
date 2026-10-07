-- T02 샘플 데이터. 실제 수강생 데이터가 아니다(이름·번호·계정 모두 가짜).
-- 기준: 1기는 2026-09-14(월) 시작, 종강일 2026-12-06(일). 2026-10-07(수)은 4주차.
-- 재수강·늦은 완주 사례를 위해 지난 기수(0기)를 하나 둔다.
--
-- 학습자 8명
--   S-0001 김지우  정상 (이번 주 2회, 올릴 것 2개, 작성 중 1개)
--   S-0002 박서연  게시 밀림 (학습 20회, 인증 12회)
--   S-0003 이도윤  학습 밀림 + 자녀 본인 휴대폰 접속
--   S-0004 최하린  재수강 (0기 늦은 완주) + 1기 정상
--   S-0005 정민준  환불 (1주차 중 환불 → 접속 링크 폐기)
--   S-0006 한예린  미시작 (1차 독려 받음)
--   S-0007 윤시우  형제 수강 (보호자 같음) · 정상
--   S-0008 강다은  형제 수강 (보호자 같음) · 학습 밀림

do $$
declare
  c0 uuid; c1 uuid;
  art uuid[] := '{}';
  a uuid;
  g1 uuid; g2 uuid; g3 uuid; g4 uuid; g5 uuid; g6 uuid; g7 uuid;
  e_jiwoo uuid; e_seoyeon uuid; e_doyun uuid; e_harin0 uuid; e_harin uuid; e_minjun uuid; e_yerin uuid; e_siwoo uuid; e_daeun uuid;
  i int;
begin
  -- ───────── 기사 12편 (1주차는 docs/content/week01.md, 나머지는 자리표시) ─────────
  insert into articles (title_en, level, word_count, status)
  values ('RM Opens His Art Collection to the World', '780L (추정)', 173, 'published')
  returning article_id into a;
  art := art || a;

  insert into sentences (article_id, para_no, sent_no, en, ko) values
    (a, 1, 1, 'What does a pop star collect?', '팝 스타는 무엇을 모을까?'),
    (a, 1, 2, 'For RM of BTS, / the answer is art.', '방탄소년단의 RM에게 그 답은 미술 작품이다.'),
    (a, 1, 3, 'For the first time, / RM is sharing his personal art collection / in a museum show.', 'RM은 처음으로 자신이 모은 미술 작품들을 미술관 전시에서 사람들에게 보여 주고 있다.'),
    (a, 1, 4, 'The exhibition, / "RM x SFMOMA: Between You and Me," / is at the San Francisco Museum of Modern Art, / also known as SFMOMA.', '''RM x SFMOMA: Between You and Me''라는 이 전시는 SFMOMA라고도 불리는 샌프란시스코 현대미술관에서 열리고 있다.'),
    (a, 2, 5, 'The show has 178 artworks.', '이 전시에는 작품 178점이 있다.'),
    (a, 2, 6, 'Of these, / 142 come from RM''s own collection, / and 36 come from the museum.', '그중 142점은 RM이 직접 모은 작품이고, 36점은 미술관이 가진 작품이다.'),
    (a, 2, 7, 'Half of the works are by Korean artists.', '작품의 절반은 한국 작가들의 작품이다.'),
    (a, 2, 8, 'The other half / are by artists from other countries.', '나머지 절반은 다른 나라 작가들의 작품이다.'),
    (a, 3, 9, 'RM did more than lend his art.', 'RM은 자신이 가진 작품을 빌려주기만 한 것이 아니다.'),
    (a, 3, 10, 'He helped choose the works / and wrote the texts on the walls.', '전시할 작품을 고르는 일을 돕고, 벽에 걸린 설명 글도 직접 썼다.'),
    (a, 3, 11, 'He also recorded an audio guide / in Korean and English / and picked the background music.', '또 한국어와 영어로 음성 안내를 녹음하고, 배경 음악도 골랐다.'),
    (a, 4, 12, '"Few things show a person / as honestly as a collection / someone has built over a long time," / RM said.', 'RM은 "누군가 오랫동안 모아 온 컬렉션만큼 그 사람을 솔직하게 보여 주는 것은 거의 없어요"라고 말했다.'),
    (a, 4, 13, '"This exhibition / is a long introduction of myself."', '"이번 전시는 저를 길게 소개하는 자리예요."'),
    (a, 5, 14, 'The exhibition gives visitors a chance / to see another side of RM— / not just as a musician, / but also as an art lover and collector.', '관람객들은 이 전시에서 음악가 RM뿐 아니라, 미술을 사랑하고 작품을 모으는 RM의 또 다른 모습도 볼 수 있다.');

  insert into vocab (article_id, no, word, meaning, example) values
    (a, 1, 'collection', '수집품, 소장품', 'RM is sharing his personal art collection.'),
    (a, 2, 'exhibition', '전시회', 'The exhibition is at SFMOMA.');

  insert into assets (article_id, type, file_name, storage_key) values
    (a, 'article_audio', 'week01_article.mp3', 'sample/week01/article.mp3'),
    (a, 'kr_en_repeat_audio', 'week01_kr_en.mp3', 'sample/week01/kr_en.mp3'),
    (a, 'voca_repeat_audio', 'week01_voca.mp3', 'sample/week01/voca.mp3'),
    (a, 'article_pdf', 'week01_article.pdf', 'sample/week01/article.pdf'),
    (a, 'voca_pdf', 'week01_voca.pdf', 'sample/week01/voca.pdf'),
    (a, 'insta_template', 'week01_template.png', 'sample/week01/template.png');

  for i in 2..12 loop
    insert into articles (title_en, level, word_count, status)
    values (format('Week %s article (placeholder)', i), '샘플', 180, case when i <= 4 then 'published' else 'draft' end)
    returning article_id into a;
    art := art || a;
    insert into sentences (article_id, para_no, sent_no, en, ko)
    values (a, 1, 1, format('This is a placeholder sentence for week %s.', i), format('%s주차 자리표시 문장입니다.', i));
  end loop;

  -- ───────── 기수 ─────────
  insert into cohorts (course_title, cohort_no, start_date, deadline)
  values ('새벽달 영어뉴스', 0, '2026-03-02', '2026-05-24') returning cohort_id into c0;
  insert into cohorts (course_title, cohort_no, start_date, deadline)
  values ('새벽달 영어뉴스', 1, '2026-09-14', '2026-12-06') returning cohort_id into c1;

  insert into cohort_weeks (cohort_id, week_no, starts_at, ends_at, article_id)
  select c.cohort_id, w,
    ((c.start_date + (w - 1) * 7)::timestamp at time zone 'Asia/Seoul'),
    ((c.start_date + w * 7)::timestamp at time zone 'Asia/Seoul'),
    art[w]
  from cohorts c, generate_series(1, 12) w
  where c.cohort_id in (c0, c1);

  insert into live_sessions (cohort_id, session_no, starts_at, zoom_url)
  values (c1, 1, '2026-10-24 20:00+09', 'https://zoom.example/sample');

  -- ───────── 보호자·학습자 ─────────
  insert into guardians (name, phone, alimtalk_agreed_at) values ('김지우 보호자', '01000000001', '2026-09-08 10:00+09') returning guardian_id into g1;
  insert into guardians (name, phone, alimtalk_agreed_at) values ('박서연 보호자', '01000000002', '2026-09-08 10:00+09') returning guardian_id into g2;
  insert into guardians (name, phone, alimtalk_agreed_at) values ('이도윤 보호자', '01000000003', '2026-09-08 10:00+09') returning guardian_id into g3;
  insert into guardians (name, phone, alimtalk_agreed_at) values ('최하린 보호자', '01000000004', '2026-02-25 10:00+09') returning guardian_id into g4;
  insert into guardians (name, phone, alimtalk_agreed_at) values ('정민준 보호자', '01000000005', '2026-09-08 10:00+09') returning guardian_id into g5;
  insert into guardians (name, phone, alimtalk_agreed_at) values ('한예린 보호자', '01000000006', '2026-09-08 10:00+09') returning guardian_id into g6;
  insert into guardians (name, phone, alimtalk_agreed_at) values ('윤시우·강다은 보호자', '01000000007', '2026-09-08 10:00+09') returning guardian_id into g7;

  insert into students (student_id, guardian_id, name, birth_ym, own_phone, instagram_id, consent_at) values
    ('S-0001', g1, '김지우', '2015-05-01', null, 'sample_jiwoo', '2026-09-08 10:05+09'),
    ('S-0002', g2, '박서연', '2014-03-01', null, 'sample_seoyeon', '2026-09-08 10:05+09'),
    ('S-0003', g3, '이도윤', '2013-07-01', '01000001003', 'sample_doyun', '2026-09-08 10:05+09'),
    ('S-0004', g4, '최하린', '2015-11-01', null, 'sample_harin', '2026-02-25 10:05+09'),
    ('S-0005', g5, '정민준', '2014-09-01', null, 'sample_minjun', '2026-09-08 10:05+09'),
    ('S-0006', g6, '한예린', '2012-12-01', null, 'sample_yerin', '2026-09-08 10:05+09'),
    ('S-0007', g7, '윤시우', '2015-02-01', null, 'sample_siblings', '2026-09-08 10:05+09'),
    ('S-0008', g7, '강다은', '2015-02-01', null, 'sample_siblings', '2026-09-08 10:05+09');
  perform setval('student_no_seq', 8);

  -- 접속 링크 (token_hash만 저장)
  insert into access_tokens (student_id, holder, sent_to_phone, token_hash, issued_at)
  select s.student_id, 'guardian', g.phone, encode(sha256(convert_to('sample-token-' || s.student_id, 'UTF8')), 'hex'), '2026-09-08 10:00+09'
  from students s join guardians g using (guardian_id);
  insert into access_tokens (student_id, holder, sent_to_phone, token_hash, issued_at)
  values ('S-0003', 'child', '01000001003', encode(sha256(convert_to('sample-token-S-0003-child', 'UTF8')), 'hex'), '2026-09-08 10:10+09');

  -- ───────── 수강 ─────────
  insert into enrollments (student_id, cohort_id, grade_at_enrollment, paid_at, paid_amount, completed_at, completion_tier)
  values ('S-0004', c0, '초4', '2026-02-20 09:00+09', 120000, '2026-06-20 21:00+09', 'late') returning enrollment_id into e_harin0;

  insert into enrollments (student_id, cohort_id, grade_at_enrollment, paid_at, paid_amount) values ('S-0001', c1, '초5', '2026-09-01 09:00+09', 120000) returning enrollment_id into e_jiwoo;
  insert into enrollments (student_id, cohort_id, grade_at_enrollment, paid_at, paid_amount) values ('S-0002', c1, '초6', '2026-09-01 09:00+09', 120000) returning enrollment_id into e_seoyeon;
  insert into enrollments (student_id, cohort_id, grade_at_enrollment, paid_at, paid_amount) values ('S-0003', c1, '중1', '2026-09-01 09:00+09', 120000) returning enrollment_id into e_doyun;
  insert into enrollments (student_id, cohort_id, grade_at_enrollment, paid_at, paid_amount) values ('S-0004', c1, '초5', '2026-09-01 09:00+09', 120000) returning enrollment_id into e_harin;
  insert into enrollments (student_id, cohort_id, grade_at_enrollment, paid_at, paid_amount) values ('S-0005', c1, '초6', '2026-09-01 09:00+09', 120000) returning enrollment_id into e_minjun;
  insert into enrollments (student_id, cohort_id, grade_at_enrollment, paid_at, paid_amount) values ('S-0006', c1, '중2', '2026-09-01 09:00+09', 120000) returning enrollment_id into e_yerin;
  insert into enrollments (student_id, cohort_id, grade_at_enrollment, paid_at, paid_amount) values ('S-0007', c1, '초5', '2026-09-01 09:00+09', 120000) returning enrollment_id into e_siwoo;
  insert into enrollments (student_id, cohort_id, grade_at_enrollment, paid_at, paid_amount) values ('S-0008', c1, '초5', '2026-09-01 09:00+09', 120000) returning enrollment_id into e_daeun;

  -- ───────── 학습 기록 ─────────
  -- 활동 종류는 추천 루틴 순서(한국어 낭독, VOCA, 요약, 토론, 영어 낭독)로 돌린다.
  -- k번째 학습 완료는 주차 시작(월 0시) + 10시간 + (k-1)×8시간 → 5번째도 화요일 18시. 시작은 1시간 전, 인증은 2시간 + verify_lag(일) 뒤.
  -- (4주차 기록이 기준 시각 2026-10-07(수) 12시 이전에 들도록, 4주차 월요일 9시 독려 판정에는 안 들도록)
  create temp table seed_plan (enrollment_id uuid, week_no int, n_completed int, n_verified int, verify_lag int, n_started int default 0) on commit drop;
  insert into seed_plan values
    -- 김지우: 1~3주차 5회(3주차 1개 미인증), 4주차 2회(1개 미인증) + 작성 중 1개 → 학습 17, 인증 15, 올릴 것 2
    (e_jiwoo, 1, 5, 5, 0, 0), (e_jiwoo, 2, 5, 5, 0, 0), (e_jiwoo, 3, 5, 4, 0, 0), (e_jiwoo, 4, 2, 1, 0, 1),
    -- 박서연: 학습 20, 인증 12 → 올릴 것 8 (게시 밀림)
    (e_seoyeon, 1, 5, 5, 1, 0), (e_seoyeon, 2, 5, 5, 1, 0), (e_seoyeon, 3, 5, 2, 1, 0), (e_seoyeon, 4, 5, 0, 0, 0),
    -- 이도윤: 1주차 5, 2주차 2 → 학습 7 (4주차 기준 기대 15, 8회 밀림)
    (e_doyun, 1, 5, 5, 0, 0), (e_doyun, 2, 2, 2, 0, 0),
    -- 최하린 1기: 학습 17, 인증 17
    (e_harin, 1, 5, 5, 0, 0), (e_harin, 2, 5, 5, 0, 0), (e_harin, 3, 5, 5, 0, 0), (e_harin, 4, 2, 2, 0, 0),
    -- 정민준: 1주차 3회 후 환불
    (e_minjun, 1, 3, 3, 0, 0),
    -- 윤시우: 학습 19, 인증 18
    (e_siwoo, 1, 5, 5, 0, 0), (e_siwoo, 2, 5, 5, 0, 0), (e_siwoo, 3, 5, 5, 0, 0), (e_siwoo, 4, 4, 3, 0, 0),
    -- 강다은: 1주차 5, 4주차 1 → 학습 6 (4주차 월요일 기준 5회, 10회 밀림)
    (e_daeun, 1, 5, 5, 0, 0), (e_daeun, 4, 1, 1, 0, 0);

  insert into activities (enrollment_id, week_no, activity_type, state, started_at, completed_at, post_url, verified_at, media_key)
  select p.enrollment_id, p.week_no,
    (array['KR_READING', 'VOCA', 'SUMMARY', 'DEBATE', 'EN_READING'])[k],
    case when k <= p.n_verified then 'VERIFIED' else 'COMPLETED' end,
    w.starts_at + make_interval(hours => 9 + (k - 1) * 8),
    w.starts_at + make_interval(hours => 10 + (k - 1) * 8),
    case when k <= p.n_verified then format('https://www.instagram.com/p/sample-%s-%s-%s/', left(p.enrollment_id::text, 8), p.week_no, k) end,
    case when k <= p.n_verified then w.starts_at + make_interval(days => p.verify_lag, hours => 12 + (k - 1) * 8) end,
    format('sample/media/%s/%s-%s', left(p.enrollment_id::text, 8), p.week_no, k)
  from seed_plan p
  join enrollments en on en.enrollment_id = p.enrollment_id
  join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p.week_no
  cross join generate_series(1, p.n_completed) k;

  -- 작성 중(시작만 한) 활동
  insert into activities (enrollment_id, week_no, activity_type, state, started_at)
  select p.enrollment_id, p.week_no, 'SUMMARY', 'STARTED', w.starts_at + make_interval(days => 1, hours => 20)
  from seed_plan p
  join enrollments en on en.enrollment_id = p.enrollment_id
  join cohort_weeks w on w.cohort_id = en.cohort_id and w.week_no = p.week_no
  where p.n_started > 0;

  -- 최하린 0기: 60회 학습·인증. 60번째 인증이 유예 기간(2026-05-31) 뒤인 2026-06-20 → 늦은 완주
  insert into activities (enrollment_id, week_no, activity_type, state, started_at, completed_at, post_url, verified_at)
  select e_harin0, w.week_no,
    (array['KR_READING', 'VOCA', 'SUMMARY', 'DEBATE', 'EN_READING'])[k],
    'VERIFIED',
    w.starts_at + make_interval(days => k - 1, hours => 18),
    w.starts_at + make_interval(days => k - 1, hours => 19),
    format('https://www.instagram.com/p/sample-harin0-%s-%s/', w.week_no, k),
    case when w.week_no = 12 and k = 5 then '2026-06-20 21:00+09'::timestamptz
         else w.starts_at + make_interval(days => k - 1, hours => 21) end
  from cohort_weeks w cross join generate_series(1, 5) k
  where w.cohort_id = c0;

  -- ───────── 환불 (트리거가 접속 링크를 폐기) ─────────
  update enrollments
  set status = 'refunded', refund_status = 'approved', refunded_at = '2026-09-25 15:00+09', refund_amount = 120000, refund_reason = '샘플: 일정 사정'
  where enrollment_id = e_minjun;

  -- ───────── 알림 기록 ─────────
  insert into notifications (student_id, enrollment_id, template, recipient, sent_to_phone, sent_at, result)
  select en.student_id, en.enrollment_id, 'start_guide', 'guardian', g.phone, '2026-09-08 10:00+09', 'sent'
  from enrollments en join students s using (student_id) join guardians g using (guardian_id)
  where en.cohort_id = c1;

  insert into notifications (student_id, enrollment_id, template, recipient, sent_to_phone, sent_at, result)
  values ('S-0003', e_doyun, 'child_link', 'child', '01000001003', '2026-09-08 10:10+09', 'sent');

  -- 1차 독려(2주차 월요일): 한예린만 대상이었음
  insert into notifications (student_id, enrollment_id, template, checkpoint, recipient, sent_to_phone, sent_at, result)
  values ('S-0006', e_yerin, 'nudge', 'nudge_1', 'guardian', '01000000006', '2026-09-21 09:00+09', 'sent');
end
$$;
