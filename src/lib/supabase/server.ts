import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase con la sesión de quien hace la petición.
 * Las políticas de filas de la base deciden qué ve: aquí no hay llave de servicio.
 */
export async function crearCliente() {
  const almacen = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return almacen.getAll();
        },
        setAll(lista) {
          try {
            lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
          } catch {
            // Desde un Server Component no se pueden escribir cookies.
            // El proxy refresca la sesión en cada petición, así que es seguro ignorarlo.
          }
        },
      },
    },
  );
}
