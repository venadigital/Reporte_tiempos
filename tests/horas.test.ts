import { describe, expect, it } from "vitest";
import { instanteEnZona, paraCampo } from "@/lib/fecha";
import {
  consulta, diaCorto, diaLargo, leerPeriodo, lunesDe, moverMes, periodoDe, rango, sumarDias, textoRango, textoSemana, tituloMes,
} from "@/lib/periodo";
import {
  armarAvisos, estadoTurno, hmm, porSemana, recargoVigente, sumar, tieneExtras, type FilaHoras, type TurnoListado,
} from "@/lib/horas";
import { leerCorreccion } from "@/lib/correcciones";

const P = "11111111-1111-1111-1111-111111111111";
const fila = (dia: string, extra: Partial<FilaHoras> = {}): FilaHoras => {
  const base = {
    perfil_id: P, dia, semana: lunesDe(dia),
    diurnas: 0, nocturnas: 0, extra_diurnas: 0, extra_nocturnas: 0,
    dom_diurnas: 0, dom_nocturnas: 0, dom_extra_diurnas: 0, dom_extra_nocturnas: 0,
    ...extra,
  };
  const total = base.diurnas + base.nocturnas + base.extra_diurnas + base.extra_nocturnas +
    base.dom_diurnas + base.dom_nocturnas + base.dom_extra_diurnas + base.dom_extra_nocturnas;
  return { ...base, total };
};
const turno = (extra: Partial<TurnoListado>): TurnoListado => ({
  turno_id: 1, perfil_id: P, nombre: "Camila Rojas", dia: "2026-11-05",
  inicio_el: "2026-11-05T12:00:00Z", fin_el: "2026-11-05T20:00:00Z",
  minutos_trabajados: 480, minutos_pausa: 0, pausas: [], pausa_abierta: false,
  foto_inicio_path: null, foto_fin_path: null, origen: "app", pendiente_revision: false,
  ajustado_por: null, ajustado_por_nombre: null, ajuste_motivo: null, ...extra,
});

describe("periodos de nómina", () => {
  it("quincena 1, quincena 2 y mes completo", () => {
    expect(rango({ tipo: "q1", ym: "2026-11" })).toEqual({ desde: "2026-11-01", hasta: "2026-11-15" });
    expect(rango({ tipo: "q2", ym: "2026-11" })).toEqual({ desde: "2026-11-16", hasta: "2026-11-30" });
    expect(rango({ tipo: "mes", ym: "2026-02" })).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(rango({ tipo: "q2", ym: "2028-02" }).hasta).toBe("2028-02-29"); // bisiesto
  });

  it("la quincena en curso sale del día de hoy", () => {
    expect(periodoDe("2026-11-15")).toEqual({ tipo: "q1", ym: "2026-11" });
    expect(periodoDe("2026-11-16")).toEqual({ tipo: "q2", ym: "2026-11" });
  });

  it("con valores raros en la dirección cae en la quincena en curso", () => {
    expect(leerPeriodo({ periodo: "mes", ym: "2026-10" }, "2026-11-11")).toEqual({ tipo: "mes", ym: "2026-10" });
    expect(leerPeriodo({ periodo: "anual", ym: "2026-13" }, "2026-11-11")).toEqual({ tipo: "q1", ym: "2026-11" });
    expect(leerPeriodo({}, "2026-11-20")).toEqual({ tipo: "q2", ym: "2026-11" });
    expect(consulta({ tipo: "q2", ym: "2026-11" })).toBe("periodo=q2&ym=2026-11");
  });

  it("se mueve de mes cruzando el año", () => {
    expect(moverMes("2026-12", 1)).toBe("2027-01");
    expect(moverMes("2026-01", -1)).toBe("2025-12");
  });

  it("los textos se escriben a mano, en español", () => {
    expect(tituloMes("2026-11")).toBe("Noviembre 2026");
    expect(textoRango({ tipo: "q2", ym: "2026-11" })).toBe("Del 16 al 30 de noviembre de 2026");
    expect(diaLargo("2026-11-09")).toBe("lunes 9 de noviembre");
    expect(diaCorto("2026-11-01")).toBe("Dom 1 nov");
    expect(textoSemana("2026-10-26")).toBe("26 oct – 1 nov");
    expect(textoSemana("2026-11-02")).toBe("2 – 8 nov");
  });

  it("la semana va de lunes a domingo", () => {
    expect(lunesDe("2026-11-01")).toBe("2026-10-26"); // domingo → el lunes anterior
    expect(lunesDe("2026-11-02")).toBe("2026-11-02");
    expect(lunesDe("2026-11-08")).toBe("2026-11-02");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("fecha y hora escritas a mano", () => {
  it("lleva la zona explícita: las 7 a. m. de Colombia no se guardan como las 2 a. m.", () => {
    expect(instanteEnZona("2026-11-02T07:00")).toBe("2026-11-02T12:00:00.000Z");
    expect(instanteEnZona("2026-11-02T22:30")).toBe("2026-11-03T03:30:00.000Z");
    expect(instanteEnZona("2026-07-01T07:00", "America/New_York")).toBe("2026-07-01T11:00:00.000Z"); // horario de verano
  });
  it("va y vuelve sin cambiar", () => {
    expect(paraCampo("2026-11-03T03:30:00Z")).toBe("2026-11-02T22:30");
    expect(paraCampo(instanteEnZona("2026-11-02T06:05")!)).toBe("2026-11-02T06:05");
  });
  it("lo que no es una fecha y hora devuelve nulo", () => {
    for (const malo of ["", "ayer", "2026-11-02", "2026-13-02T07:00", "2026-11-02T25:00"]) {
      expect(instanteEnZona(malo)).toBeNull();
    }
  });
});

describe("sumas del reporte", () => {
  it("las horas van en h:mm", () => {
    expect(hmm(0)).toBe("0:00");
    expect(hmm(65)).toBe("1:05");
    expect(hmm(5190)).toBe("86:30");
  });

  it("los ocho baldes se juntan en las seis columnas de pantalla", () => {
    const c = sumar([
      fila("2026-11-02", { diurnas: 300, nocturnas: 120, extra_nocturnas: 60 }),
      fila("2026-11-08", { dom_diurnas: 240, dom_nocturnas: 60, dom_extra_diurnas: 30, dom_extra_nocturnas: 15 }),
    ]);
    expect(c).toEqual({ diurnas: 300, nocturnas: 120, extraDiurnas: 0, extraNocturnas: 60, dominicales: 300, domExtra: 45, total: 825 });
    expect(tieneExtras(c)).toBe(true);
    expect(tieneExtras(sumar([fila("2026-11-02", { diurnas: 420 })]))).toBe(false);
  });

  it("parte el periodo en semanas con ordinarias y extra", () => {
    const semanas = porSemana([
      fila("2026-11-01", { dom_diurnas: 480 }),
      fila("2026-11-02", { diurnas: 480, extra_diurnas: 120 }),
      fila("2026-11-03", { nocturnas: 480, extra_nocturnas: 60 }),
    ]);
    expect(semanas).toEqual([
      { semana: "2026-10-26", ordinarias: 480, extra: 0, total: 480 },
      { semana: "2026-11-02", ordinarias: 960, extra: 180, total: 1140 },
    ]);
  });

  it("el recargo dominical cambia con la fecha", () => {
    const recargos = [
      { concepto: "dominical", desde: "2026-07-01", porcentaje: 90 },
      { concepto: "dominical", desde: "2027-07-01", porcentaje: 100 },
      { concepto: "nocturno", desde: "2000-01-01", porcentaje: 35 },
    ];
    expect(recargoVigente(recargos, "dominical", "2026-11-15")).toBe(90);
    expect(recargoVigente(recargos, "dominical", "2027-07-01")).toBe(100);
    expect(recargoVigente(recargos, "nocturno", "2026-11-15")).toBe(35);
    expect(recargoVigente(recargos, "dominical", "2025-01-01")).toBeNull();
  });
});

describe("en curso no es sin cerrar", () => {
  const ahora = new Date("2026-11-11T15:00:00Z");
  const abierto = (horas: number, pendiente = false) => ({
    inicio_el: new Date(ahora.getTime() - horas * 3_600_000).toISOString(), fin_el: null, pendiente_revision: pendiente,
  });

  it("un turno de noche de 10 horas sigue en curso aunque haya cambiado el día", () => {
    expect(estadoTurno(abierto(10), ahora, 14)).toBe("en_curso");
  });
  it("pasado el máximo es un olvido: sin cerrar", () => {
    expect(estadoTurno(abierto(15), ahora, 14)).toBe("sin_cerrar");
    expect(estadoTurno(abierto(2, true), ahora, 14)).toBe("sin_cerrar");
  });
  it("con salida está cerrado", () => {
    expect(estadoTurno({ inicio_el: "2026-11-10T12:00:00Z", fin_el: "2026-11-10T20:00:00Z", pendiente_revision: false }, ahora, 14)).toBe("cerrado");
  });
});

describe("por revisar", () => {
  const ahora = new Date("2026-11-11T15:00:00Z");
  const base = {
    nombres: new Map([[P, "Camila Rojas"]]),
    periodo: { tipo: "q1" as const, ym: "2026-11" },
    desde: "2026-11-01", hasta: "2026-11-15",
    filasSemanas: [], turnos: [], abiertos: [],
    ahora, zona: "America/Bogota", maxHoras: 14, topeSemanaMin: 720, topeDiaMin: 120, sinAlmuerzoMin: 360,
  };

  it("un periodo sin novedades no avisa nada", () => {
    expect(armarAvisos(base)).toEqual([]);
  });

  it("avisa con nombre y día del turno que no se cerró, y manda a su periodo", () => {
    const avisos = armarAvisos({
      ...base,
      abiertos: [{ id: 7, perfil_id: P, inicio_el: "2026-10-30T03:00:00Z", pendiente_revision: false }],
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({
      nivel: "rojo", nombre: "Camila Rojas",
      texto: "no cerró el turno del jueves 29 de octubre. No suma horas hasta que se corrija.",
      periodo: { tipo: "q2", ym: "2026-10" }, // el día en Colombia fue el 29, no el 30
    });
  });

  it("un turno abierto hoy está en curso: no genera aviso", () => {
    expect(armarAvisos({ ...base, abiertos: [{ id: 8, perfil_id: P, inicio_el: "2026-11-11T12:00:00Z", pendiente_revision: false }] })).toEqual([]);
  });

  it("el tope semanal de extras se mira en la semana completa, aunque el periodo la corte", () => {
    // Semana del 26 oct al 1 nov: las extras cayeron en octubre, fuera de la quincena
    const avisos = armarAvisos({
      ...base,
      filasSemanas: [fila("2026-10-28", { diurnas: 480, extra_diurnas: 400 }), fila("2026-10-29", { diurnas: 480, extra_diurnas: 400 })],
    });
    expect(avisos.map((a) => a.texto)).toEqual([
      "pasó el tope legal de extras en la semana del 26 de octubre: hizo 13:20 y el tope legal es 12:00.",
    ]);
  });

  it("avisa del tope diario de extras solo en los días del periodo", () => {
    const avisos = armarAvisos({ ...base, filasSemanas: [fila("2026-11-03", { diurnas: 480, extra_diurnas: 190 })] });
    expect(avisos.map((a) => a.texto)).toEqual(["hizo 3:10 extra el martes 3 de noviembre. El tope legal diario es 2:00."]);
  });

  it("un turno largo sin pausa es 'sin almuerzo'; uno corto o con pausa, no", () => {
    const avisos = armarAvisos({
      ...base,
      turnos: [
        turno({ turno_id: 1, minutos_trabajados: 490 }),
        turno({ turno_id: 2, minutos_trabajados: 300 }),
        turno({ turno_id: 3, minutos_trabajados: 480, pausas: [{ id: 1, inicio_el: "x", fin_el: "y" }] }),
        turno({ turno_id: 4, minutos_trabajados: null, fin_el: null }),
      ],
    });
    expect(avisos.map((a) => a.clave)).toEqual(["almuerzo-1"]);
    expect(avisos[0].texto).toBe("trabajó 8:10 seguidas el jueves 5 de noviembre sin marcar almuerzo. Se le está pagando la hora de comida.");
  });

  it("lo que impide pagar bien va primero", () => {
    const avisos = armarAvisos({
      ...base,
      turnos: [turno({ minutos_trabajados: 490 })],
      abiertos: [{ id: 7, perfil_id: P, inicio_el: "2026-11-09T03:00:00Z", pendiente_revision: true }],
    });
    expect(avisos.map((a) => a.nivel)).toEqual(["rojo", "ambar"]);
  });
});

describe("forma de una corrección", () => {
  const zona = "America/Bogota";
  const base = { entrada: "2026-11-02T22:00", salida: "2026-11-03T06:00", pausas: [], motivo: "Olvidó cerrar" };

  it("un turno de noche con salida al día siguiente es válido", () => {
    expect(leerCorreccion(base, zona)).toEqual({
      ok: true, turno: { inicio: "2026-11-03T03:00:00.000Z", fin: "2026-11-03T11:00:00.000Z", pausas: [] },
    });
  });
  it("exige motivo, entrada y salida", () => {
    expect(leerCorreccion({ ...base, motivo: "  " }, zona)).toMatchObject({ ok: false, mensaje: expect.stringMatching(/motivo/) });
    expect(leerCorreccion({ ...base, salida: "" }, zona)).toMatchObject({ ok: false, mensaje: expect.stringMatching(/entrada y la de salida/) });
  });
  it("la salida no puede ser anterior a la entrada", () => {
    expect(leerCorreccion({ ...base, salida: "2026-11-02T21:00" }, zona)).toMatchObject({ ok: false, mensaje: expect.stringMatching(/posterior a la entrada/) });
  });
  it("el almuerzo va completo y dentro del turno; los renglones vacíos se ignoran", () => {
    const con = (pausas: { inicio: string; fin: string }[]) => leerCorreccion({ ...base, pausas }, zona);
    expect(con([{ inicio: "", fin: "" }])).toMatchObject({ ok: true });
    expect(con([{ inicio: "2026-11-03T01:00", fin: "2026-11-03T01:30" }, { inicio: "", fin: "" }])).toMatchObject({
      ok: true, turno: { pausas: [{ inicio: "2026-11-03T06:00:00.000Z", fin: "2026-11-03T06:30:00.000Z" }] },
    });
    expect(con([{ inicio: "2026-11-03T01:00", fin: "" }])).toMatchObject({ ok: false, mensaje: expect.stringMatching(/salida y la de regreso/) });
    expect(con([{ inicio: "2026-11-03T05:30", fin: "2026-11-03T06:30" }])).toMatchObject({ ok: false, mensaje: expect.stringMatching(/dentro del turno/) });
  });
});
