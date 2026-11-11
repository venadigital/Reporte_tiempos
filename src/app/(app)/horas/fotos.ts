import { crearCliente } from "@/lib/supabase/server";

/** Las fotos no tienen enlaces públicos: cada una se sirve con un enlace firmado que vence. */
const VIGENCIA_SEG = 3600;

/** Enlaces firmados por ruta. Si algo falla devuelve un mapa vacío: la tabla dice que no hay foto. */
export async function firmarFotos(rutas: (string | null)[]): Promise<Map<string, string>> {
  const limpias = [...new Set(rutas.filter((r): r is string => !!r))];
  const mapa = new Map<string, string>();
  if (limpias.length === 0) return mapa;

  const supabase = await crearCliente();
  const { data } = await supabase.storage.from("turnos").createSignedUrls(limpias, VIGENCIA_SEG);
  for (const f of data ?? []) {
    if (f.path && f.signedUrl) mapa.set(f.path, f.signedUrl);
  }
  return mapa;
}
