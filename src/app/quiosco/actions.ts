"use server";

import { revalidatePath } from "next/cache";
import { crearCliente } from "@/lib/supabase/server";
import { obtenerPerfil } from "@/lib/auth/sesion";
import { usaQuiosco } from "@/lib/auth/permisos";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { esAccion, llevaFoto, FOTO_MAX_BYTES } from "@/lib/turnos";
import { esPin, esUuid, mensajeListo } from "@/lib/quiosco";

export type ResultadoQuiosco = { ok: boolean; mensaje: string };

const fallo = (mensaje: string): ResultadoQuiosco => ({ ok: false, mensaje });
const SOLO_QUIOSCO = "Esta pantalla solo funciona en el equipo compartido.";

/** El guardia de la página no protege la acción: cada una lo comprueba. La base también. */
async function esQuiosco(): Promise<boolean> {
  const perfil = await obtenerPerfil();
  return !!perfil?.activo && usaQuiosco(perfil.role);
}

/** P0001 = regla de negocio de la base; su mensaje ya está escrito para la persona. */
function mensajeDeLaBase(error: { code?: string; message: string }, generico: string): string {
  return error.code === "P0001" || error.code === "42501" ? error.message : generico;
}

/**
 * Comprueba el PIN ANTES de abrir la cámara: tomarse la foto y que después falle
 * el PIN confunde y deja un archivo subido para nada. No marca nada.
 */
export async function verificarPin(perfilId: string, pin: string): Promise<ResultadoQuiosco> {
  if (!(await esQuiosco())) return fallo(SOLO_QUIOSCO);
  if (!esUuid(perfilId) || !esPin(pin)) return fallo("El PIN debe tener 4 dígitos.");

  const supabase = await crearCliente();
  const { data, error } = await supabase.rpc("quiosco_pin_verificar", { p_perfil: perfilId, p_pin: pin });
  if (error) return fallo(mensajeDeLaBase(error, "No se pudo verificar el PIN. Intenta de nuevo."));

  const fila = (Array.isArray(data) ? data[0] : data) as { ok: boolean; mensaje: string | null } | null;
  return fila?.ok ? { ok: true, mensaje: "" } : fallo(fila?.mensaje ?? "PIN incorrecto.");
}

/**
 * Marca por otra persona desde el quiosco. La base vuelve a validar el PIN:
 * saltarse la verificación desde el navegador no sirve.
 */
export async function marcarQuiosco(datos: FormData): Promise<ResultadoQuiosco> {
  if (!(await esQuiosco())) return fallo(SOLO_QUIOSCO);

  const perfilId = datos.get("perfil");
  const pin = datos.get("pin");
  const accion = datos.get("accion");
  if (!esUuid(perfilId) || !esPin(pin) || !esAccion(accion)) return fallo("Faltan datos para marcar.");

  const supabase = await crearCliente();

  // La foto se guarda en la carpeta de la PERSONA, no en la del quiosco, para
  // que el reporte la encuentre igual que las del celular.
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
    if (subida.error) return fallo("No se pudo guardar la foto. Revisa la conexión e intenta de nuevo.");
  }

  const { data, error } = await supabase.rpc("quiosco_marcar", {
    p_perfil: perfilId,
    p_pin: pin,
    p_accion: accion,
    p_foto_path: ruta,
  });
  const fila = (Array.isArray(data) ? data[0] : data) as
    | { ok: boolean; mensaje: string | null; marcado_el: string | null }
    | null;

  if (error || !fila?.ok) {
    // Si no se marcó, la foto recién subida se borra: no quedan huérfanas.
    if (ruta) await supabase.storage.from("turnos").remove([ruta]);
    revalidatePath("/quiosco");
    return fallo(
      error ? mensajeDeLaBase(error, "No se pudo registrar. Intenta de nuevo.") : (fila?.mensaje ?? "No se pudo registrar."),
    );
  }

  const { zona_horaria } = await obtenerConfiguracion();
  revalidatePath("/quiosco");
  return { ok: true, mensaje: fila.marcado_el ? mensajeListo(accion, fila.marcado_el, zona_horaria) : "Marcación registrada" };
}
