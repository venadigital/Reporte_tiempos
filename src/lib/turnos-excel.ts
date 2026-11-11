// El Excel del reporte de horas: lo que se usa para liquidar la nómina.
//
// Horas en DECIMALES (7,5 = 7 h 30 min), para multiplicarlas directo por el valor
// de la hora. La celda guarda el valor exacto (minutos ÷ 60) y solo se MUESTRA con
// dos decimales, para que las sumas en Excel cuadren con el reporte.

import ExcelJS from "exceljs";
import { DIAS, diaISO, horaCorta } from "@/lib/fecha";
import {
  ORIGEN, estadoTurno, hmm, quienesSalen, recargoVigente, sumar,
  type FilaHoras, type Recargo, type TurnoListado,
} from "@/lib/horas";
import { textoRango, type Periodo } from "@/lib/periodo";

export type DatosExcel = {
  periodo: Periodo;
  hasta: string;
  personas: { id: string; nombre: string; cargo: string | null; marca_turno: boolean; activo: boolean }[];
  filas: FilaHoras[]; // solo los días del periodo
  turnos: TurnoListado[];
  recargos: Recargo[];
  ahora: Date;
  zona: string;
  maxHoras: number;
  sinAlmuerzoMin: number;
};

const DECIMALES = "0.00";
const ROJO = "FFFDECEA"; // sin cerrar: no suma
const AMBAR = "FFFFF1D6"; // para revisar
const GRIS = "FFEDEDF2";

const horas = (minutos: number) => minutos / 60;
const fechaUTC = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function titular(hoja: ExcelJS.Worksheet, titulo: string, nota: string, encabezados: string[], anchos: number[]) {
  hoja.addRow([titulo]).font = { bold: true, size: 14 };
  hoja.addRow([nota]).font = { color: { argb: "FF63636B" } };
  hoja.addRow([]);
  const fila = hoja.addRow(encabezados);
  fila.font = { bold: true };
  fila.alignment = { vertical: "middle", wrapText: true };
  fila.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } };
  });
  anchos.forEach((ancho, i) => (hoja.getColumn(i + 1).width = ancho));
  hoja.views = [{ state: "frozen", xSplit: 1, ySplit: fila.number }];
  return fila.number; // la fila de encabezados
}

function pintar(fila: ExcelJS.Row, columnas: number, argb: string) {
  for (let c = 1; c <= columnas; c++) {
    fila.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  }
}

/** Lo que hay que saber de un turno antes de pagarlo. */
export function observacion(t: TurnoListado, ahora: Date, maxHoras: number, sinAlmuerzoMin: number): { texto: string; color: "rojo" | "ambar" | null } {
  const notas: string[] = [];
  let color: "rojo" | "ambar" | null = null;
  const estado = estadoTurno(t, ahora, maxHoras);

  if (estado === "sin_cerrar") {
    notas.push("Sin cerrar: no suma horas hasta que se corrija");
    color = "rojo";
  } else if (estado === "en_curso") {
    notas.push("En curso");
  } else {
    const duracionMin = (new Date(t.fin_el as string).getTime() - new Date(t.inicio_el).getTime()) / 60_000;
    if (duracionMin > maxHoras * 60) {
      notas.push(`Turno de más de ${maxHoras} horas: revisar si se le olvidó cerrar`);
      color = "ambar";
    }
    if (t.minutos_trabajados !== null && t.pausas.length === 0 && t.minutos_trabajados >= sinAlmuerzoMin) {
      notas.push(`Sin almuerzo marcado en ${hmm(t.minutos_trabajados)} seguidas`);
      color = "ambar";
    }
  }
  if (t.ajuste_motivo) notas.push(`${t.origen === "ajuste" ? "Agregado a mano" : "Corregido"}: ${t.ajuste_motivo}`);
  return { texto: notas.join(". "), color };
}

export function construirLibro(d: DatosExcel): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook();
  libro.created = d.ahora;
  const rango = textoRango(d.periodo);
  const nota = "Horas en decimales (7,50 = 7 h 30 min). El sistema entrega horas, no pesos: los porcentajes son el recargo legal de referencia.";
  const pct = (concepto: string) => {
    const valor = recargoVigente(d.recargos, concepto, d.hasta);
    return valor === null ? "" : ` (+${valor} %)`;
  };
  const personas = quienesSalen(d.personas, d.filas, d.turnos);
  const filasDe = (id: string) => d.filas.filter((f) => f.perfil_id === id);

  // ── Resumen: la misma tabla de la pantalla. Una fila por persona, sin total general.
  const resumen = libro.addWorksheet("Resumen");
  titular(
    resumen,
    `Horas del personal · ${rango}`,
    nota,
    ["Empleado", "Cargo", "Turnos", "Diurnas", `Nocturnas${pct("nocturno")}`, `Extra diurnas${pct("extra_diurna")}`,
      `Extra nocturnas${pct("extra_nocturna")}`, `Dominicales${pct("dominical")}`, "Dom. extra", "Total"],
    [28, 20, 9, 11, 13, 13, 13, 13, 11, 11],
  );
  for (const p of personas) {
    const c = sumar(filasDe(p.id));
    const fila = resumen.addRow([
      p.nombre, p.cargo ?? "", d.turnos.filter((t) => t.perfil_id === p.id).length,
      horas(c.diurnas), horas(c.nocturnas), horas(c.extraDiurnas), horas(c.extraNocturnas),
      horas(c.dominicales), horas(c.domExtra), horas(c.total),
    ]);
    for (let col = 4; col <= 10; col++) fila.getCell(col).numFmt = DECIMALES;
    fila.getCell(10).font = { bold: true };
  }

  // ── Recargos: los ocho baldes, para valorizar. El dominical y el nocturno se acumulan.
  const recargos = libro.addWorksheet("Recargos");
  titular(
    recargos,
    `Horas por recargo · ${rango}`,
    "Los ocho recargos por separado: una hora dominical nocturna lleva el recargo dominical y además el nocturno.",
    ["Empleado", "Diurnas", "Nocturnas", "Extra diurnas", "Extra nocturnas", "Dominicales diurnas",
      "Dominicales nocturnas", "Dominicales extra diurnas", "Dominicales extra nocturnas", "Total"],
    [28, 11, 11, 11, 11, 13, 13, 13, 13, 11],
  );
  const BALDES = ["diurnas", "nocturnas", "extra_diurnas", "extra_nocturnas", "dom_diurnas", "dom_nocturnas",
    "dom_extra_diurnas", "dom_extra_nocturnas", "total"] as const;
  for (const p of personas) {
    const filas = filasDe(p.id);
    const fila = recargos.addRow([p.nombre, ...BALDES.map((b) => horas(filas.reduce((suma, f) => suma + f[b], 0)))]);
    for (let col = 2; col <= 10; col++) fila.getCell(col).numFmt = DECIMALES;
    fila.getCell(10).font = { bold: true };
  }

  // ── Turnos: un renglón por turno.
  const hoja = libro.addWorksheet("Turnos");
  const COLUMNAS = 11;
  titular(
    hoja,
    `Turnos · ${rango}`,
    "En rojo: sin cerrar, no suma. En amarillo: para revisar. Una salida de otro día lleva su fecha.",
    ["Empleado", "Fecha", "Día", "Entrada", "Salida a almorzar", "Regreso", "Salida", "Almuerzo (horas)",
      "Horas trabajadas", "Cómo marcó", "Observación"],
    [28, 12, 11, 12, 16, 16, 16, 11, 11, 18, 60],
  );
  const nombres = new Map(d.personas.map((p) => [p.id, p.nombre]));
  const ordenados = [...d.turnos].sort(
    (a, b) => (nombres.get(a.perfil_id) ?? a.nombre).localeCompare(nombres.get(b.perfil_id) ?? b.nombre, "es") ||
      a.inicio_el.localeCompare(b.inicio_el),
  );
  for (const t of ordenados) {
    const fecha = fechaUTC(t.dia);
    const diaSalida = t.fin_el ? diaISO(t.fin_el, d.zona) : null;
    const cerradas = t.pausas.filter((p) => p.fin_el);
    const obs = observacion(t, d.ahora, d.maxHoras, d.sinAlmuerzoMin);
    const fila = hoja.addRow([
      nombres.get(t.perfil_id) ?? t.nombre,
      fecha,
      DIAS[fecha.getUTCDay()],
      horaCorta(t.inicio_el, d.zona),
      t.pausas.map((p) => horaCorta(p.inicio_el, d.zona)).join(" / "),
      cerradas.map((p) => horaCorta(p.fin_el as string, d.zona)).join(" / "),
      // Una salida de otro día lleva su fecha
      t.fin_el ? `${diaSalida !== t.dia ? `${ddmm(diaSalida as string)} ` : ""}${horaCorta(t.fin_el, d.zona)}` : "",
      t.minutos_pausa > 0 ? horas(t.minutos_pausa) : null,
      // Un turno sin cerrar deja la celda VACÍA, no en cero
      t.minutos_trabajados === null ? null : horas(t.minutos_trabajados),
      ORIGEN[t.origen],
      obs.texto,
    ]);
    fila.getCell(2).numFmt = "dd/mm/yyyy";
    fila.getCell(8).numFmt = DECIMALES;
    fila.getCell(9).numFmt = DECIMALES;
    fila.getCell(11).alignment = { wrapText: true, vertical: "top" };
    if (obs.color) pintar(fila, COLUMNAS, obs.color === "rojo" ? ROJO : AMBAR);
  }
  if (ordenados.length === 0) hoja.addRow(["No hay turnos en este periodo."]);

  return libro;
}

export const nombreArchivo = (p: Periodo) => `horas-${p.ym}-${p.tipo}.xlsx`;
