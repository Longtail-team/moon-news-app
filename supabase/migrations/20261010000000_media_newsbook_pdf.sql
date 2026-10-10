-- 뉴스북 PDF 보관(2026-10-10, T07 4-1): 서버 응답 크기 제한 때문에 만든 PDF를 비공개 media 버킷 books/<수강id>/에 두고
-- 짧은 유효시간 주소로 내려받게 한다. media 버킷에 PDF 형식을 허용한다(기존 형식은 그대로).
-- (테스트용 PGlite에는 storage 스키마가 없어 있을 때만)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    update storage.buckets
    set allowed_mime_types = array_append(allowed_mime_types, 'application/pdf')
    where id = 'media' and not ('application/pdf' = any (allowed_mime_types));
  end if;
end
$$;
