-- Turnos: tablas, disparadores, permisos, políticas de filas y almacén de fotos.

-- ── turno ───────────────────────────────────────────────────────────────────
create table public.turno (
  id                 bigint generated always as identity primary key,
  -- restrict: un turno es prueba de nómina y no se borra al borrar una cuenta
  perfil_id          uuid not null references public.profiles (id) on delete restrict,
  inicio_el          timestamptz not null,           -- hora del servidor, en minutos redondos
  fin_el             timestamptz,                    -- vacío = turno abierto
  foto_inicio_path   text,                           -- se vacía al vencer la foto
  foto_fin_path      text,
  origen             text not null default 'app' check (origen in ('app', 'quiosco', 'ajuste')),
  -- Turno que se quedó abierto más del máximo: ya no lo cierra la persona,
  -- lo corrige el administrador. Deja libre el cupo de "un solo turno abierto".
  pendiente_revision boolean not null default false,
  ajustado_por       uuid references public.profiles (id) on delete set null,
  ajuste_motivo      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint turno_orden check (fin_el is null or fin_el >= inicio_el),
  constraint turno_pendiente_abierto check (not pendiente_revision or fin_el is null)
);
-- Un solo turno abierto por persona
create unique index turno_abierto_uidx on public.turno (perfil_id)
  where fin_el is null and not pendiente_revision;
create index turno_perfil_inicio_idx on public.turno (perfil_id, inicio_el desc);
create index turno_inicio_idx on public.turno (inicio_el desc);
create index turno_ajustado_por_idx on public.turno (ajustado_por) where ajustado_por is not null;

-- ── turno_pausa ─────────────────────────────────────────────────────────────
create table public.turno_pausa (
  id         bigint generated always as identity primary key,
  turno_id   bigint not null references public.turno (id) on delete cascade,
  inicio_el  timestamptz not null,
  fin_el     timestamptz,                            -- vacío = almuerzo abierto
  created_at timestamptz not null default now(),
  constraint turno_pausa_orden check (fin_el is null or fin_el >= inicio_el)
);
-- Una sola pausa abierta por turno
create unique index turno_pausa_abierta_uidx on public.turno_pausa (turno_id) where fin_el is null;
create index turno_pausa_turno_idx on public.turno_pausa (turno_id, inicio_el);

-- ── turno_pin ───────────────────────────────────────────────────────────────
-- Tabla aparte y sin lectura para nadie: un PIN de 4 dígitos son 10.000
-- combinaciones y un hash filtrado se descifra en milisegundos.
create table public.turno_pin (
  perfil_id       uuid primary key references public.profiles (id) on delete cascade,
  pin_hash        text not null,
  intentos        int not null default 0,
  bloqueado_hasta timestamptz,
  updated_at      timestamptz not null default now()
);

-- ── festivo ─────────────────────────────────────────────────────────────────
create table public.festivo (
  fecha  date primary key,
  nombre text not null
);

-- ── Disparadores ────────────────────────────────────────────────────────────
-- Minutos redondos por cualquier puerta (incluido un script con permisos totales).
-- Va como disparador porque date_trunc sobre timestamptz no es inmutable y
-- Postgres no lo acepta en un CHECK.
create or replace function private.turno_minutos_redondos() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.inicio_el := date_trunc('minute', new.inicio_el);
  new.fin_el    := date_trunc('minute', new.fin_el);
  return new;
end; $$;

create trigger turno_minutos_redondos before insert or update on public.turno
  for each row execute function private.turno_minutos_redondos();
create trigger turno_pausa_minutos_redondos before insert or update on public.turno_pausa
  for each row execute function private.turno_minutos_redondos();

create trigger turno_updated_at before update on public.turno
  for each row execute function private.touch_updated_at();
create trigger turno_pin_updated_at before update on public.turno_pin
  for each row execute function private.touch_updated_at();

-- ── Permisos: cerrar de verdad y devolver solo lectura ──────────────────────
alter table public.turno       enable row level security;
alter table public.turno_pausa enable row level security;
alter table public.turno_pin   enable row level security;
alter table public.festivo     enable row level security;

revoke all on public.turno, public.turno_pausa, public.turno_pin, public.festivo
  from anon, authenticated;
grant select on public.turno, public.turno_pausa, public.festivo to authenticated;
-- turno_pin: nada, ni leer. Tampoco tiene políticas.

-- Solo lectura; no existe ninguna política de escritura.
-- El empleado ve SOLO su turno abierto (lo mínimo para saber qué botón mostrar).
-- Al cerrarlo deja de verlo: sus horas se cierran aquí, no en la pantalla.
create policy turno_select on public.turno for select to authenticated using (
  (select private.ve_reporte())
  or (perfil_id = (select auth.uid()) and fin_el is null)
);
create policy turno_pausa_select on public.turno_pausa for select to authenticated using (
  exists (
    select 1 from public.turno t
     where t.id = turno_pausa.turno_id
       and ((select private.ve_reporte())
            or (t.perfil_id = (select auth.uid()) and t.fin_el is null)))
);
create policy festivo_select on public.festivo for select to authenticated using (true);

-- ── Almacén privado de fotos ────────────────────────────────────────────────
-- Sin enlaces públicos: cada foto se sirve con un enlace firmado que vence.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('turnos', 'turnos', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

-- Subir: cada quien a su carpeta; el quiosco y el administrador suben por otros.
create policy turnos_obj_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'turnos'
  and ((storage.foldername(name))[1] = (select auth.uid())::text
       or coalesce((select private.user_role())::text, '') in ('quiosco', 'admin'))
);
-- Ver: solo quienes ven el reporte. El empleado no ve ni sus propias fotos.
create policy turnos_obj_select on storage.objects for select to authenticated using (
  bucket_id = 'turnos' and (select private.ve_reporte())
);
-- Borrar a mano: solo el administrador principal.
create policy turnos_obj_delete on storage.objects for delete to authenticated using (
  bucket_id = 'turnos' and coalesce((select private.user_role())::text, '') = 'admin'
);
