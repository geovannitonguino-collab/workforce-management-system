-- ============================================================================
-- EMPRESA DE DEMOSTRACION (datos ficticios): "Lumen AI Studio"
-- Estudio de IA de EE. UU., equipo virtual en Latinoamerica, todos contractors pagados en USD.
--   * Director: geovannitonguino@gmail.com  (contrasena: Prueba1234, cambiela despues)
--   * 2 managers con login (misma contrasena) y 6 personas en sus equipos (sin login)
--   * PTO: 5 dias por ano (40 h), incluye incapacidad por enfermedad
--   * Vacaciones: 10 dias por ano pagos (0.833 dias por mes)
--   * Horas registradas de septiembre y octubre de 2026, ausencias aprobadas y pendientes
-- Ejecutar una sola vez en el SQL Editor de Supabase. Para borrarla: ver el final del archivo.
-- ============================================================================
do $$
declare
  v_org uuid; v_dir uuid;
  v_d_video uuid; v_d_eng uuid;
  v_pw text := 'Prueba1234';
  r record; uid uuid;
  d date; ts_in timestamptz; hrs numeric; jit int;
  v_email text := 'geovannitonguino@gmail.com';
begin
  if exists (select 1 from public.organizations where name = 'Lumen AI Studio') then
    raise exception 'Lumen AI Studio ya existe; no se crea de nuevo';
  end if;
  if exists (select 1 from public.employees where lower(email) = lower(v_email)) then
    raise exception 'El correo % ya pertenece a un empleado de otra empresa; un correo solo puede estar en una empresa', v_email;
  end if;

  -- 1. Empresa y director --------------------------------------------------------
  v_org := private.create_organization('Lumen AI Studio', v_email, 'Geovanni Tonguino');
  select id into v_dir from public.employees where org_id = v_org and role = 'director';
  update public.employees set hire_date = '2024-01-15', department = 'Management', paid_pto_limit_hours = 40, vacation_accrual_rate = 0 where id = v_dir;

  update public.organizations set time_zone = 'America/New_York', country = 'United States', default_currency = 'USD' where id = v_org;
  update public.subscriptions set plan_id = 'trackly', status = 'active', trial_ends_at = null where org_id = v_org;

  insert into public.org_holidays (org_id, date, name) values
    (v_org, '2026-11-11', 'Veterans Day'), (v_org, '2026-11-26', 'Thanksgiving'), (v_org, '2026-12-25', 'Christmas Day');

  -- 2. Departamentos y personas ----------------------------------------------------
  insert into public.departments (org_id, name) values (v_org, 'Generative Video') returning id into v_d_video;
  insert into public.departments (org_id, name) values (v_org, 'AI Engineering')  returning id into v_d_eng;

  create temp table _people (
    name text, email text, role text, dept uuid, hired date, country text,
    pay_type text, pay_period text, amount numeric, tracks boolean
  ) on commit drop;
  insert into _people values
    ('Camila Restrepo',  'camila.restrepo@lumen-demo.test',  'manager',  v_d_video, '2024-03-04', 'Colombia',  'fixed',  'monthly',     6500, false),
    ('Diego Salazar',    'diego.salazar@lumen-demo.test',    'manager',  v_d_eng,   '2024-05-20', 'Mexico',    'fixed',  'monthly',     7200, false),
    ('Valentina Ruiz',   'valentina.ruiz@lumen-demo.test',   'employee', v_d_video, '2024-09-09', 'Panama',    'hourly', 'semimonthly',    38, true),
    ('Mateo Herrera',    'mateo.herrera@lumen-demo.test',    'employee', v_d_video, '2025-01-13', 'Argentina', 'hourly', 'semimonthly',    32, true),
    ('Sofia Castillo',   'sofia.castillo@lumen-demo.test',   'employee', v_d_video, '2025-04-07', 'Colombia',  'fixed',  'monthly',     4300, false),
    ('Andres Mejia',     'andres.mejia@lumen-demo.test',     'employee', v_d_eng,   '2025-08-18', 'Mexico',    'hourly', 'semimonthly',    45, true),
    ('Isabella Torres',  'isabella.torres@lumen-demo.test',  'employee', v_d_eng,   '2026-02-02', 'Chile',     'hourly', 'semimonthly',    28, true),
    ('Lucas Fernandez',  'lucas.fernandez@lumen-demo.test',  'employee', v_d_eng,   '2026-06-15', 'Uruguay',   'fixed',  'monthly',     3600, false);

  for r in select * from _people loop
    insert into public.employees (org_id, name, email, role, hourly_rate, vacation_accrual_rate, paid_pto_limit_hours, hire_date, department, department_id)
    values (v_org, r.name, r.email, r.role, case when r.pay_type = 'hourly' then r.amount else 0 end, 0, 40, r.hired,
            (select name from public.departments where id = r.dept), r.dept);
  end loop;
  update public.departments set manager_employee_id = (select id from public.employees where org_id = v_org and email = 'camila.restrepo@lumen-demo.test') where id = v_d_video;
  update public.departments set manager_employee_id = (select id from public.employees where org_id = v_org and email = 'diego.salazar@lumen-demo.test')   where id = v_d_eng;

  -- 3. Contratos (contractors, USD, PTO 40 h, vacaciones 10 dias/ano) ---------------
  insert into public.employee_contracts (org_id, employee_id, effective_from, relationship, contract_type, pay_type, pay_period, amount, currency,
                                         tracks_time, pto_hours_per_year, vacation_days_per_month, note, created_by)
  values (v_org, v_dir, '2024-01-15', 'contractor', 'Founder & Director', 'fixed', 'monthly', 9000, 'USD', false, 40, 0.833, 'Based in United States', v_dir);
  insert into public.employee_contracts (org_id, employee_id, effective_from, relationship, contract_type, pay_type, pay_period, amount, currency,
                                         tracks_time, pto_hours_per_year, vacation_days_per_month, note, created_by)
  select v_org, e.id, p.hired, 'contractor', 'Independent contractor', p.pay_type, p.pay_period, p.amount, 'USD',
         p.tracks, 40, 0.833, 'Based in ' || p.country, v_dir
  from _people p join public.employees e on e.org_id = v_org and e.email = p.email;

  -- 4. Ausencias (PTO 5 dias/ano incl. enfermedad; vacaciones 10 dias pagas) --------
  insert into public.leave_requests (org_id, employee_id, category, start_date, end_date, hours, is_paid, unpaid_hours, status, reason, uses_pto_balance)
  select v_org, e.id, x.cat, x.s::date, x.f::date, x.h, true, 0, x.st, x.why, x.cat = 'pto'
  from (values
    ('valentina.ruiz@lumen-demo.test',  'vacation', '2026-08-10', '2026-08-14', 40, 'approved', 'Family trip'),
    ('mateo.herrera@lumen-demo.test',   'pto',      '2026-09-21', '2026-09-21',  8, 'approved', 'Personal errand'),
    ('andres.mejia@lumen-demo.test',    'sick',     '2026-10-06', '2026-10-06',  8, 'approved', 'Flu'),
    ('sofia.castillo@lumen-demo.test',  'vacation', '2026-07-06', '2026-07-10', 40, 'approved', 'Summer break'),
    ('isabella.torres@lumen-demo.test', 'pto',      '2026-11-05', '2026-11-05',  8, 'pending',  'Medical appointment'),
    ('lucas.fernandez@lumen-demo.test', 'vacation', '2026-12-14', '2026-12-18', 40, 'pending',  'Year-end holidays'),
    ('valentina.ruiz@lumen-demo.test',  'sick',     '2026-10-26', '2026-10-27', 16, 'pending',  'Bronchitis, certificate to follow')
  ) as x(em, cat, s, f, h, st, why)
  join public.employees e on e.org_id = v_org and e.email = x.em;

  -- 5. Horas registradas (septiembre y octubre 2026) solo para quienes marcan hora -------
  for r in
    select e.id as emp, e.hire_date, e.email
    from public.employees e
    join public.employee_contracts c on c.employee_id = e.id and c.tracks_time
    where e.org_id = v_org
  loop
    for d in select g::date from generate_series(greatest(r.hire_date, date '2026-09-01'), date '2026-10-29', interval '1 day') g loop
      continue when extract(dow from d) in (0, 6);
      continue when exists (select 1 from public.leave_requests l where l.employee_id = r.emp and l.status = 'approved' and d between l.start_date and l.end_date);
      jit := (abs(hashtext(r.email || d::text)) % 41) - 10;          -- -10..+30 minutos
      hrs := 7.4 + (abs(hashtext(d::text || r.email)) % 13) / 10.0;  -- 7.4 .. 8.6 h
      continue when abs(hashtext('off' || r.email || d::text)) % 17 = 0;  -- algun dia sin registro
      ts_in := ((d::timestamp + time '09:00') at time zone 'America/New_York') + make_interval(mins => jit);
      insert into public.time_entries (org_id, employee_id, action, timestamp, date) values
        (v_org, r.emp, 'clock_in',  ts_in, d),
        (v_org, r.emp, 'clock_out', ts_in + make_interval(secs => (hrs * 3600)::int), d);
    end loop;
  end loop;

  -- 6. Logins: director y 2 managers (el resto de personas no necesita acceso) --------------
  for r in select id, lower(email) as email from public.employees where org_id = v_org and (role in ('director', 'manager')) loop
    select id into uid from auth.users where lower(email) = r.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', r.email,
        crypt(v_pw, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
      values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', r.email, 'email_verified', true),
        'email', now(), now(), now());
    else
      update auth.users set encrypted_password = crypt(v_pw, gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()) where id = uid;
    end if;
    update public.employees set user_id = uid where id = r.id and user_id is distinct from uid;
  end loop;
end $$;

select e.name, e.role, d.name as team, e.hire_date, e.user_id is not null as con_login
from public.employees e left join public.departments d on d.id = e.department_id
where e.org_id = (select id from public.organizations where name = 'Lumen AI Studio')
order by (e.role = 'director') desc, (e.role = 'manager') desc, d.name, e.hire_date;

-- PARA BORRAR LA DEMO (despues): borre la organizacion con el mismo metodo de supabase/cleanup-org-b-test.sql
-- cambiando el nombre 'Org B (test)' por 'Lumen AI Studio' y el filtro de correos por los de arriba.
