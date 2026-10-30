-- ============================================================================
-- Trackly · Contratos con historial, comisiones/ajustes, festivos y ajustes de empresa
--
-- Principio: el sistema no trae reglas propias. Cada persona tiene un contrato (con versiones por fecha
-- de inicio) donde la empresa escribe lo que paga; el motor de cálculo solo aplica eso.
--
-- Quién puede qué:
--   * El empleado ve SU contrato y SUS ajustes.
--   * El director y el manager del equipo ven y cargan contratos/ajustes de las personas de su alcance.
--   * Nadie edita su propio contrato ni sus propios ajustes, salvo el director.
--   * Los festivos y la zona horaria los ven todos en la empresa (hacen falta para el cálculo);
--     solo el director los cambia.
-- Idempotente.
-- ============================================================================

-- 1. Ajustes de empresa: zona horaria, país, moneda por defecto --------------
alter table public.organizations
  add column if not exists time_zone        text not null default 'UTC',
  add column if not exists country          text,
  add column if not exists default_currency text;

update public.organizations set time_zone = 'America/Bogota', country = 'Colombia'
 where id = '00000000-0000-4000-8000-000000000001' and time_zone = 'UTC';

-- columnas legibles para cualquier miembro (las IP de red siguen ocultas)
revoke select on public.organizations from authenticated;
grant  select (id, name, created_at, time_zone, country, default_currency) on public.organizations to authenticated;

create or replace function public.set_org_settings(p_time_zone text, p_country text, p_currency text)
returns void language plpgsql security definer set search_path = '' as $$
declare org uuid := private.current_org_id();
begin
  if not private.is_admin() then raise exception 'admin only'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'unknown time zone: %', left(coalesce(p_time_zone, ''), 60);
  end if;
  if p_currency is not null and p_currency !~ '^[A-Za-z]{3}$' then raise exception 'currency must be a 3-letter code'; end if;
  update public.organizations
     set time_zone = p_time_zone,
         country = nullif(left(trim(coalesce(p_country, '')), 60), ''),
         default_currency = upper(p_currency)
   where id = org;
  insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
  values (org, private.current_employee_id(), 'org_settings.updated', 'organization', org,
          jsonb_build_object('time_zone', p_time_zone, 'country', p_country, 'currency', upper(p_currency)));
end $$;
revoke all on function public.set_org_settings(text, text, text) from public, anon;
grant execute on function public.set_org_settings(text, text, text) to authenticated;

-- 2. Festivos de la empresa ---------------------------------------------------
create table if not exists public.org_holidays (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null default private.current_org_id() references public.organizations(id) on delete cascade,
  date    date not null,
  name    text not null default '' check (length(name) <= 100),
  unique (org_id, date)
);
alter table public.org_holidays enable row level security;

-- 3. Contratos (versiones) ----------------------------------------------------
create table if not exists public.employee_contracts (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null default private.current_org_id() references public.organizations(id) on delete cascade,
  employee_id            uuid not null references public.employees(id) on delete cascade,
  effective_from         date not null,
  end_date               date,
  relationship           text not null default 'contractor' check (relationship in ('contractor','employee')),
  contract_type          text not null default '' check (length(contract_type) <= 80),
  pay_type               text not null check (pay_type in ('hourly','fixed')),
  pay_period             text not null default 'monthly' check (pay_period in ('weekly','biweekly','semimonthly','monthly')),
  amount                 numeric(14,4) not null default 0 check (amount >= 0),
  currency               text not null check (currency ~ '^[A-Z]{3}$'),
  schedule               jsonb not null default '{"0":0,"1":8,"2":8,"3":8,"4":8,"5":8,"6":0}'::jsonb,
  max_daily_hours        numeric(5,2) check (max_daily_hours is null or (max_daily_hours > 0 and max_daily_hours <= 24)),
  tracks_time            boolean not null default true,
  overtime_eligible      boolean not null default false,
  overtime_basis         text not null default 'none' check (overtime_basis in ('schedule','fixed','none')),
  overtime_daily_hours   numeric(5,2) check (overtime_daily_hours is null or (overtime_daily_hours >= 0 and overtime_daily_hours <= 24)),
  overtime_weekly_hours  numeric(6,2) check (overtime_weekly_hours is null or (overtime_weekly_hours >= 0 and overtime_weekly_hours <= 168)),
  night_start            text not null default '21:00' check (night_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  night_end              text not null default '06:00' check (night_end   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  holiday_weekdays       int[] not null default '{0}',
  surcharges             jsonb not null default '{}'::jsonb,
  monthly_hours_divisor  numeric(8,2) check (monthly_hours_divisor is null or monthly_hours_divisor > 0),
  unpaid_day_divisor     numeric(6,2) not null default 30 check (unpaid_day_divisor > 0),
  vacation_days_per_month numeric(6,3) not null default 0 check (vacation_days_per_month >= 0),
  pto_hours_per_year     numeric(7,2) not null default 0 check (pto_hours_per_year >= 0),
  note                   text check (note is null or length(note) <= 500),
  created_by             uuid references public.employees(id) on delete set null,
  created_at             timestamptz not null default now(),
  unique (employee_id, effective_from),
  constraint contract_dates check (end_date is null or end_date >= effective_from)
);
create index if not exists employee_contracts_employee_idx on public.employee_contracts (employee_id, effective_from);
create index if not exists employee_contracts_org_idx      on public.employee_contracts (org_id);
alter table public.employee_contracts enable row level security;

create or replace function private.validate_contract()
returns trigger language plpgsql security definer set search_path = '' as $$
declare k text; v jsonb; w int;
begin
  if not exists (select 1 from public.employees e where e.id = new.employee_id and e.org_id = new.org_id) then
    raise exception 'employee does not belong to this organization';
  end if;
  if jsonb_typeof(new.schedule) <> 'object' then raise exception 'schedule must be an object'; end if;
  for k in select generate_series(0, 6)::text loop
    v := new.schedule -> k;
    if v is null or jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0 or (v #>> '{}')::numeric > 24 then
      raise exception 'invalid schedule hours for weekday %', k;
    end if;
  end loop;
  if jsonb_typeof(new.surcharges) <> 'object' then raise exception 'surcharges must be an object'; end if;
  for k, v in select key, value from jsonb_each(new.surcharges) loop
    if k not in ('night','holiday','holidayNight','otDay','otNight','otHolidayDay','otHolidayNight') then
      raise exception 'unknown surcharge %', left(k, 40);
    end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0 or (v #>> '{}')::numeric > 1000 then
      raise exception 'surcharge % must be a number between 0 and 1000', k;
    end if;
  end loop;
  foreach w in array new.holiday_weekdays loop
    if w < 0 or w > 6 then raise exception 'holiday weekdays must be between 0 (Sunday) and 6'; end if;
  end loop;
  return new;
end $$;
drop trigger if exists employee_contracts_validate on public.employee_contracts;
create trigger employee_contracts_validate before insert or update on public.employee_contracts
  for each row execute function private.validate_contract();

-- 4. Comisiones, bonos, reembolsos, descuentos ---------------------------------
create table if not exists public.pay_adjustments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null default private.current_org_id() references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  date        date not null,
  kind        text not null check (kind in ('commission','bonus','reimbursement','deduction')),
  amount      numeric(14,4) not null check (amount > 0),
  note        text check (note is null or length(note) <= 300),
  created_by  uuid references public.employees(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists pay_adjustments_employee_idx on public.pay_adjustments (employee_id, date);
create index if not exists pay_adjustments_org_idx      on public.pay_adjustments (org_id);
alter table public.pay_adjustments enable row level security;

create or replace function private.validate_adjustment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.employees e where e.id = new.employee_id and e.org_id = new.org_id) then
    raise exception 'employee does not belong to this organization';
  end if;
  return new;
end $$;
drop trigger if exists pay_adjustments_validate on public.pay_adjustments;
create trigger pay_adjustments_validate before insert or update on public.pay_adjustments
  for each row execute function private.validate_adjustment();

-- quién lo creó (siempre la persona en sesión; el cliente no lo decide)
create or replace function private.set_created_by()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null then new.created_by := private.current_employee_id(); end if;
  return new;
end $$;
drop trigger if exists employee_contracts_created_by on public.employee_contracts;
create trigger employee_contracts_created_by before insert on public.employee_contracts
  for each row execute function private.set_created_by();
drop trigger if exists pay_adjustments_created_by on public.pay_adjustments;
create trigger pay_adjustments_created_by before insert on public.pay_adjustments
  for each row execute function private.set_created_by();

-- 5. Permisos de tabla y políticas ---------------------------------------------
revoke all on public.employee_contracts, public.pay_adjustments, public.org_holidays from anon;
revoke all on public.employee_contracts, public.pay_adjustments, public.org_holidays from authenticated;
grant select, insert, update         on public.employee_contracts to authenticated;   -- sin borrar: el historial se conserva
grant select, insert, update, delete on public.pay_adjustments    to authenticated;
grant select, insert, update, delete on public.org_holidays       to authenticated;

do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('employee_contracts','pay_adjustments','org_holidays')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- contratos
create policy contracts_select on public.employee_contracts for select to authenticated
  using (org_id = (select private.current_org_id())
         and (employee_id = (select private.current_employee_id()) or (select private.can_manage_employee(employee_id))));
create policy contracts_insert on public.employee_contracts for insert to authenticated
  with check (org_id = (select private.current_org_id())
              and (select private.can_manage_employee(employee_id))
              and (employee_id <> (select private.current_employee_id()) or (select private.is_admin())));
create policy contracts_update on public.employee_contracts for update to authenticated
  using (org_id = (select private.current_org_id())
         and (select private.can_manage_employee(employee_id))
         and (employee_id <> (select private.current_employee_id()) or (select private.is_admin())))
  with check (org_id = (select private.current_org_id())
         and (select private.can_manage_employee(employee_id))
         and (employee_id <> (select private.current_employee_id()) or (select private.is_admin())));

-- ajustes (comisiones, etc.)
create policy adjustments_select on public.pay_adjustments for select to authenticated
  using (org_id = (select private.current_org_id())
         and (employee_id = (select private.current_employee_id()) or (select private.can_manage_employee(employee_id))));
create policy adjustments_insert on public.pay_adjustments for insert to authenticated
  with check (org_id = (select private.current_org_id())
              and (select private.can_manage_employee(employee_id))
              and (employee_id <> (select private.current_employee_id()) or (select private.is_admin())));
create policy adjustments_update on public.pay_adjustments for update to authenticated
  using (org_id = (select private.current_org_id())
         and (select private.can_manage_employee(employee_id))
         and (employee_id <> (select private.current_employee_id()) or (select private.is_admin())))
  with check (org_id = (select private.current_org_id())
         and (select private.can_manage_employee(employee_id))
         and (employee_id <> (select private.current_employee_id()) or (select private.is_admin())));
create policy adjustments_delete on public.pay_adjustments for delete to authenticated
  using (org_id = (select private.current_org_id())
         and (select private.can_manage_employee(employee_id))
         and (employee_id <> (select private.current_employee_id()) or (select private.is_admin())));

-- festivos: todos los de la empresa leen; solo el director escribe
create policy holidays_select on public.org_holidays for select to authenticated
  using (org_id = (select private.current_org_id()));
create policy holidays_insert on public.org_holidays for insert to authenticated
  with check (org_id = (select private.current_org_id()) and (select private.is_admin()));
create policy holidays_update on public.org_holidays for update to authenticated
  using (org_id = (select private.current_org_id()) and (select private.is_admin()))
  with check (org_id = (select private.current_org_id()) and (select private.is_admin()));
create policy holidays_delete on public.org_holidays for delete to authenticated
  using (org_id = (select private.current_org_id()) and (select private.is_admin()));

-- 6. Bitácora de cambios de dinero ----------------------------------------------
create or replace function private.audit_contract()
returns trigger language plpgsql security definer set search_path = '' as $$
declare k text; changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
    values (new.org_id, private.current_employee_id(), 'contract.created', 'employee_contract', new.id,
            jsonb_build_object('employee_id', new.employee_id, 'effective_from', new.effective_from,
                               'pay_type', new.pay_type, 'pay_period', new.pay_period,
                               'amount', new.amount, 'currency', new.currency));
  else
    for k in select jsonb_object_keys(to_jsonb(new)) loop
      if k <> 'created_at' and to_jsonb(old) -> k is distinct from to_jsonb(new) -> k then
        changes := changes || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(old) -> k, 'to', to_jsonb(new) -> k));
      end if;
    end loop;
    if changes <> '{}'::jsonb then
      insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
      values (new.org_id, private.current_employee_id(), 'contract.updated', 'employee_contract', new.id,
              jsonb_build_object('employee_id', new.employee_id) || jsonb_build_object('changes', changes));
    end if;
  end if;
  return null;
end $$;
drop trigger if exists employee_contracts_audit on public.employee_contracts;
create trigger employee_contracts_audit after insert or update on public.employee_contracts
  for each row execute function private.audit_contract();

create or replace function private.audit_adjustment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.pay_adjustments;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
  values (r.org_id, private.current_employee_id(),
          case tg_op when 'INSERT' then 'adjustment.created' when 'UPDATE' then 'adjustment.updated' else 'adjustment.deleted' end,
          'pay_adjustment', r.id,
          jsonb_build_object('employee_id', r.employee_id, 'date', r.date, 'kind', r.kind, 'amount', r.amount));
  return null;
end $$;
drop trigger if exists pay_adjustments_audit on public.pay_adjustments;
create trigger pay_adjustments_audit after insert or update or delete on public.pay_adjustments
  for each row execute function private.audit_adjustment();

-- 7. Primer contrato para las personas que ya existen (con lo que tenían cargado) ------------
insert into public.employee_contracts
  (org_id, employee_id, effective_from, relationship, contract_type, pay_type, pay_period, amount, currency,
   vacation_days_per_month, pto_hours_per_year, note)
select e.org_id, e.id, coalesce(nullif(e.hire_date::text, '')::date, current_date), 'employee', 'Migrated from previous settings',
       'hourly', 'monthly', coalesce(e.hourly_rate, 0), 'USD',
       coalesce(e.vacation_accrual_rate, 0), coalesce(e.paid_pto_limit_hours, 0),
       'Created automatically from the previous hourly rate, vacation accrual and PTO limit.'
from public.employees e
where not exists (select 1 from public.employee_contracts c where c.employee_id = e.id);
