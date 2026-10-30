-- ============================================================================
-- Tipos de permiso: vacaciones, PTO, incapacidad médica, personal, día de la familia y "otro".
-- "Otro" exige explicar la razón. Idempotente.
-- ============================================================================

alter table public.leave_requests drop constraint if exists leave_requests_category_check;
alter table public.leave_requests add constraint leave_requests_category_check
  check (category in ('sick','pto','vacation','personal','family','other'));

alter table public.leave_requests drop constraint if exists leave_requests_other_needs_reason;
alter table public.leave_requests add constraint leave_requests_other_needs_reason
  check (category <> 'other' or length(trim(coalesce(reason, ''))) >= 3);
