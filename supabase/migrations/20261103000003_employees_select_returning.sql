-- ============================================================================
-- Corrección: un manager no podía dar de alta a nadie desde la app.
-- La app inserta con "insert ... returning" (insert().select()). Para devolver la fila nueva, Postgres
-- exige que pase la política de LECTURA. La política usaba private.manages_employee(id), que consulta la
-- tabla employees dentro de la misma sentencia: allí la fila recién insertada todavía no existe, así que
-- devolvía falso y toda la inserción se rechazaba ("new row violates row-level security policy").
-- Solución: añadir una condición basada en las columnas de la propia fila (su departamento y el jefe del
-- departamento), que no necesita volver a leer employees. Idempotente.
-- ============================================================================

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select to authenticated
  using (
    org_id = (select private.current_org_id())
    and (
      user_id = (select auth.uid())
      or (select private.is_admin())
      or (select private.manages_employee(id))
      -- equivalente a manages_employee, calculado solo con la fila y la tabla departments
      or (role <> 'director'
          and department_id is not null
          and exists (select 1 from public.departments d
                      where d.id = department_id
                        and d.manager_employee_id = (select private.current_employee_id())))
    )
  );
