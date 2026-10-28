-- ============================================================================
-- Trackly · Fase 2 · Fichar solo desde la red del local (ajuste por empresa)
-- Apagado por defecto. Cuando una empresa lo activa, la base de datos rechaza
-- cualquier fichaje directo cuya IP pública no esté en su lista permitida.
-- La IP se toma de la cabecera que pone el borde de Supabase (cf-connecting-ip),
-- no de una que el cliente pueda inventar. Las correcciones aprobadas por un
-- admin NO se ven afectadas (se insertan desde resolve_time_correction).
-- ============================================================================

alter table public.organizations
  add column if not exists clock_ip_restriction boolean not null default false,
  add column if not exists clock_allowed_ips    inet[]  not null default '{}';

-- Las IP permitidas no deben ser legibles por cualquier empleado: solo columnas inocuas
revoke select on public.organizations from authenticated;
grant  select (id, name, created_at) on public.organizations to authenticated;

-- IP pública del cliente tal como la ve el servidor
create or replace function private.client_ip()
returns inet language plpgsql stable set search_path = '' as $$
declare h json; v text;
begin
  begin h := current_setting('request.headers', true)::json;
  exception when others then return null; end;
  if h is null then return null; end if;
  v := coalesce(h->>'cf-connecting-ip', h->>'x-real-ip');
  if v is null then return null; end if;
  begin return trim(v)::inet; exception when others then return null; end;
end $$;

-- ¿Permite la política de esta organización fichar desde esta IP?
create or replace function private.org_clock_allows(p_org uuid, p_ip inet)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare o record;
begin
  select clock_ip_restriction, clock_allowed_ips into o from public.organizations where id = p_org;
  if not found or not o.clock_ip_restriction then return true; end if;
  if p_ip is null then return false; end if;                       -- sin IP conocida: se rechaza
  return exists (select 1 from unnest(o.clock_allowed_ips) a where p_ip <<= a);
end $$;

revoke all on function private.client_ip()                    from public, anon;
revoke all on function private.org_clock_allows(uuid, inet)   from public, anon;
grant execute on function private.client_ip()                  to authenticated;
grant execute on function private.org_clock_allows(uuid, inet) to authenticated;

-- Trigger SIN security definer: current_user = 'authenticated' solo en inserciones
-- directas del cliente; dentro de resolve_time_correction (definer) es el dueño.
create or replace function private.enforce_clock_network()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated'
     and not private.org_clock_allows(new.org_id, private.client_ip()) then
    raise exception 'clock: punches are only allowed from the workplace network';
  end if;
  return new;
end $$;
drop trigger if exists time_entries_network_chk on public.time_entries;
create trigger time_entries_network_chk before insert on public.time_entries
  for each row execute function private.enforce_clock_network();

-- ---------------------------------------------------------------------------
-- API para la app
-- ---------------------------------------------------------------------------
-- Mi IP vista por el servidor (para "usar la red en la que estoy")
create or replace function public.my_ip()
returns text language sql stable security definer set search_path = '' as $$
  select host(private.client_ip())
$$;
revoke all on function public.my_ip() from public, anon;
grant execute on function public.my_ip() to authenticated;

-- ¿Puedo fichar desde aquí? (cualquier empleado; la app lo usa para avisar antes de intentar)
create or replace function public.can_clock_here()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.org_clock_allows(private.current_org_id(), private.client_ip())
$$;
revoke all on function public.can_clock_here() from public, anon;
grant execute on function public.can_clock_here() to authenticated;

-- Política actual (solo admin)
create or replace function public.get_clock_policy()
returns table (enabled boolean, ips text[]) language sql stable security definer set search_path = '' as $$
  select o.clock_ip_restriction, coalesce(array(select a::text from unnest(o.clock_allowed_ips) a), '{}')
  from public.organizations o
  where o.id = private.current_org_id() and private.is_admin()
$$;
revoke all on function public.get_clock_policy() from public, anon;
grant execute on function public.get_clock_policy() to authenticated;

-- Cambiar la política (solo admin). Valida las IP y deja rastro en la bitácora.
create or replace function public.set_clock_policy(p_enabled boolean, p_ips text[])
returns void language plpgsql security definer set search_path = '' as $$
declare clean inet[] := '{}'; x text; org uuid := private.current_org_id();
begin
  if not private.is_admin() then raise exception 'admin only'; end if;
  if coalesce(array_length(p_ips, 1), 0) > 20 then raise exception 'too many addresses (max 20)'; end if;
  foreach x in array coalesce(p_ips, '{}') loop
    begin clean := clean || trim(x)::inet;
    exception when others then raise exception 'invalid IP address: %', left(x, 60); end;
  end loop;
  if p_enabled and coalesce(array_length(clean, 1), 0) = 0 then
    raise exception 'add at least one allowed address before enabling the restriction';
  end if;
  update public.organizations set clock_ip_restriction = p_enabled, clock_allowed_ips = clean where id = org;
  insert into public.audit_log (org_id, actor_id, event, entity, entity_id, details)
  values (org, private.current_employee_id(), 'clock_policy.updated', 'organization', org,
          jsonb_build_object('enabled', p_enabled, 'ips', to_jsonb(clean::text[])));
end $$;
revoke all on function public.set_clock_policy(boolean, text[]) from public, anon;
grant execute on function public.set_clock_policy(boolean, text[]) to authenticated;
