// Reglas de pantalla del reporte de horas. El cálculo lo hace la base
// (public.turnos_horas); aquí solo se suma, se da formato y se arman los avisos.
// La base devuelve HECHOS, no juicios: cambiar un umbral no obliga a tocarla.

import { diaISO } from "@/lib/fecha";
import { diaLargo, periodoDe, type Periodo } from "@/lib/periodo";

/** Una fila de public.turnos_horas(): una persona, un día, ocho baldes en minutos. */
export type FilaHoras = {
  perfil_id: string;
  dia: string;
  semana: string; // el lunes de su semana
  diurnas: number;
  nocturnas: number;
  extra_diurnas: number;
  extra_nocturnas: number;
  dom_diurnas: number;
  dom_nocturnas: number;
  dom_extra_diurnas: number;
  dom_extra_nocturnas: number;
  total: number;
};

export type Pausa = { id: number; inicio_el: string; fin_el: string | null };

/** Una fila de public.turnos_listar(): un turno. */
export type TurnoListado = {
  turno_id: number;
  perfil_id: string;
  nombre: string;
  dia: string;
  inicio_el: string;
  fin_el: string | null;
  minutos_trabajados: number | null; // vacío si está abierto: nunca cero
  minutos_pausa: number;
  pausas: Pausa[];
  pausa_abierta: boolean;
  foto_inicio_path: string | null;
  foto_fin_path: string | null;
  origen: "app" | "quiosco" | "ajuste";
  pendiente_revision: boolean;
  ajustado_por: string | null;
  ajustado_por_nombre: string | null;
  ajuste_motivo: string | null;
};

/** Las seis columnas de pantalla. Los ocho baldes se conservan en los datos. */
export type Columnas = {
  diurnas: number;
  nocturnas: number;
  extraDiurnas: number;
  extraNocturnas: number;
  dominicales: number; // las dos dominicales ordinarias
  domExtra: number; // las dos dominicales extra
  total: number;
};

export const COLUMNAS_VACIAS: Columnas = {
  diurnas: 0, nocturnas: 0, extraDiurnas: 0, extraNocturnas: 0, dominicales: 0, domExtra: 0, total: 0,
};

/** Minutos a "h:mm": 5190 → "86:30". */
export function hmm(minutos: number): string {
  return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, "0")}`;
}

export const extrasDe = (f: FilaHoras) =>
  f.extra_diurnas + f.extra_nocturnas + f.dom_extra_diurnas + f.dom_extra_nocturnas;

export function sumar(filas: FilaHoras[]): Columnas {
  const c = { ...COLUMNAS_VACIAS };
  for (const f of filas) {
    c.diurnas += f.diurnas;
    c.nocturnas += f.nocturnas;
    c.extraDiurnas += f.extra_diurnas;
    c.extraNocturnas += f.extra_nocturnas;
    c.dominicales += f.dom_diurnas + f.dom_nocturnas;
    c.domExtra += f.dom_extra_diurnas + f.dom_extra_nocturnas;
    c.total += f.total;
  }
  return c;
}

export const tieneExtras = (c: Columnas) => c.extraDiurnas + c.extraNocturnas + c.domExtra > 0;

export type Semana = { semana: string; ordinarias: number; extra: number; total: number };

/** Totales por semana (lunes a domingo): el tope de extras es semanal y la nómina no. */
export function porSemana(filas: FilaHoras[]): Semana[] {
  const mapa = new Map<string, Semana>();
  for (const f of filas) {
    const s = mapa.get(f.semana) ?? { semana: f.semana, ordinarias: 0, extra: 0, total: 0 };
    const extra = extrasDe(f);
    s.extra += extra;
    s.ordinarias += f.total - extra;
    s.total += f.total;
    mapa.set(f.semana, s);
  }
  return [...mapa.values()].sort((a, b) => a.semana.localeCompare(b.semana));
}

export type EstadoTurno = "cerrado" | "en_curso" | "sin_cerrar";

/**
 * Un turno sin salida significa dos cosas distintas que se arreglan distinto:
 * "en curso" (la persona sigue trabajando) o "sin cerrar" (un olvido: lo corrige
 * el administrador). Con turnos de noche no se decide por el día sino por las
 * horas que lleva abierto.
 */
export function estadoTurno(
  t: Pick<TurnoListado, "inicio_el" | "fin_el" | "pendiente_revision">,
  ahora: Date | number,
  maxHoras: number,
): EstadoTurno {
  if (t.fin_el) return "cerrado";
  const abiertoHace = new Date(ahora).getTime() - new Date(t.inicio_el).getTime();
  return t.pendiente_revision || abiertoHace > maxHoras * 3_600_000 ? "sin_cerrar" : "en_curso";
}

export const ORIGEN: Record<TurnoListado["origen"], string> = {
  app: "Con su usuario",
  quiosco: "Quiosco",
  ajuste: "Corregido a mano",
};

export type Aviso = {
  clave: string;
  nivel: "rojo" | "ambar";
  perfilId: string;
  nombre: string;
  texto: string; // lo que sigue al nombre
  periodo: Periodo; // dónde verlo
};

export type TurnoAbierto = { id: number; perfil_id: string; inicio_el: string; pendiente_revision: boolean };

/**
 * Lo que hay que revisar, con nombre y día.
 *  - filasSemanas: las filas de las semanas COMPLETAS que toca el periodo.
 *  - abiertos: todos los turnos sin salida, sean o no del periodo (un olvido no
 *    deja de serlo por cambiar de quincena).
 */
export function armarAvisos(d: {
  nombres: Map<string, string>;
  periodo: Periodo;
  desde: string;
  hasta: string;
  filasSemanas: FilaHoras[];
  turnos: TurnoListado[];
  abiertos: TurnoAbierto[];
  ahora: Date | number;
  zona: string;
  maxHoras: number;
  topeSemanaMin: number;
  topeDiaMin: number;
  sinAlmuerzoMin: number;
}): Aviso[] {
  const avisos: Aviso[] = [];
  const nombre = (id: string) => d.nombres.get(id) ?? "Alguien";

  for (const t of d.abiertos) {
    if (estadoTurno({ ...t, fin_el: null }, d.ahora, d.maxHoras) !== "sin_cerrar") continue;
    const dia = diaISO(t.inicio_el, d.zona);
    avisos.push({
      clave: `abierto-${t.id}`,
      nivel: "rojo",
      perfilId: t.perfil_id,
      nombre: nombre(t.perfil_id),
      texto: `no cerró el turno del ${diaLargo(dia)}. No suma horas hasta que se corrija.`,
      periodo: periodoDe(dia),
    });
  }

  // Tope semanal de extras: se mira la semana completa aunque el periodo la corte.
  const porPersona = new Map<string, FilaHoras[]>();
  for (const f of d.filasSemanas) porPersona.set(f.perfil_id, [...(porPersona.get(f.perfil_id) ?? []), f]);
  for (const [perfilId, filas] of porPersona) {
    for (const s of porSemana(filas)) {
      if (s.extra <= d.topeSemanaMin) continue;
      avisos.push({
        clave: `semana-${perfilId}-${s.semana}`,
        nivel: "ambar",
        perfilId,
        nombre: nombre(perfilId),
        texto: `pasó el tope legal de extras en la semana del ${diaLargo(s.semana).replace(/^\S+ /, "")}: hizo ${hmm(s.extra)} y el tope legal es ${hmm(d.topeSemanaMin)}.`,
        periodo: d.periodo,
      });
    }
    for (const f of filas) {
      const extra = extrasDe(f);
      if (extra <= d.topeDiaMin || f.dia < d.desde || f.dia > d.hasta) continue;
      avisos.push({
        clave: `dia-${perfilId}-${f.dia}`,
        nivel: "ambar",
        perfilId,
        nombre: nombre(perfilId),
        texto: `hizo ${hmm(extra)} extra el ${diaLargo(f.dia)}. El tope legal diario es ${hmm(d.topeDiaMin)}.`,
        periodo: d.periodo,
      });
    }
  }

  for (const t of d.turnos) {
    if (t.minutos_trabajados === null || t.pausas.length > 0 || t.minutos_trabajados < d.sinAlmuerzoMin) continue;
    avisos.push({
      clave: `almuerzo-${t.turno_id}`,
      nivel: "ambar",
      perfilId: t.perfil_id,
      nombre: nombre(t.perfil_id),
      texto: `trabajó ${hmm(t.minutos_trabajados)} seguidas el ${diaLargo(t.dia)} sin marcar almuerzo. Se le está pagando la hora de comida.`,
      periodo: d.periodo,
    });
  }

  // Primero lo que impide pagar bien (rojo), después lo demás
  return avisos.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "rojo" ? -1 : 1));
}

export type Recargo = { concepto: string; desde: string; porcentaje: number };

/** El recargo legal vigente en una fecha. Es solo un rótulo: el sistema entrega horas, no pesos. */
export function recargoVigente(recargos: Recargo[], concepto: string, fecha: string): number | null {
  const vigentes = recargos
    .filter((r) => r.concepto === concepto && r.desde <= fecha)
    .sort((a, b) => b.desde.localeCompare(a.desde));
  return vigentes.length ? Number(vigentes[0].porcentaje) : null;
}

/**
 * Quién sale en el reporte: una fila por persona que marca (aunque esté en cero:
 * que alguien aparezca sin horas es información), más quien tenga turnos en el
 * periodo aunque ya no marque. La pantalla y el Excel usan esta misma lista.
 */
export function quienesSalen<P extends { id: string; marca_turno: boolean; activo: boolean }>(
  personas: P[],
  filas: FilaHoras[],
  turnos: TurnoListado[],
): P[] {
  const conTurnos = new Set([...filas.map((f) => f.perfil_id), ...turnos.map((t) => t.perfil_id)]);
  return personas.filter((p) => (p.marca_turno && p.activo) || conTurnos.has(p.id));
}
