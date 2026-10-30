-- ============================================================================
-- 1) Se elimina la restricción de fichaje por red (decisión de producto: no se usa).
--    Quita el trigger, las funciones y las dos columnas de organizations.
-- 2) Los planes pueden mostrar precio en USD y en COP y una descripción.
-- Idempotente.
-- ============================================================================

drop trigger  if exists time_entries_network_chk on public.time_entries;
drop function if exists private.enforce_clock_network();
drop function if exists public.can_clock_here();
drop function if exists public.get_clock_policy();
drop function if exists public.set_clock_policy(boolean, text[]);
drop function if exists public.my_ip();
drop function if exists private.org_clock_allows(uuid, inet);
drop function if exists private.client_ip();

alter table public.organizations
  drop column if exists clock_ip_restriction,
  drop column if exists clock_allowed_ips;

alter table public.plans
  add column if not exists description text,
  add column if not exists price_usd   numeric(10,2) check (price_usd is null or price_usd >= 0),
  add column if not exists price_cop   numeric(14,0) check (price_cop is null or price_cop >= 0),
  add column if not exists sort_order  integer not null default 0;

update public.plans set sort_order = 0, description = 'Try everything for 14 days.' where id = 'trial' and description is null;
update public.plans set sort_order = 1, description = 'Your current plan.'          where id = 'standard' and description is null;
