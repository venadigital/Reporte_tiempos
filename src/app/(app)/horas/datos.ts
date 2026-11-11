import { redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { corrige, inicioPorRol, veReporte } from "@/lib/auth/permisos";
import { crearCliente } from "@/lib/supabase/server";
import { obtenerConfiguracion, type Configuracion } from "@/lib/configuracion";
import { lunesDe, rango, sumarDias, type Periodo } from "@/lib/periodo";
import type { FilaHoras, Recargo, TurnoAbierto, TurnoListado } from "@/lib/horas";

export type Persona = { id: string; nombre: string; cargo: string | null; marca_turno: boolean; activo: boolean };

export type Reporte = {
  config: Configuracion;
  ahora: Date;
  desde: string;
  hasta: string;
  personas: Persona[];
  /** Filas de las semanas COMPLETAS que toca el periodo (para el tope semanal). */
  filasSemanas: FilaHoras[];
  /** Solo los días del periodo (lo que se paga). */
  filas: FilaHoras[];
  turnos: TurnoListado[];
  abiertos: TurnoAbierto[];
  recargos: Recargo[];
  /** La última fecha de festivo cargada; después de ella no se reconoce ninguno. */
  ultimoFestivo: string | null;
};

/** Guardia de las páginas del reporte. La base tiene el suyo (políticas de filas). */
export async function exigirReporte() {
  const perfil = await exigirPerfil();
  if (!veReporte(perfil.role)) redirect(inicioPorRol(perfil));
  return { perfil, puedeCorregir: corrige(perfil.role) };
}

/**
 * Carga todo lo que pinta el reporte. Si CUALQUIER consulta falla devuelve null:
 * nunca un reporte con ceros, que se vería igual que un periodo sin turnos y
 * alguien pagaría con él.
 */
export async function cargarReporte(periodo: Periodo, perfilId?: string): Promise<Reporte | null> {
  const { desde, hasta } = rango(periodo);
  const desdeSemanas = lunesDe(desde);
  const hastaSemanas = sumarDias(lunesDe(hasta), 6);

  const [config, supabase] = await Promise.all([obtenerConfiguracion(), crearCliente()]);

  let consultaPersonas = supabase
    .from("profiles")
    .select("id, nombre, cargo, marca_turno, activo")
    .neq("role", "quiosco")
    .order("nombre");
  let consultaAbiertos = supabase.from("turno").select("id, perfil_id, inicio_el, pendiente_revision").is("fin_el", null);
  if (perfilId) {
    consultaPersonas = consultaPersonas.eq("id", perfilId);
    consultaAbiertos = consultaAbiertos.eq("perfil_id", perfilId);
  }

  const [personas, horas, turnos, abiertos, recargos, festivo] = await Promise.all([
    consultaPersonas,
    supabase.rpc("turnos_horas", { p_desde: desdeSemanas, p_hasta: hastaSemanas, p_perfil: perfilId ?? null }),
    supabase.rpc("turnos_listar", { p_desde: desde, p_hasta: hasta, p_perfil: perfilId ?? null }),
    consultaAbiertos,
    supabase.from("recargo").select("concepto, desde, porcentaje"),
    supabase.from("festivo").select("fecha").order("fecha", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (personas.error || horas.error || turnos.error || abiertos.error || recargos.error || festivo.error) return null;

  const filasSemanas = (horas.data ?? []) as FilaHoras[];
  return {
    config,
    ahora: new Date(),
    desde,
    hasta,
    personas: (personas.data ?? []) as Persona[],
    filasSemanas,
    filas: filasSemanas.filter((f) => f.dia >= desde && f.dia <= hasta),
    turnos: (turnos.data ?? []) as TurnoListado[],
    abiertos: (abiertos.data ?? []) as TurnoAbierto[],
    recargos: (recargos.data ?? []) as Recargo[],
    ultimoFestivo: (festivo.data as { fecha: string } | null)?.fecha ?? null,
  };
}
