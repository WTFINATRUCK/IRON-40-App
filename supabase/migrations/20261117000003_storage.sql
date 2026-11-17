-- Private bucket for ID photos. Path layout: <tenant_id>/<user_id>/<random>.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('id-docs', 'id-docs', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Customers may only add files into their own folder, and only while they are allowed to (re)submit.
create function private.can_upload_id(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.customers c
    where c.user_id = auth.uid()
      and c.id_status in ('unsubmitted', 'rejected')
      and p_name ~ ('^' || c.tenant_id::text || '/' || c.user_id::text || '/[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$'))
  and (select count(*) from storage.objects o
       where o.bucket_id = 'id-docs' and o.owner_id = auth.uid()::text
         and o.created_at > now() - interval '1 day') < 10
$$;
revoke execute on function private.can_upload_id(text) from public, anon, authenticated;
grant execute on function private.can_upload_id(text) to authenticated;

create policy id_docs_customer_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'id-docs' and (select private.can_upload_id(name)));

-- Staff of the same operator can view (for review) and delete (for retention purges). Nobody else can read.
create policy id_docs_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'id-docs'
         and (storage.foldername(name))[1] = (select private.staff_tenant())::text);

create policy id_docs_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'id-docs'
         and (storage.foldername(name))[1] = (select private.staff_tenant(array['owner','admin']::public.staff_role[]))::text);
