-- Borra la empresa de prueba "Org B (test)" y sus 7 cuentas @orgb-test.com.
-- Ejecutar una sola vez en el SQL Editor de Supabase. No toca Geovannix ni Freelance LA.
begin;
do $$
declare v_org uuid := '0b47503f-3816-4f59-9b83-ad13cd08a7af';
begin
  if (select name from public.organizations where id = v_org) is distinct from 'Org B (test)' then
    raise exception 'La organizacion no coincide con Org B (test); no se borra nada';
  end if;
  delete from public.organizations where id = v_org;           -- cascada: empleados, contratos, horas, archivos, auditoria
  delete from auth.users where email like '%@orgb-test.com';  -- cuentas de prueba
end $$;
select (select count(*) from public.organizations where name = 'Org B (test)') as orgs_restantes,
       (select count(*) from auth.users where email like '%@orgb-test.com') as cuentas_restantes;
commit;
