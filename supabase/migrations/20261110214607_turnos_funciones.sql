-- Turnos: marcar (celular y quiosco), PIN, correcciones y fotos vencidas.
-- Toda escritura pasa por estas funciones; las tablas no tienen permisos de escritura.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. MARCAR
-- ════════════════════════════════════════════════════════════════════════════

-- La implementación ÚNICA de las cuatro marcaciones. La usan las dos puertas.
-- La hora la pone el servidor: no existe parámetro de hora.
create or replace function private.turno_marcar(
  p_perfil uuid, p_accion text, p_foto_path text, p_origen text
) returns table (turno_id bigint, marcado_el timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_ahora   timestamptz := date_trunc('minute', now());
  v_max     interval;
  v_turno   public.turno%rowtype;
  v_vencido boolean;
  v_pausa   bigint;
  v_id      bigint;
begin
  if p_accion not in ('entrada', 'salida', 'pausa_inicio', 'pausa_fin') then
    raise exception 'Acción desconocida: %', p_accion;
  end if;
  -- La foto tiene que estar en la carpeta de la persona que marca
  if p_foto_path is not null and p_foto_path not like p_perfil::text || '/%' then
    raise exception 'La foto no corresponde a esta persona.';
  end if;

  -- Dos marcaciones simultáneas de la misma persona entran de a una
  perform pg_advisory_xact_lock(hashtextextended('turno:' || p_perfil::text, 0));

  select make_interval(hours => c.turno_max_horas) into v_max from public.configuracion c;

  select t.* into v_turno
    from public.turno t
   where t.perfil_id = p_perfil and t.fin_el is null and not t.pendiente_revision;
  v_vencido := v_turno.id is not null and v_turno.inicio_el < now() - v_max;

  if p_accion = 'entrada' then
    if v_turno.id is not null and not v_vencido then
      raise exception 'Ya tienes un turno abierto. Ciérralo antes de iniciar otro.';
    end if;
    if p_foto_path is null then raise exception 'Falta la foto de entrada.'; end if;
    if v_vencido then
      -- El turno viejo queda "sin cerrar" para el administrador y deja libre el cupo
      update public.turno t set pendiente_revision = true where t.id = v_turno.id;
    end if;
    insert into public.turno (perfil_id, inicio_el, foto_inicio_path, origen)
    values (p_perfil, v_ahora, p_foto_path, p_origen)
    returning id into v_id;
    return query select v_id, v_ahora;
    return;
  end if;

  if v_turno.id is null then raise exception 'No tienes un turno abierto.'; end if;
  if v_vencido then
    -- Nunca se inventa la salida: un turno olvidado no se cierra días después
    raise exception 'Tu turno anterior quedó sin cerrar y está pendiente de revisión. Inicia el turno de hoy; el administrador corrige el anterior.';
  end if;

  select p.id into v_pausa
    from public.turno_pausa p
   where p.turno_id = v_turno.id and p.fin_el is null;

  if p_accion = 'pausa_inicio' then
    if v_pausa is not null then raise exception 'Ya marcaste tu salida a almorzar.'; end if;
    insert into public.turno_pausa (turno_id, inicio_el) values (v_turno.id, v_ahora);
  elsif p_accion = 'pausa_fin' then
    if v_pausa is null then raise exception 'No tienes una pausa abierta.'; end if;
    update public.turno_pausa p set fin_el = v_ahora where p.id = v_pausa;
  else -- salida
    if v_pausa is not null then
      raise exception 'Primero marca tu regreso del almuerzo.';
    end if;
    if p_foto_path is null then raise exception 'Falta la foto de salida.'; end if;
    update public.turno t set fin_el = v_ahora, foto_fin_path = p_foto_path where t.id = v_turno.id;
  end if;

  return query select v_turno.id, v_ahora;
end; $$;

-- Puerta 1 · el celular (o cualquier equipo) con la sesión de la persona
create or replace function public.turno_marcar(p_accion text, p_foto_path text default null)
returns table (turno_id bigint, marcado_el timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_perfil uuid := (select auth.uid());
begin
  if v_perfil is null then raise exception 'No hay sesión.'; end if;
  if not exists (select 1 from public.profiles p
                  where p.id = v_perfil and p.activo and p.marca_turno) then
    raise exception 'Tu cuenta no registra turnos.';
  end if;
  return query select m.turno_id, m.marcado_el
                 from private.turno_marcar(v_perfil, p_accion, p_foto_path, 'app') m;
end; $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. QUIOSCO Y PIN
-- ════════════════════════════════════════════════════════════════════════════

create or replace function private.exige_quiosco() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  -- coalesce: con rol nulo, "not in" daría nulo y NO lanzaría el error
  if coalesce(private.user_role()::text, '') not in ('quiosco', 'admin') then
    raise exception 'Esta pantalla solo funciona en el equipo compartido.' using errcode = '42501';
  end if;
end; $$;

-- La implementación ÚNICA de la comprobación del PIN.
-- DEVUELVE el fallo, no lo lanza: un error revertiría la transacción y con ella
-- el conteo del intento fallido, y el bloqueo nunca llegaría a activarse.
create or replace function private.quiosco_pin_check(p_perfil uuid, p_pin text)
returns table (ok boolean, mensaje text)
language plpgsql security definer set search_path = '' as $$
declare
  v_pin     public.turno_pin%rowtype;
  v_max     int;
  v_bloqueo int;
  v_restan  int;
begin
  select c.pin_intentos_max, c.pin_bloqueo_min into v_max, v_bloqueo from public.configuracion c;

  select tp.* into v_pin from public.turno_pin tp where tp.perfil_id = p_perfil for update;
  if v_pin.perfil_id is null then
    return query select false, 'Todavía no tienes PIN. Pídeselo al administrador.'::text;
    return;
  end if;
  if v_pin.bloqueado_hasta is not null then
    if v_pin.bloqueado_hasta > now() then
      return query select false, 'PIN bloqueado por intentos fallidos. Intenta en unos minutos.'::text;
      return;
    end if;
    v_pin.intentos := 0;   -- el bloqueo ya venció: la cuenta arranca de nuevo
  end if;

  if p_pin is null or v_pin.pin_hash is distinct from extensions.crypt(p_pin, v_pin.pin_hash) then
    update public.turno_pin tp
       set intentos = v_pin.intentos + 1,
           bloqueado_hasta = case when v_pin.intentos + 1 >= v_max
                                  then now() + make_interval(mins => v_bloqueo) end
     where tp.perfil_id = p_perfil;
    v_restan := v_max - (v_pin.intentos + 1);
    return query select false,
      (case when v_restan <= 0 then format('PIN bloqueado %s minutos por intentos fallidos.', v_bloqueo)
            when v_restan = 1  then 'PIN incorrecto. Te queda 1 intento.'
            else format('PIN incorrecto. Te quedan %s intentos.', v_restan) end)::text;
    return;
  end if;

  update public.turno_pin tp set intentos = 0, bloqueado_hasta = null where tp.perfil_id = p_perfil;
  return query select true, null::text;
end; $$;

-- Lista para la pantalla del quiosco. Sin datos personales: nombre, estado y si tiene PIN.
create or replace function public.quiosco_estado()
returns table (
  perfil_id uuid, nombre text, en_turno boolean, inicio_el timestamptz,
  en_pausa boolean, pausa_inicio_el timestamptz, tiene_pin boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exige_quiosco();
  return query
    select p.id, p.nombre,
           t.id is not null,
           t.inicio_el,
           pa.id is not null,
           pa.inicio_el,
           exists (select 1 from public.turno_pin tp where tp.perfil_id = p.id)
      from public.profiles p
      cross join public.configuracion c
      -- un turno abierto que ya pasó el máximo cuenta como "sin turno"
      left join public.turno t
        on t.perfil_id = p.id and t.fin_el is null and not t.pendiente_revision
       and t.inicio_el >= now() - make_interval(hours => c.turno_max_horas)
      left join public.turno_pausa pa on pa.turno_id = t.id and pa.fin_el is null
     where p.activo and p.marca_turno
     order by p.nombre;
end; $$;

-- Comprueba el PIN ANTES de abrir la cámara. No marca nada.
create or replace function public.quiosco_pin_verificar(p_perfil uuid, p_pin text)
returns table (ok boolean, mensaje text)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.exige_quiosco();
  if not exists (select 1 from public.profiles p
                  where p.id = p_perfil and p.activo and p.marca_turno) then
    raise exception 'Esa persona no registra turnos.';
  end if;
  return query select c.ok, c.mensaje from private.quiosco_pin_check(p_perfil, p_pin) c;
end; $$;

-- Puerta 2 · el quiosco. Vuelve a comprobar el PIN: saltarse la verificación
-- desde el navegador no sirve.
create or replace function public.quiosco_marcar(
  p_perfil uuid, p_pin text, p_accion text, p_foto_path text default null
) returns table (ok boolean, mensaje text, turno_id bigint, marcado_el timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_check record;
begin
  perform private.exige_quiosco();
  if not exists (select 1 from public.profiles p
                  where p.id = p_perfil and p.activo and p.marca_turno) then
    raise exception 'Esa persona no registra turnos.';
  end if;
  select c.ok, c.mensaje into v_check from private.quiosco_pin_check(p_perfil, p_pin) c;
  if not v_check.ok then
    return query select false, v_check.mensaje, null::bigint, null::timestamptz;
    return;
  end if;
  return query select true, null::text, m.turno_id, m.marcado_el
                 from private.turno_marcar(p_perfil, p_accion, p_foto_path, 'quiosco') m;
end; $$;

-- PIN: lo asigna el administrador. No se puede volver a ver.
create or replace function public.turno_pin_asignar(p_perfil uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.exige_admin();
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'El PIN debe tener exactamente 4 dígitos.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_perfil and p.role <> 'quiosco') then
    raise exception 'Esa persona no existe.' using errcode = 'P0002';
  end if;
  insert into public.turno_pin (perfil_id, pin_hash, intentos, bloqueado_hasta)
  values (p_perfil, extensions.crypt(p_pin, extensions.gen_salt('bf')), 0, null)
  on conflict (perfil_id) do update
    set pin_hash = excluded.pin_hash, intentos = 0, bloqueado_hasta = null;
  -- en la bitácora queda el hecho, nunca el valor
  perform private.audit('turno.pin_asignar', 'turno_pin', p_perfil::text, null, null);
end; $$;

-- La ficha solo sabe responder "¿tiene PIN?: sí / no"
create or replace function public.turno_pin_estado(p_perfil uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exige_admin();
  return exists (select 1 from public.turno_pin tp where tp.perfil_id = p_perfil);
end; $$;

create or replace function public.turno_pin_borrar(p_perfil uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.exige_admin();
  delete from public.turno_pin tp where tp.perfil_id = p_perfil;
  if found then
    perform private.audit('turno.pin_borrar', 'turno_pin', p_perfil::text, null, null);
  end if;
end; $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. CORRECCIONES (solo administrador, motivo obligatorio, bitácora)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function private.turno_snapshot(p_turno bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'perfil_id', t.perfil_id,
    'inicio_el', t.inicio_el,
    'fin_el', t.fin_el,
    'origen', t.origen,
    'pendiente_revision', t.pendiente_revision,
    'pausas', coalesce((
      select jsonb_agg(jsonb_build_object('inicio_el', p.inicio_el, 'fin_el', p.fin_el)
                       order by p.inicio_el)
        from public.turno_pausa p where p.turno_id = t.id), '[]'::jsonb))
    from public.turno t
   where t.id = p_turno;
$$;

-- Validación ÚNICA de un turno escrito a mano (corregir y crear la comparten).
-- p_pausas: [{"inicio": "<instante>", "fin": "<instante>"}, ...]
create or replace function private.turno_valida(
  p_perfil uuid, p_turno bigint, p_inicio timestamptz, p_fin timestamptz, p_pausas jsonb
) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  r       record;
  v_prev  timestamptz;
  v_cruce date;
begin
  if p_inicio is null or p_fin is null then
    raise exception 'Hacen falta la hora de entrada y la de salida.';
  end if;
  if p_fin <= p_inicio then
    raise exception 'La salida debe ser posterior a la entrada.';
  end if;
  if p_fin > now() then
    raise exception 'La salida no puede estar en el futuro.';
  end if;
  if p_pausas is not null and jsonb_typeof(p_pausas) <> 'array' then
    raise exception 'El formato de las pausas no es válido.';
  end if;

  for r in
    select date_trunc('minute', x.inicio) as inicio, date_trunc('minute', x.fin) as fin
      from jsonb_to_recordset(coalesce(p_pausas, '[]'::jsonb)) as x(inicio timestamptz, fin timestamptz)
     order by 1
  loop
    if r.inicio is null or r.fin is null then
      raise exception 'Cada almuerzo necesita la hora de salida y la de regreso.';
    end if;
    if r.fin <= r.inicio then
      raise exception 'El regreso del almuerzo debe ser posterior a la salida a almorzar.';
    end if;
    if r.inicio < p_inicio or r.fin > p_fin then
      raise exception 'El almuerzo debe caer dentro del turno.';
    end if;
    if v_prev is not null and r.inicio < v_prev then
      raise exception 'Las pausas se cruzan entre sí.';
    end if;
    v_prev := r.fin;
  end loop;

  -- Dos turnos cruzados contarían los mismos minutos dos veces
  select (t.inicio_el at time zone c.zona_horaria)::date into v_cruce
    from public.turno t cross join public.configuracion c
   where t.perfil_id = p_perfil
     and (p_turno is null or t.id <> p_turno)
     and not t.pendiente_revision
     and tstzrange(t.inicio_el, coalesce(t.fin_el, 'infinity'::timestamptz))
         && tstzrange(p_inicio, p_fin)
   limit 1;
  if found then
    raise exception 'Se cruza con otro turno de esta persona (el del %).', to_char(v_cruce, 'DD/MM/YYYY');
  end if;
end; $$;

-- Corregir un turno: entrada, salida y almuerzo en una sola operación atómica.
create or replace function public.turno_corregir(
  p_turno bigint, p_inicio timestamptz, p_fin timestamptz, p_pausas jsonb, p_motivo text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_t      public.turno%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_inicio timestamptz := date_trunc('minute', p_inicio);
  v_fin    timestamptz := date_trunc('minute', p_fin);
  v_antes  jsonb;
begin
  perform private.exige_admin();
  if v_motivo = '' then raise exception 'Escribe el motivo de la corrección.'; end if;

  select t.* into v_t from public.turno t where t.id = p_turno for update;
  if not found then raise exception 'Ese turno no existe.' using errcode = 'P0002'; end if;

  perform private.turno_valida(v_t.perfil_id, p_turno, v_inicio, v_fin, p_pausas);
  v_antes := private.turno_snapshot(p_turno);

  -- Orden no intercambiable: fuera las pausas → ajustar el turno → poner el almuerzo
  delete from public.turno_pausa p where p.turno_id = p_turno;
  update public.turno t
     set inicio_el = v_inicio,
         fin_el = v_fin,
         pendiente_revision = false,
         ajustado_por = (select auth.uid()),
         ajuste_motivo = v_motivo
   where t.id = p_turno;
  insert into public.turno_pausa (turno_id, inicio_el, fin_el)
  select p_turno, x.inicio, x.fin
    from jsonb_to_recordset(coalesce(p_pausas, '[]'::jsonb)) as x(inicio timestamptz, fin timestamptz);

  perform private.audit('turno.ajustar', 'turno', p_turno::text,
                        v_antes, private.turno_snapshot(p_turno), v_motivo);
end; $$;

-- Agregar un turno que nunca se marcó. No lleva foto y queda como "corregido a mano".
create or replace function public.turno_crear_manual(
  p_perfil uuid, p_inicio timestamptz, p_fin timestamptz, p_pausas jsonb, p_motivo text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_inicio timestamptz := date_trunc('minute', p_inicio);
  v_fin    timestamptz := date_trunc('minute', p_fin);
  v_id     bigint;
begin
  perform private.exige_admin();
  if v_motivo = '' then raise exception 'Escribe el motivo de la corrección.'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_perfil and p.role <> 'quiosco') then
    raise exception 'Esa persona no existe.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('turno:' || p_perfil::text, 0));
  perform private.turno_valida(p_perfil, null, v_inicio, v_fin, p_pausas);

  insert into public.turno (perfil_id, inicio_el, fin_el, origen, ajustado_por, ajuste_motivo)
  values (p_perfil, v_inicio, v_fin, 'ajuste', (select auth.uid()), v_motivo)
  returning id into v_id;
  insert into public.turno_pausa (turno_id, inicio_el, fin_el)
  select v_id, x.inicio, x.fin
    from jsonb_to_recordset(coalesce(p_pausas, '[]'::jsonb)) as x(inicio timestamptz, fin timestamptz);

  perform private.audit('turno.crear_manual', 'turno', v_id::text,
                        null, private.turno_snapshot(v_id), v_motivo);
  return v_id;
end; $$;

-- Borrar una marcación hecha por error. Se lleva sus pausas y devuelve las rutas
-- de sus fotos para que el servidor borre los archivos.
create or replace function public.turno_eliminar(p_turno bigint, p_motivo text) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_t      public.turno%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_antes  jsonb;
begin
  perform private.exige_admin();
  if v_motivo = '' then raise exception 'Escribe el motivo de la corrección.'; end if;

  select t.* into v_t from public.turno t where t.id = p_turno for update;
  if not found then raise exception 'Ese turno no existe.' using errcode = 'P0002'; end if;

  v_antes := private.turno_snapshot(p_turno);
  delete from public.turno t where t.id = p_turno;
  perform private.audit('turno.eliminar', 'turno', p_turno::text, v_antes, null, v_motivo);

  return array_remove(array[v_t.foto_inicio_path, v_t.foto_fin_path], null);
end; $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. FOTOS VENCIDAS (solo la tarea automática, con la llave de servicio)
-- ════════════════════════════════════════════════════════════════════════════

-- El plazo que manda es configuracion.fotos_dias. Se cuenta desde la salida
-- (la más nueva de las dos fotos); un turno abierto, desde la entrada.
create or replace function public.turno_fotos_vencidas(p_dias int default null)
returns table (turno_id bigint, ruta text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_dias int;
begin
  select coalesce(p_dias, c.fotos_dias) into v_dias from public.configuracion c;
  if v_dias < 1 then raise exception 'El plazo tiene que ser de al menos un día.'; end if;
  return query
    select t.id, f.ruta
      from public.turno t
      cross join lateral (values (t.foto_inicio_path), (t.foto_fin_path)) as f(ruta)
     where f.ruta is not null
       and coalesce(t.fin_el, t.inicio_el) < now() - make_interval(days => v_dias)
     order by t.id;
end; $$;

-- Se llama DESPUÉS de borrar los archivos. Al revés, si el borrado fallara,
-- los archivos quedarían huérfanos para siempre.
create or replace function public.turno_fotos_olvidar(p_rutas text[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_a int;
  v_b int;
begin
  update public.turno t set foto_inicio_path = null where t.foto_inicio_path = any (p_rutas);
  get diagnostics v_a = row_count;
  update public.turno t set foto_fin_path = null where t.foto_fin_path = any (p_rutas);
  get diagnostics v_b = row_count;
  return v_a + v_b;
end; $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. PERMISOS DE EJECUCIÓN
-- ════════════════════════════════════════════════════════════════════════════
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon;

grant execute on function private.user_role()  to authenticated, service_role;
grant execute on function private.ve_reporte() to authenticated, service_role;

grant execute on function public.empleado_actualizar(uuid, text, text, public.app_role, boolean, boolean) to authenticated;
grant execute on function public.turno_marcar(text, text)                          to authenticated;
grant execute on function public.quiosco_estado()                                  to authenticated;
grant execute on function public.quiosco_pin_verificar(uuid, text)                 to authenticated;
grant execute on function public.quiosco_marcar(uuid, text, text, text)            to authenticated;
grant execute on function public.turno_pin_asignar(uuid, text)                     to authenticated;
grant execute on function public.turno_pin_estado(uuid)                            to authenticated;
grant execute on function public.turno_pin_borrar(uuid)                            to authenticated;
grant execute on function public.turno_corregir(bigint, timestamptz, timestamptz, jsonb, text)   to authenticated;
grant execute on function public.turno_crear_manual(uuid, timestamptz, timestamptz, jsonb, text) to authenticated;
grant execute on function public.turno_eliminar(bigint, text)                      to authenticated;

-- Las fotos vencidas solo las pide la tarea automática
grant execute on function public.turno_fotos_vencidas(int)     to service_role;
grant execute on function public.turno_fotos_olvidar(text[])   to service_role;
