-- ============================================================================
-- Corrección: las constancias médicas se suben ANTES de crear la solicitud de permiso
-- (la app usa un id "borrador" que luego se convierte en el id de la solicitud).
-- El esquema original tenía una clave foránea medical_proofs.leave_request_id -> leave_requests
-- que rechazaba toda constancia cuya solicitud todavía no existía, así que NINGUNA subida funcionaba.
-- Se quita esa restricción. El aislamiento no depende de ella: cada constancia lleva su org_id y su
-- employee_id, y las políticas de seguridad filtran por ellos.
-- Idempotente.
-- ============================================================================

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.medical_proofs'::regclass
      and contype = 'f'
      and confrelid = 'public.leave_requests'::regclass
  loop
    execute format('alter table public.medical_proofs drop constraint %I', c.conname);
  end loop;
end $$;

-- Para consultar constancias por solicitud (LeaveHistory) sin recorrer toda la tabla
create index if not exists medical_proofs_leave_request_idx on public.medical_proofs (leave_request_id);
