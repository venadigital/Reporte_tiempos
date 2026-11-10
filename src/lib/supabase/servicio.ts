import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la llave de servicio: se salta las políticas de filas.
 * Solo para lo que la sesión del administrador no puede hacer (crear cuentas y
 * cambiar contraseñas). Quien lo use debe haber comprobado ANTES que quien llama
 * es el administrador principal.
 *
 * Devuelve null si la llave no está configurada.
 */
export function crearClienteServicio() {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!llave) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, llave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
