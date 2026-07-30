-- DAY NIGHT DELIVERY SERVICES
-- storage.foldername(name) returns folder components and excludes the file name.
-- The authorized upload path is complaint_id/upload_nonce/file, therefore the
-- folder array contains exactly two required components, not three.

begin;

create or replace function public.dn_ce_can_upload_complaint_attachment(
  p_complaint_id text,
  p_upload_nonce text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.complaints c
    where c.id::text = p_complaint_id
      and c.metadata->>'upload_nonce' = p_upload_nonce
      and c.created_at > now() - interval '30 minutes'
  );
$$;

revoke all on function public.dn_ce_can_upload_complaint_attachment(text,text) from public;
grant execute on function public.dn_ce_can_upload_complaint_attachment(text,text) to anon, authenticated, service_role;

drop policy if exists ce_complaint_storage_insert on storage.objects;
create policy ce_complaint_storage_insert
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'complaint-attachments'
  and array_length(storage.foldername(name), 1) >= 2
  and public.dn_ce_can_upload_complaint_attachment(
    (storage.foldername(name))[1],
    (storage.foldername(name))[2]
  )
);

commit;
