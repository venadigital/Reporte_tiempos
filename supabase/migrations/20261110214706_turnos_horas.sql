-- Cálculo de horas (el corazón del módulo) y listado de turnos.
--
-- Las dos funciones son INVOKER a propósito: corren con la sesión de quien
-- llama, así que las políticas de filas deciden qué ve cada quien. Al empleado
-- el cálculo le devuelve cero porque no puede leer sus turnos cerrados.

-- ── turnos_horas ────────────────────────────────────────────────────────────
-- Una fila por persona y DÍA con los ocho baldes en minutos. El reporte suma
-- cualquier periodo sin recalcular: cada minuto ya se clasificó mirando su
-- jornada y su semana completas.
--
-- Cada minuto trabajado (ya descontado el almuerzo) responde tres preguntas:
--   1. ¿Dominical?  Cae en domingo o en un festivo de la tabla.
--   2. ¿Nocturno?   Su hora es >= inicia_nocturna o < inicia_diurna.
--   3. ¿Extra?      Paso 1 · por la JORNADA: pasó de la jornada diaria.
--                   Paso 2 · por la SEMANA: de los que NO son extra por el paso 1,
--                   el que pase del tope semanal. Hacia el tope solo suman las
--                   horas ordinarias: ninguna hora se cuenta dos veces.
--
-- Turnos de noche: la jornada se cuenta por el día en que EMPIEZA el turno, no
-- por día calendario. Un turno de 10 p. m. a 6 a. m. es una sola jornada de 8 h
-- y no dos días con dos topes. El dominical y el nocturno sí van minuto a minuto
-- por el día y la hora en que cae cada uno.
create or replace function public.turnos_horas(
  p_desde date, p_hasta date, p_perfil uuid default null
) returns table (
  perfil_id uuid, dia date, semana date,
  diurnas int, nocturnas int, extra_diurnas int, extra_nocturnas int,
  dom_diurnas int, dom_nocturnas int, dom_extra_diurnas int, dom_extra_nocturnas int,
  total int
)
language sql stable set search_path = ''        -- SIN security definer, a propósito
as $$
  with param as (
    select c.zona_horaria          as zona,
           c.hora_inicia_diurna    as inicia_diurna,
           c.hora_inicia_nocturna  as inicia_nocturna,
           c.hora_cierre_operacion as cierre,          -- vacío = la regla no aplica
           c.jornada_diaria_min    as jornada_min,
           c.semana_max_min        as semana_min
      from public.configuracion c
  ),
  -- Semanas COMPLETAS que toca el periodo (date_trunc('week') = lunes): el
  -- contador semanal arranca el lunes aunque el periodo empiece a mitad de semana.
  rango as (
    select date_trunc('week', p_desde::timestamp)::date as desde,
           (date_trunc('week', p_hasta::timestamp) + interval '6 days')::date as hasta
  ),
  turnos as (
    select t.id, t.perfil_id, t.inicio_el, t.fin_el,
           (t.inicio_el at time zone p.zona)::date as dia_jornada
      from public.turno t, rango r, param p
     where t.fin_el is not null                               -- los abiertos aportan cero
       and (p_perfil is null or t.perfil_id = p_perfil)
       and (t.inicio_el at time zone p.zona)::date <= r.hasta
       -- un día de margen: la jornada del domingo anterior puede terminar el lunes
       and (t.fin_el at time zone p.zona)::date >= r.desde - 1
  ),
  -- Un renglón por minuto trabajado, ya descontado el almuerzo (solo pausas cerradas)
  minutos as (
    select t.perfil_id, t.dia_jornada, gs.minuto
      from turnos t
      cross join lateral generate_series(
        t.inicio_el, t.fin_el - interval '1 minute', interval '1 minute') as gs(minuto)
     where not exists (
       select 1 from public.turno_pausa pa
        where pa.turno_id = t.id and pa.fin_el is not null
          and gs.minuto >= pa.inicio_el and gs.minuto < pa.fin_el)
  ),
  ubicado as (
    select m.perfil_id, m.dia_jornada, m.minuto, (m.minuto at time zone p.zona) as local
      from minutos m, param p
  ),
  marcado as (
    select u.perfil_id, u.dia_jornada, u.minuto,
           u.local::date                     as dia,
           date_trunc('week', u.local)::date as semana,
           extract(hour from u.local)::int   as hora,
           (extract(isodow from u.local) = 7 or f.fecha is not null) as dominical
      from ubicado u
      left join public.festivo f on f.fecha = u.local::date
  ),
  -- Paso 1 · el orden dentro de la JORNADA decide qué minuto pasó del tope diario
  contado as (
    select mk.*,
           row_number() over (partition by mk.perfil_id, mk.dia_jornada order by mk.minuto) as n_jornada
      from marcado mk
  ),
  por_dia as (
    select c.*,
           (c.n_jornada > p.jornada_min
            or (p.cierre is not null
                and (c.hora >= p.cierre or c.hora < p.inicia_diurna))) as extra_dia
      from contado c, param p
  ),
  -- Paso 2 · hacia el tope semanal SOLO suman los minutos ordinarios
  por_semana as (
    select d.*,
           sum(case when d.extra_dia then 0 else 1 end)
             over (partition by d.perfil_id, d.semana order by d.minuto) as n_semana_ord
      from por_dia d
  ),
  clasificado as (
    select s.perfil_id, s.dia, s.semana, s.dominical,
           (s.hora >= p.inicia_nocturna or s.hora < p.inicia_diurna) as nocturna,
           (s.extra_dia or s.n_semana_ord > p.semana_min)            as extra
      from por_semana s, param p
  )
  select k.perfil_id, k.dia, k.semana,
         count(*) filter (where not k.dominical and not k.nocturna and not k.extra)::int,
         count(*) filter (where not k.dominical and     k.nocturna and not k.extra)::int,
         count(*) filter (where not k.dominical and not k.nocturna and     k.extra)::int,
         count(*) filter (where not k.dominical and     k.nocturna and     k.extra)::int,
         count(*) filter (where     k.dominical and not k.nocturna and not k.extra)::int,
         count(*) filter (where     k.dominical and     k.nocturna and not k.extra)::int,
         count(*) filter (where     k.dominical and not k.nocturna and     k.extra)::int,
         count(*) filter (where     k.dominical and     k.nocturna and     k.extra)::int,
         count(*)::int
    from clasificado k
   where k.dia between p_desde and p_hasta
   group by k.perfil_id, k.dia, k.semana
   order by k.perfil_id, k.dia;
$$;

-- ── turnos_listar ───────────────────────────────────────────────────────────
-- Un renglón por turno. Devuelve HECHOS, no juicios: los avisos (sin cerrar, sin
-- almuerzo, sin foto) los arma la aplicación, para que cambiar un umbral no
-- obligue a tocar la base. El día es el de la ENTRADA, en la zona configurada.
create or replace function public.turnos_listar(
  p_desde date, p_hasta date, p_perfil uuid default null
) returns table (
  turno_id bigint, perfil_id uuid, nombre text, dia date,
  inicio_el timestamptz, fin_el timestamptz,
  minutos_trabajados int,            -- vacío si está abierto: nunca cero
  minutos_pausa int, pausas jsonb, pausa_abierta boolean,
  foto_inicio_path text, foto_fin_path text,
  origen text, pendiente_revision boolean,
  ajustado_por uuid, ajustado_por_nombre text, ajuste_motivo text
)
language sql stable set search_path = ''        -- SIN security definer, a propósito
as $$
  select t.id, t.perfil_id, pr.nombre,
         (t.inicio_el at time zone c.zona_horaria)::date,
         t.inicio_el, t.fin_el,
         case when t.fin_el is null then null
              else (extract(epoch from t.fin_el - t.inicio_el) / 60)::int - coalesce(pa.minutos, 0)
         end,
         coalesce(pa.minutos, 0),
         coalesce(pa.lista, '[]'::jsonb),
         coalesce(pa.abierta, false),
         t.foto_inicio_path, t.foto_fin_path,
         t.origen, t.pendiente_revision,
         t.ajustado_por, aj.nombre, t.ajuste_motivo
    from public.turno t
    cross join public.configuracion c
    join public.profiles pr on pr.id = t.perfil_id
    left join public.profiles aj on aj.id = t.ajustado_por
    left join lateral (
      select (sum(extract(epoch from p.fin_el - p.inicio_el) / 60)
                filter (where p.fin_el is not null))::int as minutos,
             jsonb_agg(jsonb_build_object('id', p.id, 'inicio_el', p.inicio_el, 'fin_el', p.fin_el)
                       order by p.inicio_el) as lista,
             bool_or(p.fin_el is null) as abierta
        from public.turno_pausa p
       where p.turno_id = t.id
    ) pa on true
   where (t.inicio_el at time zone c.zona_horaria)::date between p_desde and p_hasta
     and (p_perfil is null or t.perfil_id = p_perfil)
   order by pr.nombre, t.inicio_el;
$$;

revoke execute on function public.turnos_horas(date, date, uuid)  from public, anon;
revoke execute on function public.turnos_listar(date, date, uuid) from public, anon;
grant execute on function public.turnos_horas(date, date, uuid)   to authenticated;
grant execute on function public.turnos_listar(date, date, uuid)  to authenticated;
