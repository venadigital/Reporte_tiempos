"use server";

import { revalidatePath } from "next/cache";
import { crearCliente } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { esAccion, llevaFoto, mensajeConfirmacion, FOTO_MAX_BYTES } from "@/lib/turnos";

export type ResultadoMarcar = { ok: boolean; mensaje: string };

const fallo = (mensaje: string): ResultadoMarcar => ({ ok: false, mensaje });

/**
 * Marca entrada, almuerzo, regreso o salida de la persona de la sesión.
 *
 * No viaja ninguna hora: la pone la base de datos. Las reglas (un solo turno
 * abierto, no cerrar con el almuerzo abierto, foto obligatoria…) también las
 * hace cumplir la base; aquí solo se valida la forma y se sube la foto.
 */
export async function marcar(datos: FormData): Promise<ResultadoMarcar> {
  const accion = datos.get("accion");
  if (!esAccion(accion)) return fallo("Acción desconocida.");

  const supabase = await crearCliente();
  const { data: sesion } = await supabase.auth.getClaims();
  const perfilId = sesion?.claims?.sub;
  if (!perfilId) return fallo("Tu sesión venció. Vuelve a entrar.");

  // 1. La foto se sube primero, a la carpeta de la persona.
  let ruta: string | null = null;
  if (llevaFoto(accion)) {
    const foto = datos.get("foto");
    if (!(foto instanceof File) || foto.size === 0) {
      return fallo(accion === "entrada" ? "Falta la foto de entrada." : "Falta la foto de salida.");
    }
    if (foto.type !== "image/jpeg") return fallo("La foto debe ser una imagen JPEG.");
    if (foto.size > FOTO_MAX_BYTES) return fallo("La foto pesa demasiado. Vuelve a tomarla.");

    ruta = `${perfilId}/${Date.now()}.jpg`;
    const subida = await supabase.storage
      .from("turnos")
      .upload(ruta, foto, { contentType: "image/jpeg", upsert: false });
    if (subida.error) return fallo("No se pudo guardar la foto. Revisa tu conexión e intenta de nuevo.");
  }

  // 2. Se registra la marcación. La hora la estampa la base.
  const { data, error } = await supabase.rpc("turno_marcar", {
    p_accion: accion,
    p_foto_path: ruta,
  });

  if (error) {
    // 3. Si el registro falla, la foto recién subida se borra: no quedan huérfanas.
    if (ruta) await supabase.storage.from("turnos").remove([ruta]);
    // P0001 = regla de negocio de la base; su mensaje ya está escrito para la persona.
    return fallo(error.code === "P0001" ? error.message : "No se pudo registrar. Intenta de nuevo.");
  }

  const fila = (Array.isArray(data) ? data[0] : data) as { marcado_el: string } | null;
  const { zona_horaria } = await obtenerConfiguracion();

  revalidatePath("/turnos");
  return {
    ok: true,
    mensaje: fila?.marcado_el ? mensajeConfirmacion(accion, fila.marcado_el, zona_horaria) : "Listo.",
  };
}
