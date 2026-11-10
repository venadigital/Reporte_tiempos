-- Pruebas del cálculo de horas (public.turnos_horas).
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

create function pg_temp.usuario(p_nombre text) returns uuid
language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_nombre || '@prueba.test', jsonb_build_object('nombre', p_nombre), now(), now());
  update public.profiles set marca_turno = true where id = v;
  return v;
end; $$;

-- Un turno en hora de Colombia: t(persona, 'AAAA-MM-DD HH:MI', 'AAAA-MM-DD HH:MI' [, almuerzo])
create function pg_temp.t(p uuid, p_ini text, p_fin text, p_pi text default null, p_pf text default null)
returns void language plpgsql as $$
declare v bigint;
begin
  insert into public.turno (perfil_id, inicio_el, fin_el)
  values (p, (p_ini || '-05')::timestamptz, (p_fin || '-05')::timestamptz) returning id into v;
  if p_pi is not null then
    insert into public.turno_pausa (turno_id, inicio_el, fin_el)
    values (v, (p_pi || '-05')::timestamptz, (p_pf || '-05')::timestamptz);
  end if;
end; $$;

-- Turnos iguales de lunes a sábado en la semana del 2026-03-02
create function pg_temp.lun_sab(p uuid, p_ini text, p_fin text, p_pi text default null, p_pf text default null)
returns void language plpgsql as $$
declare d date;
begin
  for d in select generate_series('2026-03-02'::date, '2026-03-07'::date, '1 day')::date loop
    perform pg_temp.t(p, d || ' ' || p_ini, d || ' ' || p_fin,
                      case when p_pi is not null then d || ' ' || p_pi end,
                      case when p_pf is not null then d || ' ' || p_pf end);
  end loop;
end; $$;

-- Resumen en horas de los baldes que no están en cero, p. ej. "d=5 n=2 en=2"
create function pg_temp.h(p uuid, p_desde date, p_hasta date) returns text
language sql as $$
  with s as (
    select coalesce(sum(diurnas), 0) d, coalesce(sum(nocturnas), 0) n,
           coalesce(sum(extra_diurnas), 0) ed, coalesce(sum(extra_nocturnas), 0) en,
           coalesce(sum(dom_diurnas), 0) dd, coalesce(sum(dom_nocturnas), 0) dn,
           coalesce(sum(dom_extra_diurnas), 0) ded, coalesce(sum(dom_extra_nocturnas), 0) den
      from public.turnos_horas(p_desde, p_hasta, p)
  )
  select coalesce(nullif(concat_ws(' ',
    case when d   > 0 then 'd='   || trim_scale(round(d   / 60.0, 2)) end,
    case when n   > 0 then 'n='   || trim_scale(round(n   / 60.0, 2)) end,
    case when ed  > 0 then 'ed='  || trim_scale(round(ed  / 60.0, 2)) end,
    case when en  > 0 then 'en='  || trim_scale(round(en  / 60.0, 2)) end,
    case when dd  > 0 then 'dd='  || trim_scale(round(dd  / 60.0, 2)) end,
    case when dn  > 0 then 'dn='  || trim_scale(round(dn  / 60.0, 2)) end,
    case when ded > 0 then 'ded=' || trim_scale(round(ded / 60.0, 2)) end,
    case when den > 0 then 'den=' || trim_scale(round(den / 60.0, 2)) end), ''), 'cero')
  from s;
$$;

create function pg_temp.limpia(p uuid) returns void
language sql as $$ delete from public.turno where perfil_id = p; $$;

create temp table _u on commit drop as select pg_temp.usuario('Prueba Horas') as id;

-- ════════════════════════════════════════════════════════════════════════════
-- A. Configuración de referencia: jornada de 7 h y regla "después de las 9 p. m. es extra".
--    Reproduce los ejemplos de referencia del diseño original.
-- ════════════════════════════════════════════════════════════════════════════
update public.configuracion set jornada_diaria_min = 420, hora_cierre_operacion = 21 where id;

select pg_temp.t(id, '2026-03-02 07:00', '2026-03-02 15:00', '2026-03-02 12:00', '2026-03-02 13:00') from _u;
select pg_temp.eq('A01 7:00-15:00 con almuerzo = 7 diurnas', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=7') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-02 13:00', '2026-03-02 21:00', '2026-03-02 16:00', '2026-03-02 17:00') from _u;
select pg_temp.eq('A02 13:00-21:00 = 5 diurnas + 2 nocturnas', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=5 n=2') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-02 13:00', '2026-03-02 23:00', '2026-03-02 16:00', '2026-03-02 17:00') from _u;
select pg_temp.eq('A03 13:00-23:00 (9 h) = 5 + 2 + 2 extra nocturnas', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=5 n=2 en=2') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-02 17:00', '2026-03-02 23:00') from _u;
select pg_temp.eq('A04 17:00-23:00: regla de las 9 p. m.', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=2 n=2 en=2') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-02 09:00', '2026-03-02 21:00', '2026-03-02 13:00', '2026-03-02 14:00') from _u;
select pg_temp.eq('A05 9:00-21:00 (11 h) = 7 + 2 extra diurnas + 2 extra nocturnas', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=7 ed=2 en=2') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.lun_sab(id, '07:00', '14:00') from _u;
select pg_temp.t(id, '2026-03-08 08:00', '2026-03-08 12:00') from _u;
select pg_temp.eq('A06 lunes a sábado 7 h + domingo 4 h = 42 + 4 dominicales extra', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=42 ded=4') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.lun_sab(id, '07:00', '15:00') from _u;
select pg_temp.eq('A07 8 h x 6 días = 42 + 6 extra (no 37 + 11)', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=42 ed=6') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.lun_sab(id, '09:00', '21:00', '13:00', '14:00') from _u;
select pg_temp.eq('A08 11 h x 6 días = 42 + 12 + 12', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=42 ed=12 en=12') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-02 07:00', '2026-03-02 17:00') from _u;
select pg_temp.t(id, d || ' 07:00', d || ' 14:00')
  from _u, generate_series('2026-03-03'::date, '2026-03-06'::date, '1 day') g(d0), lateral (select g.d0::date as d) x;
select pg_temp.t(id, '2026-03-07 07:00', '2026-03-07 11:00') from _u;
select pg_temp.eq('A09 día largo compensado con uno corto sigue dando 3 extra', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=39 ed=3') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, d || ' 07:00', d || ' 14:00')
  from _u, generate_series('2026-03-02'::date, '2026-03-06'::date, '1 day') g(d0), lateral (select g.d0::date as d) x;
select pg_temp.t(id, '2026-03-07 07:00', '2026-03-07 10:00') from _u;
select pg_temp.t(id, '2026-03-08 07:00', '2026-03-08 14:00') from _u;
select pg_temp.eq('A10 llega al domingo con 38 h y trabaja 7 = 4 dominicales + 3 dominicales extra', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=38 dd=4 ded=3') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-23 07:00', '2026-03-23 15:00', '2026-03-23 12:00', '2026-03-23 13:00') from _u;
select pg_temp.eq('A11 festivo 7:00-15:00 = 7 dominicales', pg_temp.h(id, '2026-03-23', '2026-03-29'), 'dd=7') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-08 18:00', '2026-03-08 20:00') from _u;
select pg_temp.eq('A12 domingo 18:00-20:00 = 1 dominical diurna + 1 nocturna', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'dd=1 dn=1') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-02 05:00', '2026-03-02 08:00') from _u;
select pg_temp.eq('A13 la franja diurna arranca a las 6 (antes: extra nocturna con la regla de cierre)', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=2 en=1') from _u;
select pg_temp.limpia(id) from _u;

-- ════════════════════════════════════════════════════════════════════════════
-- B. Configuración con turnos de noche: jornada de 8 h, sin regla de cierre.
-- ════════════════════════════════════════════════════════════════════════════
update public.configuracion set jornada_diaria_min = 480, hora_cierre_operacion = null where id;

select pg_temp.t(id, '2026-03-02 22:00', '2026-03-03 06:00') from _u;
select pg_temp.eq('B01 22:00-06:00 = 8 nocturnas, una sola jornada, sin extras', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'n=8') from _u;
select pg_temp.eq('B02 el turno que cruza la medianoche se reparte por día: lunes 2 h', pg_temp.h(id, '2026-03-02', '2026-03-02'), 'n=2') from _u;
select pg_temp.eq('B03 ... y martes 6 h', pg_temp.h(id, '2026-03-03', '2026-03-03'), 'n=6') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-02 22:00', '2026-03-03 07:00') from _u;
select pg_temp.eq('B04 22:00-07:00 (9 h) = 8 nocturnas + 1 extra diurna', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'n=8 ed=1') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-07 22:00', '2026-03-08 06:00') from _u;
select pg_temp.eq('B05 sábado 22:00 a domingo 06:00 = 2 nocturnas + 6 dominicales nocturnas', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'n=2 dn=6') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-08 22:00', '2026-03-09 06:00') from _u;
select pg_temp.eq('B06 domingo 22:00 a lunes 06:00: la parte del domingo', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'dn=2') from _u;
select pg_temp.eq('B07 ... y la del lunes, ya en la semana siguiente', pg_temp.h(id, '2026-03-09', '2026-03-15'), 'n=6') from _u;
select pg_temp.limpia(id) from _u;

-- Dos turnos que EMPIEZAN el mismo día son una sola jornada: 6 h + 6 h = 8 ordinarias + 4 extra.
-- Las extra caen el lunes; pedir solo el lunes tiene que seguir viendo el turno del domingo.
select pg_temp.t(id, '2026-03-08 08:00', '2026-03-08 14:00') from _u;
select pg_temp.t(id, '2026-03-08 22:00', '2026-03-09 04:00') from _u;
select pg_temp.eq('B08 jornada que empieza el domingo y pasa de 8 h el lunes', pg_temp.h(id, '2026-03-09', '2026-03-09'), 'en=4') from _u;
select pg_temp.eq('B09 ... el domingo conserva sus 8 ordinarias', pg_temp.h(id, '2026-03-08', '2026-03-08'), 'dd=6 dn=2') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.lun_sab(id, '07:00', '15:00') from _u;
select pg_temp.eq('B10 jornada de 8 h x 6 días = 42 + 6 extra por la semana', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=42 ed=6') from _u;
select pg_temp.eq('B11 pedir medio periodo no reinicia el contador de las 42 h', pg_temp.h(id, '2026-03-07', '2026-03-07'), 'd=2 ed=6') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-02 15:00', '2026-03-02 23:00', '2026-03-02 19:00', '2026-03-02 20:00') from _u;
select pg_temp.eq('B12 el almuerzo se descuenta de la franja en que ocurre', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=4 n=3') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.t(id, '2026-03-02 07:00', '2026-03-02 07:01') from _u;
select pg_temp.eq('B13 cuenta al minuto exacto',
  (select sum(total)::text from public.turnos_horas('2026-03-02', '2026-03-02', (select id from _u))), '1');
select pg_temp.limpia(id) from _u;

insert into public.turno (perfil_id, inicio_el) select id, '2026-03-02 07:00-05' from _u;
select pg_temp.eq('B14 un turno abierto no aporta horas', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'cero') from _u;
select pg_temp.limpia(id) from _u;

-- Una pausa abierta no descuenta (solo las cerradas)
select pg_temp.t(id, '2026-03-02 07:00', '2026-03-02 11:00') from _u;
insert into public.turno_pausa (turno_id, inicio_el)
  select t.id, '2026-03-02 09:00-05' from public.turno t, _u where t.perfil_id = _u.id;
select pg_temp.eq('B15 solo se descuentan las pausas cerradas', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'd=4') from _u;
select pg_temp.limpia(id) from _u;

select pg_temp.eq('B16 un periodo sin turnos no falla', pg_temp.h(id, '2026-03-02', '2026-03-08'), 'cero') from _u;

select count(*) filter (where ok) as pasaron,
       count(*) filter (where not ok) as fallaron,
       coalesce(jsonb_agg(jsonb_build_object('prueba', prueba, 'detalle', detalle) order by n)
                filter (where not ok), '[]'::jsonb) as fallas
  from _r;

rollback;
