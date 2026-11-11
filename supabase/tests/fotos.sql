-- Pruebas de las políticas del almacén de fotos.
-- Todo corre dentro de una transacción que se revierte: no deja datos.
begin;

create temp table _r (n serial, prueba text, ok boolean, detalle text) on commit drop;

create function pg_temp.eq(p_prueba text, p_obtenido text, p_esperado text) returns void
language sql as $$
  insert into _r (prueba, ok, detalle)
  values (p_prueba, p_obtenido is not distinct from p_esperado,
          format('esperado [%s] · obtenido [%s]', p_esperado, p_obtenido));
$$;
-- Debe fallar con un mensaje que contenga p_patron
create function pg_temp.err(p_prueba text, p_obtenido text, p_patron text) returns void
language sql as $$
  insert into _r (prueba, ok, detalle)
  values (p_prueba, coalesce(p_obtenido like 'ERROR:%' || p_patron || '%', false),
          format('esperado error [%s] · obtenido [%s]', p_patron, p_obtenido));
$$;
-- No debe fallar
create function pg_temp.bien(p_prueba text, p_obtenido text) returns void
language sql as $$
  insert into _r (prueba, ok, detalle)
  values (p_prueba, coalesce(p_obtenido, '') not like 'ERROR:%', format('obtenido [%s]', p_obtenido));
$$;

create function pg_temp.usuario(p_nombre text, p_role public.app_role, p_marca boolean) returns uuid
language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          replace(lower(p_nombre), ' ', '.') || '@prueba.test', jsonb_build_object('nombre', p_nombre), now(), now());
  update public.profiles set role = p_role, marca_turno = p_marca where id = v;
  return v;
end; $$;

-- Ejecuta p_sql con la sesión de p_uid (rol authenticated + políticas de filas).
-- Devuelve el primer valor, o 'ERROR: <mensaje>' si la base lo rechaza.
create function pg_temp.como(p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    execute p_sql into v;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'ERROR: ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v;
end; $$;

-- Igual, pero con permisos totales (como la tarea automática)
create function pg_temp.pg(p_sql text) returns text
language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  return v;
exception when others then
  return 'ERROR: ' || sqlerrm;
end; $$;

create temp table _u on commit drop as
select pg_temp.usuario('Ana Admin', 'admin', false)        as a,
       pg_temp.usuario('Ciro Coord', 'coordinador', false) as c,
       pg_temp.usuario('Eva Empleada', 'empleado', true)   as e,
       pg_temp.usuario('Fabio Fijo', 'empleado', false)    as f,
       pg_temp.usuario('Equipo Quiosco', 'quiosco', false) as q;

-- ════════════════════════════════════════════════════════════════════════════
-- S · Almacén de fotos (políticas de storage.objects)
-- ════════════════════════════════════════════════════════════════════════════
-- Permite probar el borrado con SQL; en producción los archivos se borran por la API.
select set_config('storage.allow_delete_query', 'true', true);

select pg_temp.bien('S01 cada quien sube a su propia carpeta',
  pg_temp.como(e, format($q$insert into storage.objects (bucket_id, name, owner_id) values ('turnos', %L, %L) returning name$q$, e || '/propia.jpg', e))) from _u;
select pg_temp.err('S02 nadie sube a la carpeta de otro',
  pg_temp.como(e, format($q$insert into storage.objects (bucket_id, name, owner_id) values ('turnos', %L, %L) returning name$q$, f || '/ajena.jpg', e)), 'row-level security') from _u;
select pg_temp.bien('S03 el quiosco sube a la carpeta de la persona que marca',
  pg_temp.como(q, format($q$insert into storage.objects (bucket_id, name, owner_id) values ('turnos', %L, %L) returning name$q$, e || '/quiosco.jpg', q))) from _u;
select pg_temp.eq('S04 quien sube ve su foto mientras ningún turno la use',
  pg_temp.como(e, $q$select count(*)::text from storage.objects where bucket_id = 'turnos'$q$), '2') from _u;
select pg_temp.eq('S05 otro empleado no ve fotos ajenas',
  pg_temp.como(f, $q$select count(*)::text from storage.objects where bucket_id = 'turnos'$q$), '0') from _u;

-- Un turno cerrado usa la foto "propia": desde aquí es prueba de nómina
insert into public.turno (perfil_id, inicio_el, fin_el, foto_inicio_path)
  select e, '2026-03-02 07:00-05', '2026-03-02 15:00-05', e || '/propia.jpg' from _u;

select pg_temp.eq('S06 en cuanto un turno la usa, el empleado deja de verla',
  pg_temp.como(e, $q$select string_agg(right(name, 11), ',') from storage.objects where bucket_id = 'turnos'$q$), 'quiosco.jpg') from _u;
select pg_temp.eq('S07 ... y no la puede borrar',
  pg_temp.como(e, format($q$with d as (delete from storage.objects where name = %L returning 1) select count(*)::text from d$q$, e || '/propia.jpg')), '0') from _u;
select pg_temp.eq('S08 el coordinador ve todas las fotos',
  pg_temp.como(c, $q$select count(*)::text from storage.objects where bucket_id = 'turnos'$q$), '2') from _u;
select pg_temp.eq('S09 ... pero no puede borrar ninguna',
  pg_temp.como(c, $q$with d as (delete from storage.objects where bucket_id = 'turnos' returning 1) select count(*)::text from d$q$), '0') from _u;
select pg_temp.eq('S10 la foto huérfana sí la borra quien la subió',
  pg_temp.como(e, format($q$with d as (delete from storage.objects where name = %L returning 1) select count(*)::text from d$q$, e || '/quiosco.jpg')), '1') from _u;
select pg_temp.eq('S11 el administrador borra a mano incluso una en uso',
  pg_temp.como(a, format($q$with d as (delete from storage.objects where name = %L returning 1) select count(*)::text from d$q$, e || '/propia.jpg')), '1') from _u;
select pg_temp.eq('S12 sin sesión no se ve nada del almacén',
  (select count(*)::text from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'turnos_obj_%' and 'anon' = any (roles)), '0');

-- La tarea diaria de limpieza: solo la llave de servicio puede preguntar por el secreto
select pg_temp.eq('S13 el secreto de la tarea no lo puede comprobar un usuario ni un visitante',
  concat_ws(' ',
    has_function_privilege('anon', 'public.cron_secreto_valido(text)', 'execute'),
    has_function_privilege('authenticated', 'public.cron_secreto_valido(text)', 'execute'),
    has_function_privilege('authenticated', 'private.turnos_limpiar_fotos()', 'execute'),
    has_function_privilege('service_role', 'public.cron_secreto_valido(text)', 'execute')), 'f f f t');
select pg_temp.eq('S14 un secreto equivocado o vacío no pasa; el del Vault sí',
  concat_ws(' ',
    public.cron_secreto_valido(repeat('0', 64)),
    public.cron_secreto_valido(''),
    public.cron_secreto_valido((select decrypted_secret from vault.decrypted_secrets where name = 'turnos_cron_secreto'))), 'f f t');
select pg_temp.eq('S15 la limpieza está programada todos los días a las 2:40 a. m. de Colombia',
  (select schedule || ' ' || active from cron.job where jobname = 'turnos-limpiar-fotos'), '40 7 * * * true');

select count(*) filter (where ok) as pasaron,
       count(*) filter (where not ok) as fallaron,
       coalesce(jsonb_agg(jsonb_build_object('prueba', prueba, 'detalle', detalle) order by n)
                filter (where not ok), '[]'::jsonb) as fallas
  from _r;

rollback;
