-- Listado de empleados para el administrador principal: el perfil, el correo de
-- la cuenta y el estado del PIN (si tiene y si está bloqueado, nunca el valor).
-- El correo vive en auth.users, que nadie lee directamente: por eso es definer.
create or replace function public.empleados_listar()
returns table (
  id uuid, nombre text, cargo text, role public.app_role, activo boolean, marca_turno boolean,
  correo text, tiene_pin boolean, pin_bloqueado boolean, creado_el timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exige_admin();
  return query
    select p.id, p.nombre, p.cargo, p.role, p.activo, p.marca_turno,
           u.email::text,
           tp.perfil_id is not null,
           coalesce(tp.bloqueado_hasta > now(), false),
           p.created_at
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.turno_pin tp on tp.perfil_id = p.id
     order by p.activo desc, p.nombre;
end; $$;

revoke execute on function public.empleados_listar() from public, anon;
grant execute on function public.empleados_listar() to authenticated;
