-- Borra la empresa de prueba "Org B (test)" y sus cuentas @orgb-test.com.
-- Ejecutar una sola vez en el SQL Editor de Supabase. No toca otras empresas.
begin;
set local session_replication_role = replica;  -- solo en esta transaccion: evita bloqueos de claves foraneas y triggers de auditoria

do $$
declare
  v_org uuid := '0b47503f-3816-4f59-9b83-ad13cd08a7af';
  v_emps uuid[];
  t record;
begin
  if (select name from public.organizations where id = v_org) is distinct from 'Org B (test)' then
    raise exception 'La organizacion no coincide con Org B (test); no se borra nada';
  end if;

  select coalesce(array_agg(id), '{}') into v_emps from public.employees where org_id = v_org;

  -- tablas con employee_id pero sin org_id
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'employee_id'
      and not exists (select 1 from information_schema.columns o where o.table_schema = 'public' and o.table_name = c.table_name and o.column_name = 'org_id')
  loop
    execute format('delete from public.%I where employee_id = any($1)', t.table_name) using v_emps;
  end loop;

  -- todas las tablas con org_id (empleados incluidos)
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'org_id' and c.table_name <> 'organizations'
  loop
    execute format('delete from public.%I where org_id = $1', t.table_name) using v_org;
  end loop;

  delete from public.organizations where id = v_org;
  delete from auth.users where email like '%@orgb-test.com';
end $$;

select (select count(*) from public.organizations where name = 'Org B (test)') as orgs_restantes,
       (select count(*) from auth.users where email like '%@orgb-test.com') as cuentas_restantes,
       (select count(*) from public.employees where email like '%@orgb-test.com') as empleados_restantes;
commit;
