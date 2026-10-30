-- ============================================================================
-- Planes con precio "base + valor por persona" en USD y en COP.
-- Autosuficiente: añade las columnas que necesita aunque no se hayan ejecutado migraciones anteriores.
-- Idempotente. Cambiar un precio después es un UPDATE a estas filas; nada del código cambia.
-- ============================================================================

alter table public.plans
  add column if not exists description    text,
  add column if not exists sort_order     integer not null default 0,
  add column if not exists base_usd       numeric(10,2) check (base_usd is null or base_usd >= 0),
  add column if not exists per_person_usd numeric(10,2) check (per_person_usd is null or per_person_usd >= 0),
  add column if not exists base_cop       numeric(14,0) check (base_cop is null or base_cop >= 0),
  add column if not exists per_person_cop numeric(14,0) check (per_person_cop is null or per_person_cop >= 0);

-- Prueba gratis (ya existe): solo se completa la descripción y el orden
update public.plans
   set description = 'Try everything for 14 days.', sort_order = 0
 where id = 'trial';

-- El plan de pago: base fija + valor por persona activa, sin límite de personas
insert into public.plans (id, name, description, max_employees, trial_days, base_usd, per_person_usd, base_cop, per_person_cop, sort_order, active)
values ('trackly', 'Trackly',
        'Hours, leave, contracts and pay estimates for your whole team, in any currency.',
        null, 0, 79, 6, 250000, 12000, 1, true)
on conflict (id) do update
   set name = excluded.name, description = excluded.description, max_employees = excluded.max_employees,
       trial_days = excluded.trial_days, base_usd = excluded.base_usd, per_person_usd = excluded.per_person_usd,
       base_cop = excluded.base_cop, per_person_cop = excluded.per_person_cop, sort_order = excluded.sort_order,
       active = true;

-- El plan interno de Geovannix deja de aparecer como opción, pero se conserva (la suscripción lo usa)
update public.plans
   set name = 'Internal (Geovannix)', description = 'Internal use, no charge.', active = false, sort_order = 99
 where id = 'standard';
