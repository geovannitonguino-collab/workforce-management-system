-- ============================================================================
-- Trackly · Fase 1 · Multi-tenant (organizaciones)
-- Idempotente. Compatible con el frontend actual: org_id se rellena por defecto
-- desde la sesión, así que ninguna escritura del cliente necesita enviarlo.
-- Regla: un usuario de Auth pertenece a UNA sola organización.
-- ============================================================================

-- 1. Organizaciones --------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

-- Organización inicial para los datos existentes
insert into public.organizations (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Geovannix')
on conflict (id) do nothing;

-- 2. Columna org_id + backfill --------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['employees','time_entries','leave_requests','medical_proofs'] loop
    execute format('alter table public.%I add column if not exists org_id uuid references public.organizations(id)', t);
    execute format('update public.%I set org_id = %L where org_id is null', t, '00000000-0000-4000-8000-000000000001');
    execute format('alter table public.%I alter column org_id set not null', t);
    execute format('create index if not exists %I on public.%I (org_id)', t || '_org_idx', t);
  end loop;
end $$;

-- el email es único dentro de la organización (no globalmente)
create unique index if not exists employees_org_email_uniq on public.employees (org_id, lower(email));

-- 3. Helpers ---------------------------------------------------------------
create or replace function private.current_org_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.employees where user_id = auth.uid()
$$;
revoke all on function private.current_org_id() from public, anon;
grant execute on function private.current_org_id() to authenticated;

-- org_id por defecto = organización del usuario en sesión
do $$
declare t text;
begin
  foreach t in array array['employees','time_entries','leave_requests','medical_proofs'] loop
    execute format('alter table public.%I alter column org_id set default private.current_org_id()', t);
  end loop;
end $$;

-- La fila hija debe pertenecer a la misma organización que su empleado.
create or replace function private.enforce_child_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.employees e where e.id = new.employee_id and e.org_id = new.org_id) then
    raise exception 'employee does not belong to this organization';
  end if;
  return new;
end $$;
drop trigger if exists time_entries_org_chk   on public.time_entries;
drop trigger if exists leave_requests_org_chk on public.leave_requests;
drop trigger if exists medical_proofs_org_chk on public.medical_proofs;
create trigger time_entries_org_chk   before insert on public.time_entries   for each row execute function private.enforce_child_org();
create trigger leave_requests_org_chk before insert on public.leave_requests for each row execute function private.enforce_child_org();
create trigger medical_proofs_org_chk before insert on public.medical_proofs for each row execute function private.enforce_child_org();

-- 4. Políticas --------------------------------------------------------------
grant select on public.organizations to authenticated;
revoke all on public.organizations from anon;

do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('organizations','employees','time_entries','leave_requests','medical_proofs')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy org_select on public.organizations for select to authenticated
  using (id = (select private.current_org_id()));

-- employees
create policy employees_select on public.employees for select to authenticated
  using (org_id = (select private.current_org_id())
         and (user_id = (select auth.uid()) or (select private.is_admin())));
create policy employees_insert on public.employees for insert to authenticated
  with check (org_id = (select private.current_org_id()) and (select private.is_admin()));
create policy employees_update on public.employees for update to authenticated
  using (org_id = (select private.current_org_id()) and (select private.is_admin()))
  with check (org_id = (select private.current_org_id()) and (select private.is_admin()));

-- time_entries (solo se agregan)
create policy time_entries_select on public.time_entries for select to authenticated
  using (org_id = (select private.current_org_id())
         and (employee_id = (select private.current_employee_id()) or (select private.is_admin())));
create policy time_entries_insert_own on public.time_entries for insert to authenticated
  with check (
    org_id = (select private.current_org_id())
    and employee_id = (select private.current_employee_id())
    and "timestamp" between now() - interval '10 minutes' and now() + interval '2 minutes');
create policy time_entries_insert_admin on public.time_entries for insert to authenticated
  with check (org_id = (select private.current_org_id()) and (select private.is_admin()));

-- leave_requests
create policy leave_select on public.leave_requests for select to authenticated
  using (org_id = (select private.current_org_id())
         and (employee_id = (select private.current_employee_id()) or (select private.is_admin())));
create policy leave_insert_own on public.leave_requests for insert to authenticated
  with check (org_id = (select private.current_org_id())
              and employee_id = (select private.current_employee_id()) and status = 'pending');
create policy leave_update_admin on public.leave_requests for update to authenticated
  using (org_id = (select private.current_org_id()) and (select private.is_admin()))
  with check (org_id = (select private.current_org_id()) and (select private.is_admin()));

-- medical_proofs
create policy proofs_select on public.medical_proofs for select to authenticated
  using (org_id = (select private.current_org_id())
         and (employee_id = (select private.current_employee_id()) or (select private.is_admin())));
create policy proofs_insert on public.medical_proofs for insert to authenticated
  with check (org_id = (select private.current_org_id()) and employee_id = (select private.current_employee_id()));
create policy proofs_update on public.medical_proofs for update to authenticated
  using (org_id = (select private.current_org_id()) and employee_id = (select private.current_employee_id()))
  with check (org_id = (select private.current_org_id()) and employee_id = (select private.current_employee_id()));
create policy proofs_delete on public.medical_proofs for delete to authenticated
  using (org_id = (select private.current_org_id()) and employee_id = (select private.current_employee_id()));

-- 5. Storage: el admin solo lee archivos de empleados de SU organización ----
drop policy if exists medproofs_select on storage.objects;
create policy medproofs_select on storage.objects for select to authenticated
  using (bucket_id = 'medical-proofs'
         and ((storage.foldername(name))[1] = (select private.current_employee_id())::text
              or ((select private.is_admin())
                  and exists (select 1 from public.employees e
                              where e.id::text = (storage.foldername(name))[1]
                                and e.org_id = (select private.current_org_id())))));

-- 6. Alta de una organización nueva (la ejecuta el operador en el SQL Editor):
--      select private.create_organization('Acme Inc', 'admin@acme.com', 'Jane Admin');
--    Después crea el usuario de Auth con ese email: el trigger lo vincula.
create or replace function private.create_organization(org_name text, admin_email text, admin_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare oid uuid;
begin
  insert into public.organizations (name) values (org_name) returning id into oid;
  insert into public.employees (org_id, name, email, role, hourly_rate, vacation_accrual_rate,
                                paid_pto_limit_hours, hire_date, department)
  values (oid, admin_name, lower(admin_email), 'admin', 0, 0.416, 40, current_date, 'Management');
  return oid;
end $$;
revoke all on function private.create_organization(text, text, text) from public, anon, authenticated;
