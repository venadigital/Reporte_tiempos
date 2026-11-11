// Borra las fotos de turnos que ya vencieron (configuracion.fotos_dias, 45 por defecto).
//
// La llama una tarea diaria de la base (pg_cron) con un secreto en la cabecera.
// La foto de una cara es un dato sensible y no se guarda para siempre; el turno
// sí: es la prueba de nómina. Se borra la foto, nunca el turno.
//
// El orden NO es intercambiable: primero se borran los archivos y después se
// limpian las rutas en la base. Al revés, si el borrado fallara, los archivos
// quedarían huérfanos para siempre. Así, si falla el último paso, la corrida del
// día siguiente lo arregla sola.

import { createClient } from "npm:@supabase/supabase-js@2";

const LOTE = 100;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Se esperaba POST" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // El secreto vive solo en el Vault de la base; aquí no hay ninguna llave propia.
  const secreto = req.headers.get("x-cron-secret") ?? "";
  const { data: valido, error: errorSecreto } = await supabase.rpc("cron_secreto_valido", { p_secreto: secreto });
  if (errorSecreto) return json({ error: "No se pudo comprobar el secreto" }, 500);
  if (valido !== true) return json({ error: "No autorizado" }, 401);

  const { data: vencidas, error: errorLista } = await supabase.rpc("turno_fotos_vencidas");
  if (errorLista) return json({ error: "No se pudo listar las fotos vencidas", detalle: errorLista.message }, 500);

  const rutas = [...new Set(((vencidas ?? []) as { ruta: string }[]).map((f) => f.ruta))];
  const borradas: string[] = [];
  let fallo: string | null = null;

  // 1. Los archivos, por lotes
  for (let i = 0; i < rutas.length; i += LOTE) {
    const lote = rutas.slice(i, i + LOTE);
    const { error } = await supabase.storage.from("turnos").remove(lote);
    if (error) {
      fallo = error.message;
      break;
    }
    borradas.push(...lote);
  }

  // 2. Solo después, las rutas de lo que sí se borró
  let olvidadas = 0;
  if (borradas.length > 0) {
    const { data, error } = await supabase.rpc("turno_fotos_olvidar", { p_rutas: borradas });
    if (error) fallo = fallo ?? error.message;
    else olvidadas = (data as number) ?? 0;
  }

  console.log("turnos-limpiar-fotos", { vencidas: rutas.length, borradas: borradas.length, olvidadas, fallo });
  return json({ vencidas: rutas.length, borradas: borradas.length, olvidadas, fallo }, fallo ? 500 : 200);
});
