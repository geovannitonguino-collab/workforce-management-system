-- ============================================================================
-- Trackly · Fase 0 · Autenticación + Row Level Security
-- Idempotente: se puede ejecutar más de una vez.
-- Ejecutar en: Supabase Dashboard -> SQL Editor (proyecto de PRUEBAS primero).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Esquema privado para funciones auxiliares (PostgREST NO lo expone)
-- ----------------------------------------------------------------------------
create schema if not exists private;

-- ----------------------------------------------------------------------------
-- 1. Columnas nuevas y restricciones de integridad
-- ----------------------------------------------------------------------------
alter table public.employees
  add column if not exists user_id uuid unique references auth.users(id) on delete set null;

alter table public.medical_proofs
  add column if not exists employee_id uuid references public.employees(id) on delete cascade,
  add column if not exists storage_path text;
alter table public.medical_proofs alter column file_data drop not null; -- legado (base64)

alter table public.employees drop constraint if exists employees_role_check;
alter table public.employees add constraint employees_role_check
  check (role in ('employee', 'admin'));

alter table public.time_entries drop constraint if exists time_entries_action_check;
alter table public.time_entries add constraint time_entries_action_check
  check (action in ('clock_in','start_lunch','end_lunch','start_break','end_break','clock_out'));

alter table public.leave_requests drop constraint if exists leave_requests_status_check;
alter table public.leave_requests add constraint leave_requests_status_check
  check (status in ('pending','approved','rejected'));
alter table public.leave_requests drop constraint if exists leave_requests_category_check;
alter table public.leave_requests add constraint leave_requests_category_check
  check (category in ('sick','pto','vacation','personal'));
alter table public.leave_requests drop constraint if exists leave_requests_hours_check;
alter table public.leave_requests add constraint leave_requests_hours_check check (hours > 0);

create index if not exists employees_user_id_idx        on public.employees (user_id);
create index if not exists time_entries_employee_ts_idx on public.time_entries (employee_id, "timestamp");
create index if not exists leave_requests_employee_idx  on public.leave_requests (employee_id);
create index if not exists medical_proofs_employee_idx  on public.medical_proofs (employee_id);

-- ----------------------------------------------------------------------------
-- 2. Funciones auxiliares (SECURITY DEFINER evita recursión de RLS)
-- ----------------------------------------------------------------------------
create or replace function private.current_employee_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.employees where user_id = auth.uid()
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.employees where user_id = auth.uid() and role = 'admin')
$$;

revoke all on function private.current_employee_id() from public, anon;
revoke all on function private.is_admin()            from public, anon;
grant usage   on schema   private                    to authenticated;
grant execute on function private.current_employee_id() to authenticated;
grant execute on function private.is_admin()            to authenticated;

-- default de medical_proofs.employee_id (después de crear la función)
alter table public.medical_proofs
  alter column employee_id set default private.current_employee_id();

-- ----------------------------------------------------------------------------
-- 3. Vincular usuario de Auth -> empleado por email (flujo solo-invitación)
-- ----------------------------------------------------------------------------
create or replace function private.link_employee_on_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.employees
     set user_id = new.id
   where lower(email) = lower(new.email) and user_id is null;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.link_employee_on_signup();

-- ----------------------------------------------------------------------------
-- 4. Permisos a nivel de tabla: anon no tiene NADA
-- ----------------------------------------------------------------------------
revoke all on public.employees, public.time_entries, public.leave_requests, public.medical_proofs from anon;
revoke all on public.employees, public.time_entries, public.leave_requests, public.medical_proofs from authenticated;

grant select, insert, update         on public.employees      to authenticated;
grant select, insert                 on public.time_entries   to authenticated;  -- append-only
grant select, insert, update         on public.leave_requests to authenticated;
grant select, insert, update, delete on public.medical_proofs to authenticated;

-- ----------------------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------------------
alter table public.employees      enable row level security;
alter table public.time_entries   enable row level security;
alter table public.leave_requests enable row level security;
alter table public.medical_proofs enable row level security;

-- Limpia políticas anteriores (incluye las abiertas "allow all" de antes)
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('employees','time_entries','leave_requests','medical_proofs')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- employees: cada quien ve su fila; admin ve y gestiona todas. Nadie borra.
create policy employees_select on public.employees for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy employees_insert on public.employees for insert to authenticated
  with check ((select private.is_admin()));
create policy employees_update on public.employees for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- time_entries: solo propias, solo hacia adelante en el tiempo real (anti-backdating)
create policy time_entries_select on public.time_entries for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_admin()));
create policy time_entries_insert_own on public.time_entries for insert to authenticated
  with check (
    employee_id = (select private.current_employee_id())
    and "timestamp" between now() - interval '10 minutes' and now() + interval '2 minutes'
  );
create policy time_entries_insert_admin on public.time_entries for insert to authenticated
  with check ((select private.is_admin()));

-- leave_requests: el empleado crea solo solicitudes propias en estado pending; solo admin resuelve
create policy leave_select on public.leave_requests for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_admin()));
create policy leave_insert_own on public.leave_requests for insert to authenticated
  with check (employee_id = (select private.current_employee_id()) and status = 'pending');
create policy leave_update_admin on public.leave_requests for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- medical_proofs: datos de salud -> solo el dueño y el admin pueden leer
create policy proofs_select on public.medical_proofs for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_admin()));
create policy proofs_insert on public.medical_proofs for insert to authenticated
  with check (employee_id = (select private.current_employee_id()));
create policy proofs_update on public.medical_proofs for update to authenticated
  using (employee_id = (select private.current_employee_id()))
  with check (employee_id = (select private.current_employee_id()));
create policy proofs_delete on public.medical_proofs for delete to authenticated
  using (employee_id = (select private.current_employee_id()));

-- ----------------------------------------------------------------------------
-- 6. Storage privado para constancias médicas (reemplaza base64 en la tabla)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medical-proofs', 'medical-proofs', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf'];

drop policy if exists medproofs_select on storage.objects;
drop policy if exists medproofs_insert on storage.objects;
drop policy if exists medproofs_update on storage.objects;
drop policy if exists medproofs_delete on storage.objects;

-- Ruta obligatoria: <employee_id>/<archivo>.pdf
create policy medproofs_select on storage.objects for select to authenticated
  using (bucket_id = 'medical-proofs'
         and ((storage.foldername(name))[1] = (select private.current_employee_id())::text
              or (select private.is_admin())));
create policy medproofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'medical-proofs'
              and (storage.foldername(name))[1] = (select private.current_employee_id())::text);
create policy medproofs_update on storage.objects for update to authenticated
  using (bucket_id = 'medical-proofs'
         and (storage.foldername(name))[1] = (select private.current_employee_id())::text);
create policy medproofs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'medical-proofs'
         and (storage.foldername(name))[1] = (select private.current_employee_id())::text);

-- ----------------------------------------------------------------------------
-- 7. PASO MANUAL tras ejecutar esto (no se puede automatizar sin saber tu email):
--    a) Authentication -> Users -> "Add user" / "Invite user" con tu email.
--    b) El trigger lo vincula a la fila de employees con el mismo email.
--    c) Asegúrate de que esa fila tenga role = 'admin':
--         update public.employees set role = 'admin' where lower(email) = lower('TU_EMAIL');
--    d) Authentication -> Sign In / Providers -> desactiva "Allow new users to sign up".
-- ----------------------------------------------------------------------------
