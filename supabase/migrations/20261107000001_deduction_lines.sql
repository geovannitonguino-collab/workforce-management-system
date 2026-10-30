-- ============================================================================
-- Descuentos y aportes configurables por contrato (impuestos, seguridad social, préstamos...).
-- Trackly no trae tablas legales: la empresa escribe el nombre y el porcentaje o monto de cada línea.
-- Idempotente. Reemplaza la validación del contrato para incluir las líneas nuevas.
-- ============================================================================

alter table public.employee_contracts
  add column if not exists deduction_lines jsonb not null default '[]'::jsonb;

create or replace function private.validate_contract()
returns trigger language plpgsql security definer set search_path = '' as $$
declare k text; v jsonb; w int; d jsonb;
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

  -- deducciones y aportes definidos por la empresa
  if jsonb_typeof(new.deduction_lines) <> 'array' then raise exception 'deduction_lines must be a list'; end if;
  if jsonb_array_length(new.deduction_lines) > 20 then raise exception 'at most 20 deduction lines'; end if;
  for d in select value from jsonb_array_elements(new.deduction_lines) loop
    if jsonb_typeof(d) <> 'object' then raise exception 'each deduction line must be an object'; end if;
    if coalesce(length(trim(d ->> 'name')), 0) not between 1 and 60 then
      raise exception 'each deduction line needs a name (1 to 60 characters)';
    end if;
    if coalesce(d ->> 'kind', '')  not in ('deduction', 'employer') then raise exception 'deduction line kind must be deduction or employer'; end if;
    if coalesce(d ->> 'basis', '') not in ('gross', 'base')         then raise exception 'deduction line basis must be gross or base'; end if;
    if coalesce(d ->> 'mode', '')  not in ('percent', 'fixed')      then raise exception 'deduction line mode must be percent or fixed'; end if;
    if jsonb_typeof(d -> 'value') <> 'number' or (d ->> 'value')::numeric < 0 or (d ->> 'value')::numeric > 1000000000 then
      raise exception 'deduction line value must be a non-negative number';
    end if;
    if d ->> 'mode' = 'percent' and (d ->> 'value')::numeric > 100 then
      raise exception 'a percentage deduction cannot be above 100';
    end if;
  end loop;
  return new;
end $$;
