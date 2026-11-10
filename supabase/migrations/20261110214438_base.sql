-- Base de la aplicación: esquema privado, roles, perfiles, bitácora y configuración.

-- ── Esquema privado ─────────────────────────────────────────────────────────
-- No se expone por la API. `authenticated` solo necesita entrar para que las
-- políticas de filas puedan llamar a private.user_role().
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

-- ── Cerrado por defecto ─────────────────────────────────────────────────────
-- En Supabase toda tabla y función nueva del esquema público nace abierta para
-- anon y authenticated. Aquí se invierte: nada queda abierto si no se concede.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- ── Roles ───────────────────────────────────────────────────────────────────
--   admin        administrador principal: ve todo, corrige, asigna PIN
--   coordinador  ve el reporte y las fotos, solo lectura
--   empleado     solo marca su turno
--   quiosco      no es una persona: es el computador compartido
create type public.app_role as enum ('admin', 'coordinador', 'empleado', 'quiosco');

-- ── Perfiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null check (length(btrim(nombre)) > 0),
  cargo       text,                       -- actividad que desarrolla (art. 162 CST)
  role        public.app_role not null default 'empleado',
  activo      boolean not null default true,
  marca_turno boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_quiosco_no_marca check (not (role = 'quiosco' and marca_turno))
);

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end; $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Rol de la sesión. Una cuenta inactiva no tiene rol.
create or replace function private.user_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.activo;
$$;

-- Lista única de quién ve el reporte: de aquí beben todas las políticas.
create or replace function private.ve_reporte() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.user_role() in ('admin', 'coordinador'), false);
$$;

-- Lista única de quién corrige y administra.
create or replace function private.exige_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(private.user_role()::text, '') <> 'admin' then
    raise exception 'Solo el administrador principal puede hacer esto.' using errcode = '42501';
  end if;
end; $$;

grant execute on function private.user_role()  to authenticated, service_role;
grant execute on function private.ve_reporte() to authenticated, service_role;

-- El perfil nace con la cuenta. El rol NUNCA se toma de los datos del registro:
-- esos los escribe quien se registra.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nombre)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'nombre'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Sin nombre')
  );
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Nadie, salvo el administrador principal, cambia rol, estado o el interruptor
-- de turnos. Si alguien pudiera apagárselo, saldría de la nómina por horas sin
-- que nadie lo note. Sin sesión (migraciones, servidor) se permite.
create or replace function private.profiles_protege() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.role is distinct from old.role
      or new.activo is distinct from old.activo
      or new.marca_turno is distinct from old.marca_turno)
     and (select auth.uid()) is not null
     and coalesce(private.user_role()::text, '') <> 'admin' then
    raise exception 'Solo el administrador principal puede cambiar el rol, el estado o el registro de turnos.'
      using errcode = '42501';
  end if;
  return new;
end; $$;

create trigger profiles_protege before update on public.profiles
  for each row execute function private.profiles_protege();

-- ── Bitácora ────────────────────────────────────────────────────────────────
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  motivo     text,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx  on public.audit_log (entity, entity_id);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_actor_idx   on public.audit_log (actor_id);

create or replace function private.audit(
  p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb, p_motivo text default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after, motivo)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, p_before, p_after, p_motivo);
$$;

-- ── Configuración (una sola fila) ───────────────────────────────────────────
-- Cada número vive aquí y solo aquí: el cálculo, las reglas y los textos de
-- pantalla lo leen de esta fila.
create table public.configuracion (
  id                     boolean primary key default true check (id),
  zona_horaria           text not null default 'America/Bogota',
  hora_inicia_diurna     int  not null default 6  check (hora_inicia_diurna between 0 and 23),
  hora_inicia_nocturna   int  not null default 19 check (hora_inicia_nocturna between 0 and 23),
  -- Regla opcional del cliente: desde esta hora (y hasta que arranca la franja
  -- diurna) todo es extra. Vacío = no aplica. Con turnos de noche va vacío.
  hora_cierre_operacion  int  check (hora_cierre_operacion between 0 and 23),
  jornada_diaria_min     int  not null default 480  check (jornada_diaria_min between 60 and 720),
  semana_max_min         int  not null default 2520 check (semana_max_min between 600 and 4320),
  extras_tope_dia_min    int  not null default 120  check (extras_tope_dia_min > 0),
  extras_tope_semana_min int  not null default 720  check (extras_tope_semana_min > 0),
  -- Pasado este tiempo, un turno abierto ya no se puede cerrar desde la
  -- pantalla: queda "sin cerrar" para que lo corrija el administrador.
  turno_max_horas        int  not null default 14   check (turno_max_horas between 4 and 48),
  aviso_sin_almuerzo_min int  not null default 360  check (aviso_sin_almuerzo_min > 0),
  fotos_dias             int  not null default 45   check (fotos_dias >= 1),
  pin_intentos_max       int  not null default 5    check (pin_intentos_max between 1 and 20),
  pin_bloqueo_min        int  not null default 15   check (pin_bloqueo_min between 1 and 1440),
  updated_at             timestamptz not null default now()
);
insert into public.configuracion default values;

create trigger configuracion_updated_at before update on public.configuracion
  for each row execute function private.touch_updated_at();

-- Recargos legales con fecha de vigencia. Son solo rótulos: el sistema entrega
-- horas, no pesos. El dominical cambia de porcentaje con la fecha (Ley 2466/2025).
create table public.recargo (
  concepto   text not null check (concepto in ('nocturno', 'extra_diurna', 'extra_nocturna', 'dominical')),
  desde      date not null,
  porcentaje numeric(5, 2) not null check (porcentaje >= 0),
  primary key (concepto, desde)
);
insert into public.recargo (concepto, desde, porcentaje) values
  ('nocturno',       '2000-01-01', 35),
  ('extra_diurna',   '2000-01-01', 25),
  ('extra_nocturna', '2000-01-01', 75),
  ('dominical',      '2000-01-01', 75),
  ('dominical',      '2025-07-01', 80),
  ('dominical',      '2026-07-01', 90),
  ('dominical',      '2027-07-01', 100);

-- ── Permisos y políticas de filas ───────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.audit_log     enable row level security;
alter table public.configuracion enable row level security;
alter table public.recargo       enable row level security;

revoke all on public.profiles, public.audit_log, public.configuracion, public.recargo
  from anon, authenticated;
grant select on public.profiles, public.audit_log, public.configuracion, public.recargo
  to authenticated;
-- No hay permisos de escritura: toda escritura pasa por funciones.

create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid()) or (select private.ve_reporte())
);
create policy audit_log_select on public.audit_log for select to authenticated using (
  (select private.user_role()) = 'admin'
);
create policy configuracion_select on public.configuracion for select to authenticated using (true);
create policy recargo_select on public.recargo for select to authenticated using (true);

-- ── Ficha del empleado ──────────────────────────────────────────────────────
create or replace function public.empleado_actualizar(
  p_perfil uuid, p_nombre text, p_cargo text,
  p_role public.app_role, p_activo boolean, p_marca_turno boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_antes   public.profiles%rowtype;
  v_despues public.profiles%rowtype;
begin
  perform private.exige_admin();

  select * into v_antes from public.profiles where id = p_perfil for update;
  if not found then
    raise exception 'Esa persona no existe.' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_nombre, ''))) = 0 then
    raise exception 'El nombre es obligatorio.';
  end if;
  if p_perfil = (select auth.uid()) and (p_role <> 'admin' or not p_activo) then
    raise exception 'No puedes quitarte tu propio acceso de administrador.';
  end if;
  if p_role = 'quiosco' and p_marca_turno then
    raise exception 'La cuenta del quiosco no registra turnos: es un equipo, no una persona.';
  end if;

  update public.profiles
     set nombre = btrim(p_nombre),
         cargo = nullif(btrim(coalesce(p_cargo, '')), ''),
         role = p_role,
         activo = p_activo,
         marca_turno = p_marca_turno
   where id = p_perfil
   returning * into v_despues;

  perform private.audit(
    case when v_antes.marca_turno is distinct from v_despues.marca_turno
         then 'empleado.marca_turno' else 'empleado.actualizar' end,
    'profiles', p_perfil::text, to_jsonb(v_antes), to_jsonb(v_despues));
end; $$;

revoke all on function public.empleado_actualizar(uuid, text, text, public.app_role, boolean, boolean)
  from public, anon;
grant execute on function public.empleado_actualizar(uuid, text, text, public.app_role, boolean, boolean)
  to authenticated;
