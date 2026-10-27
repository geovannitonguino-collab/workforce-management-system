-- ============================================================================
-- Trackly · Fase 1 · Aceptación de Términos y Política de Privacidad
-- Cada persona acepta la versión vigente en su primer ingreso. Se guarda la
-- versión y la fecha; el evento queda en la bitácora de auditoría.
-- ============================================================================

alter table public.employees
  add column if not exists terms_version     text,
  add column if not exists terms_accepted_at timestamptz;

-- Única vía para aceptar: solo toca la fila propia (employees_update es solo-admin).
create or replace function public.accept_terms(p_version text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.current_employee_id();
begin
  if me is null then raise exception 'not linked to an employee'; end if;
  if p_version is null or length(trim(p_version)) = 0 or length(p_version) > 32 then
    raise exception 'invalid version';
  end if;
  update public.employees set terms_version = p_version, terms_accepted_at = now() where id = me;
  insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
  values (private.current_org_id(), me, 'terms.accepted', 'employee', me, jsonb_build_object('version', p_version));
end $$;
revoke all on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;

-- Un admin que edita a otra persona no puede falsear ni borrar su aceptación.
-- Función SIN security definer: current_user es el rol de la petición ('authenticated'),
-- mientras que dentro de accept_terms (definer) es el dueño de la función.
create or replace function private.protect_terms_columns()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.terms_version is distinct from old.terms_version
      or new.terms_accepted_at is distinct from old.terms_accepted_at)
     and current_user = 'authenticated' then
    raise exception 'terms acceptance can only be recorded through accept_terms()';
  end if;
  return new;
end $$;
drop trigger if exists employees_protect_terms on public.employees;
create trigger employees_protect_terms before update on public.employees
  for each row execute function private.protect_terms_columns();
