-- ============================================================================
-- Contratos firmados (PDF) por persona, en un bucket PRIVADO.
--   * La persona ve y descarga los suyos.
--   * El director y el manager de su equipo suben, ven y borran los de su alcance.
--   * Nadie sube ni borra los suyos, salvo el director.
--   * Cada archivo vive en <employee_id>/<uuid>.pdf; otra empresa nunca los alcanza.
-- Idempotente.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-files', 'contract-files', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

create table if not exists public.contract_documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null default private.current_org_id() references public.organizations(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  file_name    text not null check (length(trim(file_name)) between 1 and 200),
  storage_path text not null check (length(storage_path) between 1 and 300),
  note         text check (note is null or length(note) <= 300),
  uploaded_by  uuid references public.employees(id) on delete set null,
  uploaded_at  timestamptz not null default now()
);
create index if not exists contract_documents_employee_idx on public.contract_documents (employee_id, uploaded_at desc);
create index if not exists contract_documents_org_idx      on public.contract_documents (org_id);
alter table public.contract_documents enable row level security;

-- la persona debe ser de la misma empresa y la ruta debe vivir en su carpeta
create or replace function private.validate_contract_document()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.employees e where e.id = new.employee_id and e.org_id = new.org_id) then
    raise exception 'employee does not belong to this organization';
  end if;
  if split_part(new.storage_path, '/', 1) <> new.employee_id::text then
    raise exception 'the file must be stored in the folder of that person';
  end if;
  if auth.uid() is not null then new.uploaded_by := private.current_employee_id(); end if;
  return new;
end $$;
drop trigger if exists contract_documents_validate on public.contract_documents;
create trigger contract_documents_validate before insert on public.contract_documents
  for each row execute function private.validate_contract_document();

create or replace function private.audit_contract_document()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.contract_documents;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
  values (r.org_id, private.current_employee_id(),
          case tg_op when 'INSERT' then 'contract_document.added' else 'contract_document.deleted' end,
          'contract_document', r.id, jsonb_build_object('employee_id', r.employee_id, 'file_name', r.file_name));
  return null;
end $$;
drop trigger if exists contract_documents_audit on public.contract_documents;
create trigger contract_documents_audit after insert or delete on public.contract_documents
  for each row execute function private.audit_contract_document();

revoke all on public.contract_documents from anon;
revoke all on public.contract_documents from authenticated;
grant select, insert, delete on public.contract_documents to authenticated;

drop policy if exists contract_docs_select on public.contract_documents;
drop policy if exists contract_docs_insert on public.contract_documents;
drop policy if exists contract_docs_delete on public.contract_documents;
create policy contract_docs_select on public.contract_documents for select to authenticated
  using (org_id = (select private.current_org_id())
         and (employee_id = (select private.current_employee_id()) or (select private.can_manage_employee(employee_id))));
create policy contract_docs_insert on public.contract_documents for insert to authenticated
  with check (org_id = (select private.current_org_id())
              and (select private.can_manage_employee(employee_id))
              and (employee_id <> (select private.current_employee_id()) or (select private.is_admin())));
create policy contract_docs_delete on public.contract_documents for delete to authenticated
  using (org_id = (select private.current_org_id())
         and (select private.can_manage_employee(employee_id))
         and (employee_id <> (select private.current_employee_id()) or (select private.is_admin())));

-- Storage: la carpeta es el id de la persona
drop policy if exists contractfiles_select on storage.objects;
drop policy if exists contractfiles_insert on storage.objects;
drop policy if exists contractfiles_delete on storage.objects;

create policy contractfiles_select on storage.objects for select to authenticated
  using (bucket_id = 'contract-files'
         and ((storage.foldername(name))[1] = (select private.current_employee_id())::text
              or case when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
                      then private.can_manage_employee(((storage.foldername(name))[1])::uuid) else false end));
create policy contractfiles_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'contract-files'
              and case when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
                       then private.can_manage_employee(((storage.foldername(name))[1])::uuid)
                            and ((storage.foldername(name))[1] <> (select private.current_employee_id())::text or (select private.is_admin()))
                       else false end);
create policy contractfiles_delete on storage.objects for delete to authenticated
  using (bucket_id = 'contract-files'
         and case when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
                  then private.can_manage_employee(((storage.foldername(name))[1])::uuid)
                       and ((storage.foldername(name))[1] <> (select private.current_employee_id())::text or (select private.is_admin()))
                  else false end);
