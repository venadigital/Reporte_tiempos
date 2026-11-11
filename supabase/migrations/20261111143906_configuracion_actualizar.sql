-- Guardar la configuración desde la pantalla del administrador principal.
-- Solo los parámetros del negocio; las franjas y los topes que fija la ley
-- (diurna/nocturna, 42 h semanales, topes de extras) no se editan desde aquí.
--
-- OJO: el cálculo de horas se hace al consultar, con la configuración vigente.
-- Cambiar la jornada diaria o la regla de cierre cambia las horas de TODOS los
-- periodos, también los ya pagados. Queda en la bitácora con el antes y el después.
create or replace function public.configuracion_actualizar(
  p_jornada_diaria_min int,
  p_hora_cierre_operacion int,      -- vacío = la regla no aplica
  p_turno_max_horas int,
  p_aviso_sin_almuerzo_min int,
  p_fotos_dias int,
  p_pin_intentos_max int,
  p_pin_bloqueo_min int
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_antes   public.configuracion%rowtype;
  v_despues public.configuracion%rowtype;
begin
  perform private.exige_admin();

  if p_jornada_diaria_min is null or p_jornada_diaria_min not between 60 and 720 then
    raise exception 'La jornada diaria debe estar entre 1 y 12 horas.';
  end if;
  if p_hora_cierre_operacion is not null and p_hora_cierre_operacion not between 0 and 23 then
    raise exception 'La hora de cierre debe estar entre 0 y 23.';
  end if;
  if p_turno_max_horas is null or p_turno_max_horas not between 4 and 48 then
    raise exception 'El máximo de un turno abierto debe estar entre 4 y 48 horas.';
  end if;
  if p_turno_max_horas * 60 <= p_jornada_diaria_min then
    raise exception 'El máximo de un turno abierto debe ser mayor que la jornada diaria.';
  end if;
  if p_aviso_sin_almuerzo_min is null or p_aviso_sin_almuerzo_min not between 60 and 720 then
    raise exception 'El aviso de turno sin almuerzo debe estar entre 1 y 12 horas.';
  end if;
  if p_fotos_dias is null or p_fotos_dias not between 1 and 3650 then
    raise exception 'Las fotos se guardan entre 1 y 3650 días.';
  end if;
  if p_pin_intentos_max is null or p_pin_intentos_max not between 1 and 20 then
    raise exception 'Los intentos del PIN deben estar entre 1 y 20.';
  end if;
  if p_pin_bloqueo_min is null or p_pin_bloqueo_min not between 1 and 1440 then
    raise exception 'El bloqueo del PIN debe estar entre 1 y 1440 minutos.';
  end if;

  select * into v_antes from public.configuracion c where c.id for update;

  update public.configuracion c
     set jornada_diaria_min     = p_jornada_diaria_min,
         hora_cierre_operacion  = p_hora_cierre_operacion,
         turno_max_horas        = p_turno_max_horas,
         aviso_sin_almuerzo_min = p_aviso_sin_almuerzo_min,
         fotos_dias             = p_fotos_dias,
         pin_intentos_max       = p_pin_intentos_max,
         pin_bloqueo_min        = p_pin_bloqueo_min
   where c.id
   returning * into v_despues;

  perform private.audit('configuracion.actualizar', 'configuracion', 'unica',
                        to_jsonb(v_antes), to_jsonb(v_despues));
end; $$;

revoke execute on function public.configuracion_actualizar(int, int, int, int, int, int, int) from public, anon;
grant execute on function public.configuracion_actualizar(int, int, int, int, int, int, int) to authenticated;
