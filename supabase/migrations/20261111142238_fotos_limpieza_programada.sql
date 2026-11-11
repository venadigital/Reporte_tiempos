-- Borrado automático de las fotos vencidas: todos los días a las 2:40 a. m. de
-- Colombia (07:40 UTC), pg_cron llama a la función de servidor turnos-limpiar-fotos.
--
-- Requiere UNA vez por proyecto, fuera de las migraciones (no es un dato del repositorio):
--   select vault.create_secret('https://<proyecto>.supabase.co', 'project_url');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Secreto compartido entre la tarea y la función de servidor. Se genera aquí, al
-- azar, y vive solo en el Vault: no está en el código ni en ninguna variable.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'turnos_cron_secreto') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'turnos_cron_secreto',
      'Autoriza a la tarea diaria a llamar la función turnos-limpiar-fotos');
  end if;
end $$;

-- La función de servidor pregunta si el secreto que recibió es el bueno.
-- Solo la llave de servicio puede preguntar.
create or replace function public.cron_secreto_valido(p_secreto text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    length(p_secreto) >= 32
    and exists (
      select 1 from vault.decrypted_secrets s
       where s.name = 'turnos_cron_secreto' and s.decrypted_secret = p_secreto),
    false);
$$;
revoke execute on function public.cron_secreto_valido(text) from public, anon, authenticated;
grant execute on function public.cron_secreto_valido(text) to service_role;

-- Lo que corre la tarea: una petición a la función de servidor, con el secreto.
create or replace function private.turnos_limpiar_fotos() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_url     text;
  v_secreto text;
begin
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'project_url';
  select s.decrypted_secret into v_secreto from vault.decrypted_secrets s where s.name = 'turnos_cron_secreto';
  if v_url is null then
    raise exception 'Falta el secreto project_url en el Vault. Ver el encabezado de esta migración.';
  end if;
  return net.http_post(
    url := v_url || '/functions/v1/turnos-limpiar-fotos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secreto),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
end; $$;
revoke execute on function private.turnos_limpiar_fotos() from public, anon, authenticated;

select cron.schedule('turnos-limpiar-fotos', '40 7 * * *', $$select private.turnos_limpiar_fotos()$$);
