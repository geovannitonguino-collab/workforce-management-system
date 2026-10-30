-- ============================================================================
-- Trackly · Roles (director / manager / employee) y departamentos
-- Ver docs/PERMISSIONS_AND_CONTRACT.md. Idempotente.
--
-- Modelo:
--   director  = todo dentro de su empresa (lo que antes era 'admin')
--   manager   = edita y aprueba SOLO a los empleados de los departamentos que dirige;
--               en el resto de la empresa solo ve asistencia y permisos (sin sueldos ni constancias)
--   employee  = solo lo suyo
-- private.is_admin() pasa a significar "es director", así que todas las políticas
-- existentes de "admin" (facturación, red de fichaje, bitácora, etc.) siguen siendo solo-director.
-- ============================================================================

-- 1. Departamentos ----------------------------------------------------------
create table if not exists public.departments (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null default private.current_org_id() references public.organizations(id) on delete cascade,
  name                text not null check (length(trim(name)) between 1 and 80),
  manager_employee_id uuid references public.employees(id) on delete set null,
  created_at          timestamptz not null default now()
);
create unique index if not exists departments_org_name_uniq on public.departments (org_id, lower(name));
create index if not exists departments_manager_idx on public.departments (manager_employee_id);
alter table public.departments enable row level security;

alter table public.employees
  add column if not exists department_id uuid references public.departments(id) on delete set null;

-- Correo personal: dato de RR. HH. (emergencias, comunicaciones de contratación). NO es el del login.
-- El correo corporativo (columna email) es el del login y solo lo cambia un director.
alter table public.employees add column if not exists personal_email text;
alter table public.employees drop constraint if exists employees_personal_email_format;
alter table public.employees add constraint employees_personal_email_format
  check (personal_email is null or personal_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
create index if not exists employees_department_idx on public.employees (department_id);

-- Roles nuevos: 'admin' -> 'director'
alter table public.employees drop constraint if exists employees_role_check;
update public.employees set role = 'director' where role = 'admin';
alter table public.employees add constraint employees_role_check check (role in ('director','manager','employee'));

-- Backfill: un departamento por cada nombre de texto existente
insert into public.departments (org_id, name)
select distinct e.org_id, trim(e.department)
from public.employees e
where e.department is not null and length(trim(e.department)) > 0
on conflict do nothing;

update public.employees e
   set department_id = d.id
  from public.departments d
 where e.department_id is null and d.org_id = e.org_id and lower(d.name) = lower(trim(e.department));

-- 2. Helpers de rol ---------------------------------------------------------
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.employees where user_id = auth.uid() and role in ('director','admin'))
$$;

create or replace function private.is_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.employees where user_id = auth.uid() and role = 'manager')
$$;

-- ¿El usuario en sesión es el manager del departamento de este empleado?
-- Un director nunca queda "bajo" un manager, aunque figure en su departamento.
create or replace function private.manages_employee(p_emp uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.employees e
    join public.departments d on d.id = e.department_id
    join public.employees m   on m.id = d.manager_employee_id
    where e.id = p_emp
      and e.role <> 'director'
      and m.user_id = auth.uid()
      and m.role = 'manager'
      and m.org_id = e.org_id
  )
$$;

-- Director de la misma empresa, o manager de ese empleado
create or replace function private.can_manage_employee(p_emp uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.manages_employee(p_emp)
      or (private.is_admin() and exists (select 1 from public.employees where id = p_emp and org_id = private.current_org_id()))
$$;

revoke all on function private.is_manager(), private.manages_employee(uuid), private.can_manage_employee(uuid) from public, anon;
grant execute on function private.is_manager(), private.manages_employee(uuid), private.can_manage_employee(uuid) to authenticated;

-- 3. Permisos de tabla ------------------------------------------------------
revoke all on public.departments from anon;
revoke all on public.departments from authenticated;
grant select, insert, update, delete on public.departments to authenticated;

-- 4. Validaciones y protecciones (triggers) --------------------------------
-- El manager de un departamento debe ser un empleado con rol 'manager' de la misma empresa
create or replace function private.validate_department()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.manager_employee_id is not null and not exists (
       select 1 from public.employees e
       where e.id = new.manager_employee_id and e.org_id = new.org_id and e.role = 'manager') then
    raise exception 'the department head must be an employee with the manager role in this organization';
  end if;
  return new;
end $$;
drop trigger if exists departments_validate on public.departments;
create trigger departments_validate before insert or update on public.departments
  for each row execute function private.validate_department();

-- Quién puede cambiar qué en un empleado.
--  * Nadie, desde la app, puede cambiar la empresa (org_id) de una fila ni el vínculo de login (user_id):
--    es la garantía de aislamiento entre empresas.
--  * El director cambia todo lo demás dentro de su empresa.
--  * El manager, sobre las personas de su estructura (las que le permite la política de la tabla): puede cambiar
--    su correo PERSONAL y su rol entre Employee y Manager (ascender/descender), pero no el correo corporativo
--    (el del login), ni crear directores, ni moverlas de departamento. A sí mismo no se puede editar.
-- SIN security definer: current_user = 'authenticated' solo en llamadas directas del cliente.
create or replace function private.protect_employee_columns()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if new.org_id  is distinct from old.org_id  then raise exception 'organization cannot be changed'; end if;
    if new.user_id is distinct from old.user_id then raise exception 'login link cannot be changed'; end if;
    if not private.is_admin() then
      if new.department_id is distinct from old.department_id then
        raise exception 'only a director can move people between departments';
      end if;
      if lower(new.email) is distinct from lower(old.email) then
        raise exception 'only a director can change the corporate (login) email';
      end if;
      if new.role is distinct from old.role
         and (old.role not in ('employee','manager') or new.role not in ('employee','manager')) then
        raise exception 'a manager can only set the role to Employee or Manager';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists employees_protect_cols on public.employees;
create trigger employees_protect_cols before update on public.employees
  for each row execute function private.protect_employee_columns();

-- Siempre debe quedar al menos un director por empresa
create or replace function private.keep_one_director()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'director' and (tg_op = 'DELETE' or new.role <> 'director')
     and not exists (select 1 from public.employees e where e.org_id = old.org_id and e.role = 'director' and e.id <> old.id) then
    raise exception 'an organization must keep at least one director';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists employees_keep_director on public.employees;
create trigger employees_keep_director before update or delete on public.employees
  for each row execute function private.keep_one_director();

-- Si alguien deja de ser manager, deja de dirigir sus departamentos
create or replace function private.clear_manager_on_demotion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'manager' and new.role <> 'manager' then
    update public.departments set manager_employee_id = null where manager_employee_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists employees_clear_manager on public.employees;
create trigger employees_clear_manager after update on public.employees
  for each row execute function private.clear_manager_on_demotion();

-- La bitácora también registra el cambio de departamento
create or replace function private.audit_employee()
returns trigger language plpgsql security definer set search_path = '' as $$
declare keys text[] := array['role','hourly_rate','vacation_accrual_rate','paid_pto_limit_hours','hire_date','department','department_id','email','personal_email','name'];
        k text; changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
    values (new.org_id, private.current_employee_id(), 'employee.created', 'employee', new.id,
            jsonb_build_object('name', new.name, 'email', new.email, 'role', new.role));
  else
    foreach k in array keys loop
      if to_jsonb(old) -> k is distinct from to_jsonb(new) -> k then
        changes := changes || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(old) -> k, 'to', to_jsonb(new) -> k));
      end if;
    end loop;
    if changes <> '{}'::jsonb then
      insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
      values (new.org_id, private.current_employee_id(), 'employee.updated', 'employee', new.id, changes);
    end if;
  end if;
  return null;
end $$;

-- 5. Políticas --------------------------------------------------------------
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('departments','employees','time_entries','leave_requests','medical_proofs','time_corrections')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- departments: todos los de la empresa ven los nombres; solo el director los gestiona
create policy dept_select on public.departments for select to authenticated
  using (org_id = (select private.current_org_id()));
create policy dept_insert on public.departments for insert to authenticated
  with check (org_id = (select private.current_org_id()) and (select private.is_admin()));
create policy dept_update on public.departments for update to authenticated
  using (org_id = (select private.current_org_id()) and (select private.is_admin()))
  with check (org_id = (select private.current_org_id()) and (select private.is_admin()));
create policy dept_delete on public.departments for delete to authenticated
  using (org_id = (select private.current_org_id()) and (select private.is_admin()));

-- employees: ve su fila, el director ve todos, el manager ve a su equipo (las tarifas viven aquí)
create policy employees_select on public.employees for select to authenticated
  using (
    org_id = (select private.current_org_id())
    and (
      user_id = (select auth.uid())
      or (select private.is_admin())
      or (select private.manages_employee(id))
      -- igual que manages_employee pero con las columnas de la propia fila: necesario para que
      -- "insert ... returning" funcione cuando un manager da de alta a alguien de su equipo
      or (role <> 'director'
          and department_id is not null
          and exists (select 1 from public.departments d
                      where d.id = department_id
                        and d.manager_employee_id = (select private.current_employee_id())))
    )
  );
create policy employees_insert on public.employees for insert to authenticated
  with check (
    org_id = (select private.current_org_id())
    and user_id is null
    and ((select private.is_admin())
         or ((select private.is_manager())
             and role = 'employee'
             and department_id is not null
             and exists (select 1 from public.departments d
                         where d.id = department_id and d.manager_employee_id = (select private.current_employee_id())))));
create policy employees_update on public.employees for update to authenticated
  using (org_id = (select private.current_org_id())
         and ((select private.is_admin())
              or ((select private.manages_employee(id)) and id <> (select private.current_employee_id()))))
  with check (org_id = (select private.current_org_id())
         and ((select private.is_admin())
              or ((select private.manages_employee(id)) and id <> (select private.current_employee_id()))));

-- time_entries: lo propio; director y cualquier manager ven (solo lectura) a toda la empresa
create policy time_entries_select on public.time_entries for select to authenticated
  using (org_id = (select private.current_org_id())
         and (employee_id = (select private.current_employee_id()) or (select private.is_admin()) or (select private.is_manager())));
create policy time_entries_insert_own on public.time_entries for insert to authenticated
  with check (org_id = (select private.current_org_id())
              and employee_id = (select private.current_employee_id())
              and "timestamp" between now() - interval '10 minutes' and now() + interval '2 minutes');
create policy time_entries_insert_admin on public.time_entries for insert to authenticated
  with check (org_id = (select private.current_org_id()) and (select private.is_admin()));

-- leave_requests: ver como time_entries; aprobar solo director o manager del empleado (nunca su propia solicitud siendo manager)
create policy leave_select on public.leave_requests for select to authenticated
  using (org_id = (select private.current_org_id())
         and (employee_id = (select private.current_employee_id()) or (select private.is_admin()) or (select private.is_manager())));
create policy leave_insert_own on public.leave_requests for insert to authenticated
  with check (org_id = (select private.current_org_id())
              and employee_id = (select private.current_employee_id()) and status = 'pending');
create policy leave_update on public.leave_requests for update to authenticated
  using (org_id = (select private.current_org_id())
         and ((select private.is_admin())
              or ((select private.manages_employee(employee_id)) and employee_id <> (select private.current_employee_id()))))
  with check (org_id = (select private.current_org_id())
         and ((select private.is_admin())
              or ((select private.manages_employee(employee_id)) and employee_id <> (select private.current_employee_id()))));

-- medical_proofs: el dueño, el director y el manager del empleado
create policy proofs_select on public.medical_proofs for select to authenticated
  using (org_id = (select private.current_org_id())
         and (employee_id = (select private.current_employee_id()) or (select private.can_manage_employee(employee_id))));
create policy proofs_insert on public.medical_proofs for insert to authenticated
  with check (org_id = (select private.current_org_id()) and employee_id = (select private.current_employee_id()));
create policy proofs_update on public.medical_proofs for update to authenticated
  using (org_id = (select private.current_org_id()) and employee_id = (select private.current_employee_id()))
  with check (org_id = (select private.current_org_id()) and employee_id = (select private.current_employee_id()));
create policy proofs_delete on public.medical_proofs for delete to authenticated
  using (org_id = (select private.current_org_id()) and employee_id = (select private.current_employee_id()));

-- Storage de constancias: dueño, director o manager del empleado
drop policy if exists medproofs_select on storage.objects;
create policy medproofs_select on storage.objects for select to authenticated
  using (bucket_id = 'medical-proofs'
         and ((storage.foldername(name))[1] = (select private.current_employee_id())::text
              or case when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
                      then private.can_manage_employee(((storage.foldername(name))[1])::uuid)
                      else false end));

-- time_corrections: el empleado ve las suyas; director y manager ven las de su alcance
create policy corr_select on public.time_corrections for select to authenticated
  using (org_id = (select private.current_org_id())
         and (employee_id = (select private.current_employee_id()) or (select private.can_manage_employee(employee_id))));
create policy corr_insert on public.time_corrections for insert to authenticated
  with check (org_id = (select private.current_org_id())
              and employee_id = (select private.current_employee_id())
              and status = 'pending' and resolved_by is null);

-- 6. Resolver correcciones: director, o manager del empleado (nunca la suya si es manager)
create or replace function public.resolve_time_correction(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c   public.time_corrections%rowtype;
  me  uuid := private.current_employee_id();
  org uuid := private.current_org_id();
  old public.time_entries%rowtype;
  new_id uuid;
begin
  select * into c from public.time_corrections where id = p_id and org_id = org and status = 'pending' for update;
  if not found then raise exception 'correction not found or already resolved'; end if;
  if not (private.is_admin() or (private.manages_employee(c.employee_id) and c.employee_id <> me)) then
    raise exception 'not allowed to resolve this correction';
  end if;

  if p_approve then
    if c.kind in ('edit','void') then
      select * into old from public.time_entries where id = c.entry_id and org_id = org and voided_at is null for update;
      if not found then raise exception 'original entry no longer active'; end if;
      update public.time_entries set voided_at = now(), voided_by = me, correction_id = c.id where id = old.id;
    end if;
    if c.kind = 'add' then
      insert into public.time_entries (org_id, employee_id, action, "timestamp", date, correction_id)
      values (org, c.employee_id, c.action, c.requested_timestamp, c.requested_date, c.id) returning id into new_id;
    elsif c.kind = 'edit' then
      insert into public.time_entries (org_id, employee_id, action, "timestamp", date, correction_id)
      values (org, c.employee_id, old.action, c.requested_timestamp, c.requested_date, c.id) returning id into new_id;
    end if;
  end if;

  update public.time_corrections
     set status = case when p_approve then 'approved' else 'rejected' end,
         resolved_by = me, resolved_at = now(), resolution_note = nullif(trim(coalesce(p_note, '')), '')
   where id = c.id;

  insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
  values (org, me, case when p_approve then 'correction.approved' else 'correction.rejected' end,
          'time_correction', c.id,
          jsonb_build_object('kind', c.kind, 'employee_id', c.employee_id, 'entry_id', c.entry_id,
                             'new_entry_id', new_id, 'requested_timestamp', c.requested_timestamp,
                             'original_timestamp', old.timestamp, 'reason', c.reason, 'note', p_note));
end $$;
revoke all on function public.resolve_time_correction(uuid, boolean, text) from public, anon;
grant execute on function public.resolve_time_correction(uuid, boolean, text) to authenticated;

-- 7. Directorio de la empresa (sin tarifas): para que los managers vean a los demás equipos
create or replace view public.employee_directory with (security_invoker = false) as
  select e.id, e.name, e.department_id, e.role
  from public.employees e
  where e.org_id = private.current_org_id() and (private.is_admin() or private.is_manager());
revoke all on public.employee_directory from anon, authenticated;
grant select on public.employee_directory to authenticated;

-- 8. Altas de organización: el primer usuario es director
create or replace function private.create_organization(org_name text, admin_email text, admin_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare oid uuid; td int;
begin
  insert into public.organizations (name) values (org_name) returning id into oid;
  select trial_days into td from public.plans where id = 'trial';
  insert into public.subscriptions (org_id, plan_id, status, trial_ends_at)
  values (oid, 'trial', 'trialing', now() + make_interval(days => coalesce(td, 14)));
  insert into public.employees (org_id, name, email, role, hourly_rate, vacation_accrual_rate,
                                paid_pto_limit_hours, hire_date, department)
  values (oid, admin_name, lower(admin_email), 'director', 0, 0.416, 40, current_date, 'Management');
  return oid;
end $$;
revoke all on function private.create_organization(text, text, text) from public, anon, authenticated;
