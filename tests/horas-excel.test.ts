// @vitest-environment node
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { construirLibro, nombreArchivo, observacion, type DatosExcel } from "@/lib/turnos-excel";
import type { FilaHoras, TurnoListado } from "@/lib/horas";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";

const fila = (perfil_id: string, dia: string, extra: Partial<FilaHoras>): FilaHoras => {
  const base = {
    perfil_id, dia, semana: "2026-11-02",
    diurnas: 0, nocturnas: 0, extra_diurnas: 0, extra_nocturnas: 0,
    dom_diurnas: 0, dom_nocturnas: 0, dom_extra_diurnas: 0, dom_extra_nocturnas: 0, ...extra,
  };
  return { ...base, total: Object.entries(base).reduce((s, [k, v]) => (typeof v === "number" && k !== "total" ? s + v : s), 0) };
};
const turno = (extra: Partial<TurnoListado>): TurnoListado => ({
  turno_id: 1, perfil_id: A, nombre: "Camila Rojas", dia: "2026-11-02",
  inicio_el: "2026-11-02T12:00:00Z", fin_el: "2026-11-02T20:00:00Z",
  minutos_trabajados: 420, minutos_pausa: 60,
  pausas: [{ id: 1, inicio_el: "2026-11-02T17:00:00Z", fin_el: "2026-11-02T18:00:00Z" }],
  pausa_abierta: false, foto_inicio_path: null, foto_fin_path: null, origen: "app",
  pendiente_revision: false, ajustado_por: null, ajustado_por_nombre: null, ajuste_motivo: null, ...extra,
});

const datos = (extra: Partial<DatosExcel> = {}): DatosExcel => ({
  periodo: { tipo: "q1", ym: "2026-11" },
  hasta: "2026-11-15",
  personas: [
    { id: A, nombre: "Camila Rojas", cargo: "Recepción", marca_turno: true, activo: true },
    { id: B, nombre: "Jorge Niño", cargo: "Vigilancia", marca_turno: true, activo: true },
    { id: C, nombre: "Iván Soto", cargo: null, marca_turno: true, activo: true },
  ],
  filas: [
    fila(A, "2026-11-02", { diurnas: 4620, extra_diurnas: 150 }),
    fila(A, "2026-11-08", { dom_diurnas: 420 }),
    fila(B, "2026-11-03", { nocturnas: 100, dom_nocturnas: 60, dom_extra_nocturnas: 30 }),
  ],
  turnos: [],
  recargos: [
    { concepto: "nocturno", desde: "2000-01-01", porcentaje: 35 },
    { concepto: "dominical", desde: "2026-07-01", porcentaje: 90 },
  ],
  ahora: new Date("2026-11-11T15:00:00Z"),
  zona: "America/Bogota",
  maxHoras: 14,
  sinAlmuerzoMin: 360,
  ...extra,
});

/** Escribe el libro y lo vuelve a leer: prueba que el archivo que se descarga es válido. */
async function idaYVuelta(d: DatosExcel) {
  const buffer = await construirLibro(d).xlsx.writeBuffer();
  const leido = new ExcelJS.Workbook();
  await leido.xlsx.load(buffer as ArrayBuffer);
  return leido;
}
const ENCABEZADO = 4; // título, nota, renglón vacío, encabezados
const valores = (hoja: ExcelJS.Worksheet, n: number) => (hoja.getRow(n).values as unknown[]).slice(1);

describe("Excel del reporte de horas", () => {
  it("trae las tres hojas con el periodo en el título", async () => {
    const libro = await idaYVuelta(datos());
    expect(libro.worksheets.map((h) => h.name)).toEqual(["Resumen", "Recargos", "Turnos"]);
    expect(libro.getWorksheet("Resumen")!.getCell("A1").value).toBe("Horas del personal · Del 1 al 15 de noviembre de 2026");
    expect(nombreArchivo({ tipo: "q1", ym: "2026-11" })).toBe("horas-2026-11-q1.xlsx");
  });

  it("el resumen trae las mismas cifras que la pantalla, en decimales exactos", async () => {
    const hoja = (await idaYVuelta(datos())).getWorksheet("Resumen")!;
    expect(valores(hoja, ENCABEZADO)).toEqual([
      "Empleado", "Cargo", "Turnos", "Diurnas", "Nocturnas (+35 %)", "Extra diurnas", "Extra nocturnas",
      "Dominicales (+90 %)", "Dom. extra", "Total",
    ]);
    // 77:00, 2:30 y 7:00 → 77, 2,5 y 7; total 86:30 → 86,5
    expect(valores(hoja, ENCABEZADO + 1)).toEqual(["Camila Rojas", "Recepción", 0, 77, 0, 2.5, 0, 7, 0, 86.5]);
    // 1:40 se guarda exacto (1,666…) y solo se MUESTRA con dos decimales
    const jorge = hoja.getRow(ENCABEZADO + 2);
    expect(jorge.getCell(5).value).toBe(100 / 60);
    expect(jorge.getCell(5).numFmt).toBe("0.00");
    expect(jorge.getCell(8).value).toBe(1); // dominicales: las dos ordinarias juntas
    expect(jorge.getCell(9).value).toBe(0.5);
  });

  it("una fila por persona aunque esté en cero, y sin total general", async () => {
    const hoja = (await idaYVuelta(datos())).getWorksheet("Resumen")!;
    expect(valores(hoja, ENCABEZADO + 3)).toEqual(["Iván Soto", "", 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(hoja.rowCount).toBe(ENCABEZADO + 3);
  });

  it("la hoja de recargos conserva los ocho por separado", async () => {
    const hoja = (await idaYVuelta(datos())).getWorksheet("Recargos")!;
    expect(valores(hoja, ENCABEZADO + 2)).toEqual(["Jorge Niño", 0, 100 / 60, 0, 0, 0, 1, 0, 0.5, 190 / 60]);
  });

  it("un renglón por turno, con almuerzo y horas", async () => {
    const hoja = (await idaYVuelta(datos({ turnos: [turno({})] }))).getWorksheet("Turnos")!;
    const v = valores(hoja, ENCABEZADO + 1);
    expect(v[0]).toBe("Camila Rojas");
    expect((v[1] as Date).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(v.slice(2)).toEqual(["lunes", "7:00 a. m.", "12:00 p. m.", "1:00 p. m.", "3:00 p. m.", 1, 7, "Con su usuario", ""]);
  });

  it("un turno sin cerrar deja la celda de horas vacía, no en cero, y va en rojo", async () => {
    const abierto = turno({ fin_el: null, minutos_trabajados: null, minutos_pausa: 0, pausas: [], inicio_el: "2026-11-09T03:00:00Z", dia: "2026-11-08" });
    const hoja = (await idaYVuelta(datos({ turnos: [abierto] }))).getWorksheet("Turnos")!;
    const fila = hoja.getRow(ENCABEZADO + 1);
    expect(fila.getCell(9).value).toBeNull();
    expect(fila.getCell(7).value).toBe("");
    expect(fila.getCell(11).value).toBe("Sin cerrar: no suma horas hasta que se corrija");
    expect((fila.getCell(1).fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFFDECEA");
  });

  it("un turno de noche: la salida de otro día lleva su fecha y no se marca por eso", async () => {
    const noche = turno({ inicio_el: "2026-11-03T03:00:00Z", fin_el: "2026-11-03T11:00:00Z", minutos_trabajados: 450, minutos_pausa: 30,
      pausas: [{ id: 1, inicio_el: "2026-11-03T07:00:00Z", fin_el: "2026-11-03T07:30:00Z" }] });
    const hoja = (await idaYVuelta(datos({ turnos: [noche] }))).getWorksheet("Turnos")!;
    const fila = hoja.getRow(ENCABEZADO + 1);
    expect(fila.getCell(4).value).toBe("10:00 p. m.");
    expect(fila.getCell(7).value).toBe("03/11 6:00 a. m.");
    expect(fila.getCell(11).value).toBe("");
    expect(fila.getCell(1).fill?.type).not.toBe("pattern");
  });

  it("se marca para revisar el turno larguísimo y el que no tuvo almuerzo", () => {
    const ahora = new Date("2026-11-11T15:00:00Z");
    const largo = turno({ fin_el: "2026-11-03T12:00:00Z", minutos_trabajados: 1380, pausas: [{ id: 1, inicio_el: "x", fin_el: "y" }] });
    expect(observacion(largo, ahora, 14, 360)).toEqual({ texto: "Turno de más de 14 horas: revisar si se le olvidó cerrar", color: "ambar" });
    const sinAlmuerzo = turno({ minutos_trabajados: 490, minutos_pausa: 0, pausas: [] });
    expect(observacion(sinAlmuerzo, ahora, 14, 360)).toEqual({ texto: "Sin almuerzo marcado en 8:10 seguidas", color: "ambar" });
    expect(observacion(turno({}), ahora, 14, 360)).toEqual({ texto: "", color: null });
  });

  it("un turno corregido trae el motivo; uno agregado a mano lo dice", () => {
    const ahora = new Date("2026-11-11T15:00:00Z");
    expect(observacion(turno({ ajuste_motivo: "Marcó tarde" }), ahora, 14, 360).texto).toBe("Corregido: Marcó tarde");
    expect(observacion(turno({ origen: "ajuste", ajuste_motivo: "Se fue la luz" }), ahora, 14, 360).texto).toBe("Agregado a mano: Se fue la luz");
  });

  it("un periodo sin turnos no falla y lo dice", async () => {
    const hoja = (await idaYVuelta(datos({ filas: [], turnos: [] }))).getWorksheet("Turnos")!;
    expect(hoja.getRow(ENCABEZADO + 1).getCell(1).value).toBe("No hay turnos en este periodo.");
  });
});
