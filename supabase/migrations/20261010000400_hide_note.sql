-- 친구 의견 숨김(T07 PR F): 서버가 금칙어·연락처 거르기에 걸린 의견을 숨긴다(친구들에게만, 쓴 본인에게는 보임)
-- 거르기 규칙은 서버 코드(lib/moderation/filter.ts), 여기서는 내 활동인지만 확인하고 표시한다
-- 왜 숨겼는지(word | contact | ai): 운영팀이 관리자 화면에서 확인·되살릴 때 쓴다
alter table activity_notes add column hidden_why text check (hidden_why in ('word', 'contact', 'ai'));

create function public.hide_note(p_student text, p_activity uuid, p_why text)
returns void
language sql security definer set search_path = public, pg_temp as $$
  update activity_notes n set hidden_at = now(), hidden_why = p_why
  from activities a
  where n.activity_id = p_activity and a.activity_id = n.activity_id
    and a.enrollment_id = app.current_enrollment(p_student)
$$;

revoke all on function public.hide_note(text, uuid, text) from public, anon, authenticated;
grant execute on function public.hide_note(text, uuid, text) to service_role;
