-- Pruebas de marcación, quiosco y PIN, permisos, correcciones, interruptor y fotos.
-- Todo corre dentro de una transacción que se revierte: no deja datos.
-- Devuelve una fila: cuántas pasaron, cuántas fallaron y el detalle de las fallas.
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
-- M · Marcar desde el celular
-- ════════════════════════════════════════════════════════════════════════════
select pg_temp.err('M01 la entrada exige foto',
  pg_temp.como(e, $q$select turno_id::text from public.turno_marcar('entrada')$q$), 'Falta la foto de entrada') from _u;
select pg_temp.err('M02 la foto debe estar en la carpeta de quien marca',
  pg_temp.como(e, format($q$select turno_id::text from public.turno_marcar('entrada', %L)$q$, f || '/x.jpg')), 'no corresponde') from _u;
select pg_temp.bien('M03 entrada',
  pg_temp.como(e, format($q$select turno_id::text from public.turno_marcar('entrada', %L)$q$, e || '/m03.jpg'))) from _u;
select pg_temp.eq('M04 la hora la pone el servidor, sin segundos, origen app',
  (select origen || ' ' || to_char(inicio_el, 'SS') || ' ' || (inicio_el = date_trunc('minute', now()))
     from public.turno where perfil_id = e), 'app 00 true') from _u;
select pg_temp.err('M05 no deja abrir dos turnos',
  pg_temp.como(e, format($q$select turno_id::text from public.turno_marcar('entrada', %L)$q$, e || '/y.jpg')), 'Ya tienes un turno abierto') from _u;
select pg_temp.err('M06 no se regresa sin haber salido',
  pg_temp.como(e, $q$select turno_id::text from public.turno_marcar('pausa_fin')$q$), 'No tienes una pausa abierta') from _u;
select pg_temp.bien('M07 salida a almorzar',
  pg_temp.como(e, $q$select turno_id::text from public.turno_marcar('pausa_inicio')$q$)) from _u;
select pg_temp.err('M08 no se sale a almorzar dos veces',
  pg_temp.como(e, $q$select turno_id::text from public.turno_marcar('pausa_inicio')$q$), 'Ya marcaste tu salida a almorzar') from _u;
select pg_temp.err('M09 no deja cerrar con el almuerzo abierto',
  pg_temp.como(e, format($q$select turno_id::text from public.turno_marcar('salida', %L)$q$, e || '/m13.jpg')), 'Primero marca tu regreso') from _u;
select pg_temp.bien('M10 regreso del almuerzo',
  pg_temp.como(e, $q$select turno_id::text from public.turno_marcar('pausa_fin')$q$)) from _u;
select pg_temp.err('M11 la salida exige foto',
  pg_temp.como(e, $q$select turno_id::text from public.turno_marcar('salida')$q$), 'Falta la foto de salida') from _u;
select pg_temp.eq('M12 el empleado sí ve su turno abierto',
  pg_temp.como(e, 'select count(*)::text from public.turno'), '1') from _u;
select pg_temp.bien('M13 salida',
  pg_temp.como(e, format($q$select marcado_el::text from public.turno_marcar('salida', %L)$q$, e || '/m13.jpg'))) from _u;
select pg_temp.eq('M14 al cerrarlo deja de verlo',
  pg_temp.como(e, 'select count(*)::text from public.turno'), '0') from _u;
select pg_temp.err('M15 sin turno abierto no hay salida',
  pg_temp.como(e, format($q$select turno_id::text from public.turno_marcar('salida', %L)$q$, e || '/z.jpg')), 'No tienes un turno abierto') from _u;
select pg_temp.err('M16 sin el interruptor no puede marcar',
  pg_temp.como(f, format($q$select turno_id::text from public.turno_marcar('entrada', %L)$q$, f || '/a.jpg')), 'Tu cuenta no registra turnos') from _u;
select pg_temp.err('M17 la cuenta quiosco no marca por la puerta del celular',
  pg_temp.como(q, format($q$select turno_id::text from public.turno_marcar('entrada', %L)$q$, q || '/a.jpg')), 'Tu cuenta no registra turnos') from _u;

-- Un turno cerrado de 8 h (lunes 2026-03-02) para las pruebas de lectura y corrección
insert into public.turno (perfil_id, inicio_el, fin_el)
  select e, '2026-03-02 07:00-05', '2026-03-02 15:00-05' from _u;
create temp table _t on commit drop as
  select t.id from public.turno t, _u where t.perfil_id = _u.e and t.inicio_el = '2026-03-02 07:00-05';

-- ════════════════════════════════════════════════════════════════════════════
-- P · Quién ve qué y quién escribe
-- ════════════════════════════════════════════════════════════════════════════
select pg_temp.eq('P01 al empleado el cálculo le devuelve cero',
  pg_temp.como(e, $q$select count(*)::text from public.turnos_horas('2026-03-02', '2026-03-08')$q$), '0') from _u;
select pg_temp.eq('P02 el administrador ve las horas',
  pg_temp.como(a, format($q$select sum(total)::text from public.turnos_horas('2026-03-02', '2026-03-08', %L)$q$, e)), '480') from _u;
select pg_temp.eq('P03 el coordinador ve las horas',
  pg_temp.como(c, format($q$select sum(total)::text from public.turnos_horas('2026-03-02', '2026-03-08', %L)$q$, e)), '480') from _u;
select pg_temp.eq('P04 el empleado no ve turnos pasados en el listado',
  pg_temp.como(e, $q$select count(*)::text from public.turnos_listar('2026-03-01', '2026-03-08')$q$), '0') from _u;
select pg_temp.err('P05 nadie escribe la tabla directamente: insertar',
  pg_temp.como(e, format('insert into public.turno (perfil_id, inicio_el) values (%L, now()) returning id::text', e)), 'permission denied') from _u;
select pg_temp.err('P06 ni el administrador: actualizar',
  pg_temp.como(a, 'update public.turno set fin_el = now() returning id::text'), 'permission denied') from _u;
select pg_temp.err('P07 ni el administrador: borrar',
  pg_temp.como(a, 'delete from public.turno returning id::text'), 'permission denied') from _u;
select pg_temp.err('P08 nadie lee los PIN, ni el administrador',
  pg_temp.como(a, 'select count(*)::text from public.turno_pin'), 'permission denied') from _u;
select pg_temp.err('P09 nadie se cambia su propio interruptor',
  pg_temp.como(e, 'update public.profiles set marca_turno = false returning id::text'), 'permission denied') from _u;
select pg_temp.eq('P10 sin sesión no hay nada: funciones y tablas cerradas a anon',
  concat_ws(' ',
    has_function_privilege('anon', 'public.turno_marcar(text,text)', 'execute'),
    has_function_privilege('anon', 'public.turnos_horas(date,date,uuid)', 'execute'),
    has_function_privilege('anon', 'public.quiosco_estado()', 'execute'),
    has_table_privilege('anon', 'public.turno', 'select'),
    has_table_privilege('anon', 'public.profiles', 'select')), 'f f f f f');
select pg_temp.eq('P11 las piezas internas y la limpieza de fotos no son para usuarios',
  concat_ws(' ',
    has_function_privilege('authenticated', 'private.turno_marcar(uuid,text,text,text)', 'execute'),
    has_function_privilege('authenticated', 'private.quiosco_pin_check(uuid,text)', 'execute'),
    has_function_privilege('authenticated', 'public.turno_fotos_vencidas(integer)', 'execute'),
    has_function_privilege('authenticated', 'public.turno_fotos_olvidar(text[])', 'execute'),
    has_table_privilege('authenticated', 'public.turno', 'insert')), 'f f f f f');
select pg_temp.eq('P12 el empleado solo ve su propio perfil',
  pg_temp.como(e, 'select count(*)::text from public.profiles'), '1') from _u;
select pg_temp.eq('P13 el coordinador ve a todos',
  pg_temp.como(c, 'select (count(*) >= 5)::text from public.profiles'), 'true') from _u;

-- ════════════════════════════════════════════════════════════════════════════
-- V · Turno olvidado (no se cierra días después)
-- ════════════════════════════════════════════════════════════════════════════
select pg_temp.bien('V01 entrada',
  pg_temp.como(e, format($q$select turno_id::text from public.turno_marcar('entrada', %L)$q$, e || '/v01.jpg'))) from _u;
update public.turno t set inicio_el = now() - interval '20 hours'
  from _u where t.perfil_id = _u.e and t.fin_el is null;
select pg_temp.err('V02 un turno abierto hace 20 h ya no se puede cerrar',
  pg_temp.como(e, format($q$select turno_id::text from public.turno_marcar('salida', %L)$q$, e || '/v02.jpg')), 'pendiente de revisión') from _u;
select pg_temp.err('V03 ni marcarle almuerzo',
  pg_temp.como(e, $q$select turno_id::text from public.turno_marcar('pausa_inicio')$q$), 'pendiente de revisión') from _u;
select pg_temp.bien('V04 pero sí deja iniciar el turno de hoy',
  pg_temp.como(e, format($q$select turno_id::text from public.turno_marcar('entrada', %L)$q$, e || '/v04.jpg'))) from _u;
select pg_temp.eq('V05 el viejo queda pendiente de revisión, sin salida inventada',
  (select count(*) filter (where pendiente_revision) || ' de ' || count(*)
     from public.turno where perfil_id = e and fin_el is null), '1 de 2') from _u;

-- ════════════════════════════════════════════════════════════════════════════
-- Q · Quiosco y PIN
-- ════════════════════════════════════════════════════════════════════════════
select pg_temp.err('Q01 un usuario común no puede usar el quiosco',
  pg_temp.como(e, 'select count(*)::text from public.quiosco_estado()'), 'solo funciona en el equipo compartido') from _u;
select pg_temp.eq('Q02 la lista trae a quien marca, su estado y si tiene PIN',
  pg_temp.como(q, format($q$select string_agg(nombre || ':' || en_turno || ':' || en_pausa || ':' || tiene_pin, ',')
                               from public.quiosco_estado() where perfil_id in (%L, %L)$q$, e, f)),
  'Eva Empleada:true:false:false') from _u;
select pg_temp.err('Q03 el coordinador no asigna PIN',
  pg_temp.como(c, format('select public.turno_pin_asignar(%L, %L)::text', e, '1234')), 'Solo el administrador') from _u;
select pg_temp.err('Q04 el PIN son 4 dígitos',
  pg_temp.como(a, format('select public.turno_pin_asignar(%L, %L)::text', e, '12a4')), '4 dígitos') from _u;
select pg_temp.bien('Q05 el administrador asigna el PIN',
  pg_temp.como(a, format('select public.turno_pin_asignar(%L, %L)::text', e, '1234'))) from _u;
select pg_temp.eq('Q06 la ficha dice si hay PIN sin revelarlo',
  pg_temp.como(a, format('select public.turno_pin_estado(%L)::text', e)), 'true') from _u;
select pg_temp.eq('Q07 se guarda cifrado (bcrypt), no el valor',
  (select (pin_hash like '$2%' and pin_hash not like '%1234%')::text from public.turno_pin where perfil_id = e), 'true') from _u;
select pg_temp.eq('Q08 PIN equivocado: dice cuántos intentos quedan',
  pg_temp.como(q, format($q$select ok || '|' || coalesce(mensaje, '') from public.quiosco_pin_verificar(%L, '0000')$q$, e)),
  'false|PIN incorrecto. Te quedan 4 intentos.') from _u;
select pg_temp.err('Q09 un usuario común no puede verificar un PIN',
  pg_temp.como(e, format($q$select ok::text from public.quiosco_pin_verificar(%L, '1234')$q$, e)), 'solo funciona en el equipo compartido') from _u;
select pg_temp.eq('Q10 el PIN bueno pasa la verificación',
  pg_temp.como(q, format($q$select ok || '|' || coalesce(mensaje, '') from public.quiosco_pin_verificar(%L, '1234')$q$, e)), 'true|') from _u;
select pg_temp.eq('Q11 ... y no marca nada todavía (sigue en turno, intentos en cero)',
  (select count(*) || ' ' || (select intentos from public.turno_pin where perfil_id = e)
     from public.turno where perfil_id = e and fin_el is null and not pendiente_revision), '1 0') from _u;
select count(pg_temp.como(q, format($q$select ok::text from public.quiosco_pin_verificar(%L, '9999')$q$, e)))
  from _u, generate_series(1, 4);
select pg_temp.eq('Q12 al quinto intento fallido se bloquea',
  pg_temp.como(q, format($q$select ok || '|' || coalesce(mensaje, '') from public.quiosco_pin_verificar(%L, '9999')$q$, e)),
  'false|PIN bloqueado 15 minutos por intentos fallidos.') from _u;
select pg_temp.eq('Q13 bloqueado, ni el PIN bueno pasa',
  pg_temp.como(q, format($q$select ok || '|' || coalesce(mensaje, '') from public.quiosco_pin_verificar(%L, '1234')$q$, e)),
  'false|PIN bloqueado por intentos fallidos. Intenta en unos minutos.') from _u;
select pg_temp.eq('Q14 bloqueado, tampoco marca',
  pg_temp.como(q, format($q$select ok::text from public.quiosco_marcar(%L, '1234', 'salida', %L)$q$, e, e || '/q14.jpg')), 'false') from _u;
select pg_temp.bien('Q15 asignar otro PIN levanta el bloqueo',
  pg_temp.como(a, format('select public.turno_pin_asignar(%L, %L)::text', e, '4321'))) from _u;
select pg_temp.eq('Q16 marcar vuelve a validar el PIN: con el equivocado no marca',
  pg_temp.como(q, format($q$select ok || '|' || coalesce(mensaje, '') from public.quiosco_marcar(%L, '1234', 'salida', %L)$q$, e, e || '/q16.jpg')),
  'false|PIN incorrecto. Te quedan 4 intentos.') from _u;
select pg_temp.eq('Q17 con el PIN correcto cierra el turno',
  pg_temp.como(q, format($q$select ok::text from public.quiosco_marcar(%L, '4321', 'salida', %L)$q$, e, e || '/q17.jpg')), 'true') from _u;
select pg_temp.eq('Q18 la entrada por el quiosco devuelve la hora que quedó',
  pg_temp.como(q, format($q$select ok || '|' || (marcado_el = date_trunc('minute', now())) from public.quiosco_marcar(%L, '4321', 'entrada', %L)$q$, e, e || '/q18.jpg')),
  'true|true') from _u;
select pg_temp.eq('Q18b ... y queda con origen quiosco',
  (select origen from public.turno where perfil_id = e and fin_el is null and not pendiente_revision), 'quiosco') from _u;
select pg_temp.err('Q19 no se marca por alguien que no registra turnos',
  pg_temp.como(q, format($q$select ok::text from public.quiosco_marcar(%L, '4321', 'entrada', %L)$q$, f, f || '/q19.jpg')), 'Esa persona no registra turnos') from _u;
select pg_temp.bien('Q20 el administrador quita el PIN',
  pg_temp.como(a, format('select public.turno_pin_borrar(%L)::text', e))) from _u;
select pg_temp.eq('Q21 sin PIN el quiosco le dice qué hacer',
  pg_temp.como(q, format($q$select ok || '|' || coalesce(mensaje, '') from public.quiosco_pin_verificar(%L, '4321')$q$, e)),
  'false|Todavía no tienes PIN. Pídeselo al administrador.') from _u;
select pg_temp.bien('Q22 quitar el PIN no impide marcar desde el celular',
  pg_temp.como(e, format($q$select turno_id::text from public.turno_marcar('salida', %L)$q$, e || '/q22.jpg'))) from _u;

-- ════════════════════════════════════════════════════════════════════════════
-- C · Correcciones
-- ════════════════════════════════════════════════════════════════════════════
select pg_temp.err('C01 el coordinador no corrige',
  pg_temp.como(c, format($q$select public.turno_corregir(%s, '2026-03-02 08:00-05', '2026-03-02 16:00-05', null, 'x')::text$q$, _t.id)), 'Solo el administrador') from _u, _t;
select pg_temp.err('C02 exige motivo',
  pg_temp.como(a, format($q$select public.turno_corregir(%s, '2026-03-02 08:00-05', '2026-03-02 16:00-05', null, '  ')::text$q$, _t.id)), 'Escribe el motivo') from _u, _t;
select pg_temp.err('C03 no deja el almuerzo por fuera del turno',
  pg_temp.como(a, format($q$select public.turno_corregir(%s, '2026-03-02 08:00-05', '2026-03-02 16:00-05',
    '[{"inicio":"2026-03-02T15:30:00-05:00","fin":"2026-03-02T16:30:00-05:00"}]', 'Marcó tarde')::text$q$, _t.id)), 'El almuerzo debe caer dentro del turno') from _u, _t;
select pg_temp.err('C04 la salida no puede ser anterior a la entrada',
  pg_temp.como(a, format($q$select public.turno_corregir(%s, '2026-03-02 08:00-05', '2026-03-02 07:00-05', null, 'Marcó tarde')::text$q$, _t.id)), 'La salida debe ser posterior') from _u, _t;
select pg_temp.bien('C05 el administrador corrige entrada, salida y almuerzo',
  pg_temp.como(a, format($q$select public.turno_corregir(%s, '2026-03-02 08:00-05', '2026-03-02 16:00-05',
    '[{"inicio":"2026-03-02T12:00:00-05:00","fin":"2026-03-02T13:00:00-05:00"}]', 'Marcó tarde')::text$q$, _t.id))) from _u, _t;
select pg_temp.eq('C06 el turno guarda quién lo ajustó, el motivo y el almuerzo',
  (select (t.ajustado_por = a) || ' ' || t.ajuste_motivo || ' ' ||
          (select count(*) from public.turno_pausa p where p.turno_id = t.id) || ' ' ||
          to_char(t.inicio_el at time zone 'America/Bogota', 'HH24:MI')
     from public.turno t where t.id = _t.id), 'true Marcó tarde 1 08:00') from _u, _t;
select pg_temp.eq('C07 la bitácora deja el antes, el después, quién y por qué',
  (select (l.actor_id = a) || ' ' || l.motivo || ' ' ||
          ((l.before ->> 'inicio_el')::timestamptz = '2026-03-02 07:00-05') || ' ' ||
          ((l.after ->> 'inicio_el')::timestamptz = '2026-03-02 08:00-05') || ' ' ||
          jsonb_array_length(l.after -> 'pausas')
     from public.audit_log l where l.action = 'turno.ajustar' and l.entity_id = _t.id::text),
  'true Marcó tarde true true 1') from _u, _t;
select pg_temp.eq('C08 el empleado no ve la bitácora',
  pg_temp.como(e, 'select count(*)::text from public.audit_log'), '0') from _u;
select pg_temp.err('C09 crear a mano exige entrada y salida',
  pg_temp.como(a, format($q$select public.turno_crear_manual(%L, '2026-03-03 07:00-05', null, null, 'Se fue la luz')::text$q$, e)), 'Hacen falta') from _u;
select pg_temp.err('C10 un turno a mano no se puede cruzar con otro',
  pg_temp.como(a, format($q$select public.turno_crear_manual(%L, '2026-03-02 15:30-05', '2026-03-02 18:00-05', null, 'Se fue la luz')::text$q$, e)), 'Se cruza con otro turno') from _u;
select pg_temp.bien('C11 el administrador agrega un turno que no se marcó',
  pg_temp.como(a, format($q$select public.turno_crear_manual(%L, '2026-03-03 07:00-05', '2026-03-03 15:00-05', null, 'Se fue la luz')::text$q$, e))) from _u;
select pg_temp.eq('C12 queda como corregido a mano y sin foto',
  (select origen || ' ' || (foto_inicio_path is null and foto_fin_path is null) || ' ' || ajuste_motivo
     from public.turno where perfil_id = e and inicio_el = '2026-03-03 07:00-05'), 'ajuste true Se fue la luz') from _u;
select pg_temp.bien('C13 el administrador le pone la salida real al turno olvidado',
  pg_temp.como(a, format('select public.turno_corregir(%s, %L, %L, null, %L)::text',
    t.id, t.inicio_el, t.inicio_el + interval '8 hours', 'Olvidó cerrar')))
  from _u, public.turno t where t.perfil_id = _u.e and t.pendiente_revision;
select pg_temp.eq('C14 deja de estar pendiente y ya suma sus 8 horas',
  (select count(*) filter (where pendiente_revision) || ' ' ||
          count(*) filter (where ajuste_motivo = 'Olvidó cerrar' and fin_el - inicio_el = interval '8 hours')
     from public.turno where perfil_id = e), '0 1') from _u;
select pg_temp.err('C15 el coordinador no borra',
  pg_temp.como(c, format($q$select public.turno_eliminar(%s, 'x')::text$q$, _t.id)), 'Solo el administrador') from _u, _t;
select pg_temp.eq('C16 borrar devuelve las rutas de las fotos para limpiar el almacén',
  pg_temp.como(a, format($q$select array_to_string(public.turno_eliminar(%s, 'Marcación por error'), ',')$q$, t.id)),
  e || '/m03.jpg,' || e || '/m13.jpg')
  from _u, public.turno t where t.perfil_id = _u.e and t.foto_inicio_path = _u.e || '/m03.jpg';
select pg_temp.eq('C17 el turno borrado ya no está, se llevó su pausa y quedó en la bitácora',
  (select count(*) from public.turno where foto_inicio_path = e || '/m03.jpg') || ' ' ||
  (select count(*) from public.audit_log where action = 'turno.eliminar' and motivo = 'Marcación por error'), '0 1') from _u;
select pg_temp.eq('C18 el coordinador ve el listado con las correcciones',
  pg_temp.como(c, format($q$select string_agg(origen || ':' || minutos_trabajados || ':' || minutos_pausa, ',' order by inicio_el)
                               from public.turnos_listar('2026-03-01', '2026-03-08', %L)$q$, e)),
  'app:420:60,ajuste:480:0') from _u;

-- ════════════════════════════════════════════════════════════════════════════
-- I · Interruptor y ficha del empleado
-- ════════════════════════════════════════════════════════════════════════════
select pg_temp.err('I01 el coordinador no edita empleados',
  pg_temp.como(c, format($q$select public.empleado_actualizar(%L, 'Eva Empleada', 'Recepción', 'empleado', true, false)::text$q$, e)), 'Solo el administrador') from _u;
select pg_temp.err('I02 el administrador no se quita su propio acceso',
  pg_temp.como(a, format($q$select public.empleado_actualizar(%L, 'Ana Admin', null, 'empleado', true, false)::text$q$, a)), 'No puedes quitarte') from _u;
select pg_temp.bien('I03 el administrador apaga el interruptor',
  pg_temp.como(a, format($q$select public.empleado_actualizar(%L, 'Eva Empleada', 'Recepción', 'empleado', true, false)::text$q$, e))) from _u;
select pg_temp.err('I04 apagado el interruptor, la persona ya no puede marcar',
  pg_temp.como(e, format($q$select turno_id::text from public.turno_marcar('entrada', %L)$q$, e || '/i04.jpg')), 'Tu cuenta no registra turnos') from _u;
select pg_temp.eq('I05 el cambio del interruptor queda en la bitácora y guarda el cargo',
  (select count(*) from public.audit_log where action = 'empleado.marca_turno' and entity_id = e::text) || ' ' ||
  (select cargo from public.profiles where id = e), '1 Recepción') from _u;
update public.profiles p set activo = false from _u where p.id = _u.c;
select pg_temp.eq('I06 una cuenta inactiva deja de ver el reporte',
  pg_temp.como(c, 'select count(*)::text from public.turno'), '0') from _u;

-- ════════════════════════════════════════════════════════════════════════════
-- F · Fotos vencidas y minutos redondos
-- ════════════════════════════════════════════════════════════════════════════
insert into public.turno (perfil_id, inicio_el, fin_el, foto_inicio_path, foto_fin_path)
  select f, now() - interval '50 days', now() - interval '50 days' + interval '8 hours', f || '/a.jpg', f || '/b.jpg' from _u;
insert into public.turno (perfil_id, inicio_el, fin_el, foto_inicio_path, foto_fin_path)
  select f, now() - interval '46 days', now() - interval '44 days', f || '/c.jpg', f || '/d.jpg' from _u;
insert into public.turno (perfil_id, inicio_el, foto_inicio_path)
  select f, now() - interval '60 days', f || '/e.jpg' from _u;
select pg_temp.eq('F01 lista las vencidas; un turno cerrado se mide por la salida; uno abierto también vence',
  (select string_agg(right(ruta, 5), ',' order by ruta) from public.turno_fotos_vencidas() where ruta like f || '/%'),
  'a.jpg,b.jpg,e.jpg') from _u;
select pg_temp.eq('F02 deja quietas las recientes',
  (select count(*)::text from public.turno_fotos_vencidas() where ruta like e || '/%'), '0') from _u;
select pg_temp.err('F03 no acepta un plazo menor a un día',
  pg_temp.pg('select count(*)::text from public.turno_fotos_vencidas(0)'), 'al menos un día');
select pg_temp.eq('F04 olvidar las rutas dice cuántas limpió',
  (select public.turno_fotos_olvidar(array[f || '/a.jpg', f || '/b.jpg']))::text, '2') from _u;
select pg_temp.eq('F04b ... y conserva el turno',
  (select count(*)::text from public.turno where perfil_id = f and fin_el is not null
      and foto_inicio_path is null and foto_fin_path is null), '1') from _u;
insert into public.turno (perfil_id, inicio_el, fin_el)
  select f, '2026-02-02 07:00:45-05', '2026-02-02 15:00:59-05' from _u;
select pg_temp.eq('F05 los minutos quedan redondos por cualquier puerta',
  (select to_char(inicio_el at time zone 'America/Bogota', 'HH24:MI:SS') || ' ' ||
          to_char(fin_el at time zone 'America/Bogota', 'HH24:MI:SS')
     from public.turno where perfil_id = f and inicio_el::date = '2026-02-02'), '07:00:00 15:00:00') from _u;

select count(*) filter (where ok) as pasaron,
       count(*) filter (where not ok) as fallaron,
       coalesce(jsonb_agg(jsonb_build_object('prueba', prueba, 'detalle', detalle) order by n)
                filter (where not ok), '[]'::jsonb) as fallas
  from _r;

rollback;
