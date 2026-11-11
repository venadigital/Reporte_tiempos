"use server";

import { revalidatePath } from "next/cache";
import { crearCliente } from "@/lib/supabase/server";
import { obtenerPerfil } from "@/lib/auth/sesion";
import { administraEmpleados } from "@/lib/auth/permisos";
import { leerConfiguracion } from "@/lib/configuracion-reglas";
import type { Resultado } from "@/components/ui";

const fallo = (mensaje: string): Resultado => ({ ok: false, mensaje });

export async function guardarConfiguracion(_previo: Resultado, datos: FormData): Promise<Resultado> {
  // El guardia de la página no protege la acción; la base lo vuelve a comprobar.
  const perfil = await obtenerPerfil();
  if (!perfil?.activo || !administraEmpleados(perfil.role)) {
    return fallo("Solo el administrador principal puede cambiar la configuración.");
  }

  const texto = (clave: string) => String(datos.get(clave) ?? "");
  const leido = leerConfiguracion({
    jornada: texto("jornada"),
    cierre: texto("cierre"),
    turnoMax: texto("turno_max"),
    sinAlmuerzo: texto("sin_almuerzo"),
    fotos: texto("fotos"),
    pinIntentos: texto("pin_intentos"),
    pinBloqueo: texto("pin_bloqueo"),
  });
  if (!leido.ok) return fallo(leido.mensaje);

  const v = leido.valores;
  const supabase = await crearCliente();
  const { error } = await supabase.rpc("configuracion_actualizar", {
    p_jornada_diaria_min: v.jornada_diaria_min,
    p_hora_cierre_operacion: v.hora_cierre_operacion,
    p_turno_max_horas: v.turno_max_horas,
    p_aviso_sin_almuerzo_min: v.aviso_sin_almuerzo_min,
    p_fotos_dias: v.fotos_dias,
    p_pin_intentos_max: v.pin_intentos_max,
    p_pin_bloqueo_min: v.pin_bloqueo_min,
  });
  if (error) {
    const deNegocio = error.code === "P0001" || error.code === "42501";
    return fallo(deNegocio ? error.message : "No se pudo guardar. Intenta de nuevo.");
  }

  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Configuración guardada. Quedó en la bitácora con el antes y el después." };
}
