"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearCliente } from "@/lib/supabase/server";
import { obtenerPerfil } from "@/lib/auth/sesion";
import { corrige } from "@/lib/auth/permisos";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { diaISO } from "@/lib/fecha";
import { consulta, leerPeriodo } from "@/lib/periodo";
import { esUuid } from "@/lib/quiosco";
import { leerCorreccion } from "@/lib/correcciones";
import type { Resultado } from "@/components/ui";

const fallo = (mensaje: string): Resultado => ({ ok: false, mensaje });
const SIN_PERMISO = "Solo el administrador principal puede corregir turnos.";

/**
 * La lista de quién corrige está en un solo sitio (permisos.ts) y de ella beben
 * el botón y la acción. El coordinador ve todo pero no corrige; si intentara la
 * acción por fuera, la base también la rechaza.
 */
async function puedeCorregir(): Promise<boolean> {
  const perfil = await obtenerPerfil();
  return !!perfil?.activo && corrige(perfil.role);
}

function mensajeDeLaBase(error: { code?: string; message: string }): string {
  const deNegocio = error.code === "P0001" || error.code === "P0002" || error.code === "42501";
  return deNegocio ? error.message : "No se pudo guardar. Intenta de nuevo.";
}

function leerFormulario(datos: FormData) {
  const inicios = datos.getAll("pausa_inicio").map(String);
  const fines = datos.getAll("pausa_fin").map(String);
  return {
    perfil: String(datos.get("perfil") ?? ""),
    entrada: String(datos.get("entrada") ?? ""),
    salida: String(datos.get("salida") ?? ""),
    pausas: inicios.map((inicio, i) => ({ inicio, fin: fines[i] ?? "" })),
    motivo: String(datos.get("motivo") ?? ""),
    // De dónde venía, para volver al mismo periodo
    volver: consulta(
      leerPeriodo(
        { periodo: String(datos.get("periodo") ?? ""), ym: String(datos.get("ym") ?? "") },
        diaISO(new Date()),
      ),
    ),
  };
}

function refrescar(perfil: string) {
  revalidatePath("/horas");
  revalidatePath(`/horas/${perfil}`);
}

/** Cambia entrada, salida y almuerzo de un turno, en una sola operación. */
export async function corregirTurno(_previo: Resultado, datos: FormData): Promise<Resultado> {
  if (!(await puedeCorregir())) return fallo(SIN_PERMISO);

  const f = leerFormulario(datos);
  const turnoId = Number(datos.get("turno"));
  if (!esUuid(f.perfil) || !Number.isInteger(turnoId) || turnoId <= 0) return fallo("Ese turno no existe.");

  const { zona_horaria } = await obtenerConfiguracion();
  const leido = leerCorreccion(f, zona_horaria);
  if (!leido.ok) return fallo(leido.mensaje);

  const supabase = await crearCliente();
  const { error } = await supabase.rpc("turno_corregir", {
    p_turno: turnoId,
    p_inicio: leido.turno.inicio,
    p_fin: leido.turno.fin,
    p_pausas: leido.turno.pausas,
    p_motivo: f.motivo.trim(),
  });
  if (error) return fallo(mensajeDeLaBase(error));

  refrescar(f.perfil);
  redirect(`/horas/${f.perfil}?${f.volver}&hecho=corregido`);
}

/** Agrega un turno que nunca se marcó. No lleva foto y queda como "corregido a mano". */
export async function agregarTurno(_previo: Resultado, datos: FormData): Promise<Resultado> {
  if (!(await puedeCorregir())) return fallo(SIN_PERMISO);

  const f = leerFormulario(datos);
  if (!esUuid(f.perfil)) return fallo("Esa persona no existe.");

  const { zona_horaria } = await obtenerConfiguracion();
  const leido = leerCorreccion(f, zona_horaria);
  if (!leido.ok) return fallo(leido.mensaje);

  const supabase = await crearCliente();
  const { error } = await supabase.rpc("turno_crear_manual", {
    p_perfil: f.perfil,
    p_inicio: leido.turno.inicio,
    p_fin: leido.turno.fin,
    p_pausas: leido.turno.pausas,
    p_motivo: f.motivo.trim(),
  });
  if (error) return fallo(mensajeDeLaBase(error));

  refrescar(f.perfil);
  redirect(`/horas/${f.perfil}?${f.volver}&hecho=agregado`);
}

/** Borra una marcación hecha por error. Se lleva sus pausas y sus fotos. */
export async function eliminarTurno(_previo: Resultado, datos: FormData): Promise<Resultado> {
  if (!(await puedeCorregir())) return fallo(SIN_PERMISO);

  const f = leerFormulario(datos);
  const turnoId = Number(datos.get("turno"));
  if (!esUuid(f.perfil) || !Number.isInteger(turnoId) || turnoId <= 0) return fallo("Ese turno no existe.");
  if (!f.motivo.trim()) return fallo("Escribe el motivo para borrar el turno.");

  const supabase = await crearCliente();
  const { data, error } = await supabase.rpc("turno_eliminar", { p_turno: turnoId, p_motivo: f.motivo.trim() });
  if (error) return fallo(mensajeDeLaBase(error));

  // La base devuelve las rutas de las fotos del turno borrado: se limpian del almacén.
  const rutas = (data ?? []) as string[];
  if (rutas.length > 0) await supabase.storage.from("turnos").remove(rutas);

  refrescar(f.perfil);
  redirect(`/horas/${f.perfil}?${f.volver}&hecho=eliminado`);
}
