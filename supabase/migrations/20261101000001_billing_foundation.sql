-- ============================================================================
-- Trackly · Fase 1 · Base de facturación (agnóstica de la pasarela)
-- Planes + una suscripción por organización + límites. Wompi/Stripe solo
-- escribirán en estas tablas (con la clave de servicio, desde un webhook);
-- ningún cliente puede modificarlas.
-- Política de bloqueo SUAVE: un plan vencido NO impide fichar ni pedir permisos
-- (son registros laborales); solo impide AGREGAR empleados y se muestra un aviso.
-- ============================================================================

create table if not exists public.plans (
  id             text primary key,
  name           text not null,
  price_cents    integer check (price_cents is null or price_cents >= 0),  -- null = por definir
  currency       text check (currency is null or currency in ('USD','CAD','COP')),
  billing_period text not null default 'month' check (billing_period in ('month','year')),
  max_employees  integer check (max_employees is null or max_employees > 0), -- null = sin límite
  trial_days     integer not null default 0 check (trial_days >= 0),
  active         boolean not null default true
);

-- Valores iniciales EDITABLES (precio sin definir hasta que decidas la tarifa)
insert into public.plans (id, name, price_cents, currency, max_employees, trial_days) values
  ('trial',    'Free trial', 0,    'USD', 10,   14),
  ('standard', 'Standard',   null, 'USD', null, 0)
on conflict (id) do nothing;

create table if not exists public.subscriptions (
  org_id                   uuid primary key references public.organizations(id) on delete cascade,
  plan_id                  text not null references public.plans(id),
  status                   text not null check (status in ('trialing','active','past_due','canceled')),
  provider                 text check (provider is null or provider in ('wompi','stripe')),
  provider_customer_id     text,
  provider_subscription_id text,
  trial_ends_at            timestamptz,
  current_period_end       timestamptz,
  canceled_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
alter table public.plans         enable row level security;
alter table public.subscriptions enable row level security;

-- Organizaciones existentes: la tuya queda activa (uso interno); las demás en prueba
insert into public.subscriptions (org_id, plan_id, status, trial_ends_at)
select o.id,
       case when o.id = '00000000-0000-4000-8000-000000000001' then 'standard' else 'trial' end,
       case when o.id = '00000000-0000-4000-8000-000000000001' then 'active'   else 'trialing' end,
       case when o.id = '00000000-0000-4000-8000-000000000001' then null else now() + interval '14 days' end
from public.organizations o
on conflict (org_id) do nothing;

-- Permisos: solo lectura, y solo el admin de la organización
revoke all on public.plans, public.subscriptions from anon;
revoke all on public.plans, public.subscriptions from authenticated;
grant select on public.plans, public.subscriptions to authenticated;

drop policy if exists plans_select on public.plans;
drop policy if exists subscriptions_select on public.subscriptions;
create policy plans_select on public.plans for select to authenticated using (active);
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (org_id = (select private.current_org_id()) and (select private.is_admin()));

-- Estado efectivo (calculado, para no depender de un cron que marque el vencimiento)
create or replace function private.billing_state(p_org uuid)
returns table (plan_id text, plan_name text, status text, effective text, trial_ends_at timestamptz,
               current_period_end timestamptz, max_employees int, employee_count int, can_add_employees boolean)
language sql stable security definer set search_path = '' as $$
  with s as (
    select s.*, p.name as plan_name, p.max_employees as max_emp
    from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.org_id = p_org
  ), c as (select count(*)::int as n from public.employees where org_id = p_org)
  select s.plan_id, s.plan_name, s.status,
         case when s.status = 'trialing' and s.trial_ends_at <= now() then 'expired'
              when s.status = 'canceled' and coalesce(s.current_period_end, s.canceled_at) <= now() then 'expired'
              when s.status = 'canceled' then 'active'          -- cancelada pero con periodo pagado vigente
              else s.status end,
         s.trial_ends_at, s.current_period_end, s.max_emp, c.n,
         (case when s.status = 'trialing' and s.trial_ends_at <= now() then false
               when s.status = 'canceled' and coalesce(s.current_period_end, s.canceled_at) <= now() then false
               else true end)
         and (s.max_emp is null or c.n < s.max_emp)
  from s, c
$$;
revoke all on function private.billing_state(uuid) from public, anon, authenticated;

-- Lectura para el admin de su organización
create or replace function public.get_billing_status()
returns table (plan_id text, plan_name text, status text, effective text, trial_ends_at timestamptz,
               current_period_end timestamptz, max_employees int, employee_count int, can_add_employees boolean)
language sql stable security definer set search_path = '' as $$
  select * from private.billing_state(private.current_org_id()) where private.is_admin()
$$;
revoke all on function public.get_billing_status() from public, anon;
grant execute on function public.get_billing_status() to authenticated;

-- Límite al agregar empleados (la fila de la organización se crea desde el SQL Editor sin sesión: se omite)
create or replace function private.enforce_employee_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  if auth.uid() is null then return new; end if;   -- operador / migraciones
  select b.can_add_employees into ok from private.billing_state(new.org_id) b;
  if ok is distinct from true then
    raise exception 'billing: cannot add employees (plan limit reached or subscription inactive)';
  end if;
  return new;
end $$;
drop trigger if exists employees_limit on public.employees;
create trigger employees_limit before insert on public.employees
  for each row execute function private.enforce_employee_limit();

-- Alta de organizaciones nuevas: empiezan en prueba gratuita
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
  values (oid, admin_name, lower(admin_email), 'admin', 0, 0.416, 40, current_date, 'Management');
  return oid;
end $$;
revoke all on function private.create_organization(text, text, text) from public, anon, authenticated;
