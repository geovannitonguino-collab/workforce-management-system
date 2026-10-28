-- Endurecimiento de la política de red de fichaje.
-- 1) La IP solo se toma de la cabecera de Cloudflare (no de X-Real-IP, que un cliente podría enviar).
create or replace function private.client_ip()
returns inet language plpgsql stable set search_path = '' as $$
declare h json; v text;
begin
  begin h := current_setting('request.headers', true)::json;
  exception when others then return null; end;
  if h is null then return null; end if;
  v := h->>'cf-connecting-ip';
  if v is null then return null; end if;
  begin return trim(v)::inet; exception when others then return null; end;
end $$;

-- 2) Los usuarios con sesión solo leen organizations (ciertas columnas); nada de escribir.
revoke insert, update, delete, truncate, references, trigger on public.organizations from authenticated, anon;
