-- Fotos huérfanas: la foto se sube primero y después se registra el turno. Si el
-- registro falla (por ejemplo, ya había un turno abierto), la foto recién subida
-- se borra para no dejar archivos que nadie sabe de dónde salieron.
--
-- Quien subió la foto puede verla y borrarla SOLO mientras ningún turno la use.
-- En cuanto un turno la referencia es prueba de nómina: ya no la ve ni la borra.

create index turno_foto_inicio_idx on public.turno (foto_inicio_path) where foto_inicio_path is not null;
create index turno_foto_fin_idx    on public.turno (foto_fin_path)    where foto_fin_path is not null;

-- Definer a propósito: el empleado no puede leer sus turnos cerrados, y con una
-- consulta normal sus fotos viejas parecerían "sin usar".
create or replace function private.foto_en_uso(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.turno t
     where t.foto_inicio_path = p_ruta or t.foto_fin_path = p_ruta);
$$;
revoke execute on function private.foto_en_uso(text) from public, anon;
grant execute on function private.foto_en_uso(text) to authenticated, service_role;

create policy turnos_obj_select_huerfana on storage.objects for select to authenticated using (
  bucket_id = 'turnos'
  and not private.foto_en_uso(name)
  and ((storage.foldername(name))[1] = (select auth.uid())::text
       or coalesce((select private.user_role())::text, '') in ('quiosco', 'admin'))
);
create policy turnos_obj_delete_huerfana on storage.objects for delete to authenticated using (
  bucket_id = 'turnos'
  and not private.foto_en_uso(name)
  and ((storage.foldername(name))[1] = (select auth.uid())::text
       or coalesce((select private.user_role())::text, '') in ('quiosco', 'admin'))
);
