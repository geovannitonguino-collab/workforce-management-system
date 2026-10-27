-- ============================================================================
-- Trackly · Fase 1 · Correcciones de tiempo + bitácora de auditoría
-- Idempotente. time_entries sigue siendo "solo se agrega": una corrección
-- aprobada ANULA la fila original (voided_at) y, si aplica, agrega una nueva.
-- Nada se borra ni se edita en silencio; todo queda en audit_log.
-- ============================================================================

-- 1. time_entries: marcas de anulación ---------------------------------------
alter table public.time_entries
  add column if not exists voided_at     timestamptz,
  add column if not exists voided_by     uuid references public.employees(id),
  add column if not exists correction_id uuid;

-- 2. Bitácora ---------------------------------------------------------------
create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id),
  actor_id   uuid references public.employees(id),   -- null = operador (SQL Editor)
  event      text not null,
  entity     text not null,
  entity_id  uuid,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_org_created_idx on public.audit_log (org_id, created_at desc);
alter table public.audit_log enable row level security;

-- 3. Solicitudes de corrección ---------------------------------------------
create table if not exists public.time_corrections (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null default private.current_org_id() references public.organizations(id),
  employee_id         uuid not null references public.employees(id) on delete cascade,
  kind                text not null check (kind in ('add','edit','void')),
  entry_id            uuid references public.time_entries(id),
  action              text check (action in ('clock_in','start_lunch','end_lunch','start_break','end_break','clock_out')),
  requested_timestamp timestamptz,
  requested_date      date,
  reason              text not null check (length(trim(reason)) >= 5),
  status              text not null default 'pending' check (status in ('pending','approved','rejected')),
  resolved_by         uuid references public.employees(id),
  resolved_at         timestamptz,
  resolution_note     text,
  created_at          timestamptz not null default now(),
  constraint corr_shape check (
    (kind = 'add'  and action is not null and requested_timestamp is not null and requested_date is not null and entry_id is null) or
    (kind = 'edit' and entry_id is not null and requested_timestamp is not null and requested_date is not null) or
    (kind = 'void' and entry_id is not null)
  ),
  constraint corr_not_future check (requested_timestamp is null or requested_timestamp <= now() + interval '5 minutes')
);
create index if not exists time_corrections_org_status_idx on public.time_corrections (org_id, status);
create index if not exists time_corrections_employee_idx   on public.time_corrections (employee_id);
alter table public.time_corrections enable row level security;

-- La solicitud debe ser coherente: mismo empleado/organización y entrada vigente
create or replace function private.validate_correction()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.employees e where e.id = new.employee_id and e.org_id = new.org_id) then
    raise exception 'employee does not belong to this organization';
  end if;
  if new.entry_id is not null and not exists (
       select 1 from public.time_entries t
       where t.id = new.entry_id and t.employee_id = new.employee_id and t.org_id = new.org_id and t.voided_at is null) then
    raise exception 'entry not found, already voided, or not yours';
  end if;
  if new.requested_timestamp is not null and new.requested_timestamp < now() - interval '60 days' then
    raise exception 'corrections older than 60 days are not allowed';
  end if;
  return new;
end $$;
drop trigger if exists time_corrections_validate on public.time_corrections;
create trigger time_corrections_validate before insert on public.time_corrections
  for each row execute function private.validate_correction();

-- 4. Permisos y políticas ---------------------------------------------------
revoke all on public.time_corrections, public.audit_log from anon;
revoke all on public.time_corrections, public.audit_log from authenticated;
grant select, insert on public.time_corrections to authenticated;  -- sin update/delete: se resuelve por RPC
grant select         on public.audit_log          to authenticated;

do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('time_corrections','audit_log')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy corr_select on public.time_corrections for select to authenticated
  using (org_id = (select private.current_org_id())
         and (employee_id = (select private.current_employee_id()) or (select private.is_admin())));
create policy corr_insert on public.time_corrections for insert to authenticated
  with check (org_id = (select private.current_org_id())
              and employee_id = (select private.current_employee_id())
              and status = 'pending' and resolved_by is null);
create policy audit_select on public.audit_log for select to authenticated
  using (org_id = (select private.current_org_id()) and (select private.is_admin()));

-- 5. Resolver una corrección (única vía de escritura sobre time_entries) -----
create or replace function public.resolve_time_correction(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c   public.time_corrections%rowtype;
  me  uuid := private.current_employee_id();
  org uuid := private.current_org_id();
  old public.time_entries%rowtype;
  new_id uuid;
begin
  if not private.is_admin() then raise exception 'admin only'; end if;
  select * into c from public.time_corrections where id = p_id and org_id = org and status = 'pending' for update;
  if not found then raise exception 'correction not found or already resolved'; end if;

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

-- 6. Triggers de auditoría --------------------------------------------------
create or replace function private.audit_employee()
returns trigger language plpgsql security definer set search_path = '' as $$
declare keys text[] := array['role','hourly_rate','vacation_accrual_rate','paid_pto_limit_hours','hire_date','department','email','name'];
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
drop trigger if exists employees_audit on public.employees;
create trigger employees_audit after insert or update on public.employees
  for each row execute function private.audit_employee();

create or replace function private.audit_leave()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status or old.is_paid is distinct from new.is_paid
     or old.unpaid_hours is distinct from new.unpaid_hours then
    insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
    values (new.org_id, private.current_employee_id(), 'leave.updated', 'leave_request', new.id,
            jsonb_build_object('employee_id', new.employee_id,
                               'status', jsonb_build_object('from', old.status, 'to', new.status),
                               'is_paid', jsonb_build_object('from', old.is_paid, 'to', new.is_paid),
                               'unpaid_hours', jsonb_build_object('from', old.unpaid_hours, 'to', new.unpaid_hours)));
  end if;
  return null;
end $$;
drop trigger if exists leave_audit on public.leave_requests;
create trigger leave_audit after update on public.leave_requests
  for each row execute function private.audit_leave();

create or replace function private.audit_correction_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
  values (new.org_id, private.current_employee_id(), 'correction.requested', 'time_correction', new.id,
          jsonb_build_object('kind', new.kind, 'employee_id', new.employee_id, 'entry_id', new.entry_id,
                             'requested_timestamp', new.requested_timestamp, 'reason', new.reason));
  return null;
end $$;
drop trigger if exists correction_request_audit on public.time_corrections;
create trigger correction_request_audit after insert on public.time_corrections
  for each row execute function private.audit_correction_request();
