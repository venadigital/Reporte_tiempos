import { describe, expect, it } from "vitest";
import { derivarEstado, esAccion, llevaFoto, mensajeConfirmacion, textoFoto } from "@/lib/turnos";
import { inicioPorRol, menu } from "@/lib/auth/permisos";

const ahora = new Date("2026-08-26T20:00:00Z"); // 3:00 p. m. en Colombia
const hace = (horas: number) => new Date(ahora.getTime() - horas * 3_600_000).toISOString();
const base = { marcaTurno: true, ahora, maxHoras: 14, pausaAbierta: null };

describe("qué pantalla le toca a la persona", () => {
  it("sin el interruptor: no marca", () => {
    expect(derivarEstado({ ...base, marcaTurno: false, abiertos: [] })).toEqual({ tipo: "no_marca" });
  });

  it("sin turno abierto", () => {
    expect(derivarEstado({ ...base, abiertos: [] })).toEqual({ tipo: "sin_turno", pendienteDesde: null });
  });

  it("en turno", () => {
    const inicio = hace(8);
    expect(derivarEstado({ ...base, abiertos: [{ id: 1, inicio_el: inicio, pendiente_revision: false }] }))
      .toEqual({ tipo: "en_turno", inicioEl: inicio });
  });

  it("en almuerzo", () => {
    const inicio = hace(5);
    const pausa = hace(1);
    expect(
      derivarEstado({
        ...base,
        abiertos: [{ id: 1, inicio_el: inicio, pendiente_revision: false }],
        pausaAbierta: { turno_id: 1, inicio_el: pausa },
      }),
    ).toEqual({ tipo: "en_almuerzo", inicioEl: inicio, pausaInicioEl: pausa });
  });

  it("un turno de noche de 10 horas sigue siendo un turno abierto", () => {
    const estado = derivarEstado({ ...base, abiertos: [{ id: 1, inicio_el: hace(10), pendiente_revision: false }] });
    expect(estado.tipo).toBe("en_turno");
  });

  it("un turno abierto hace más del máximo ya no se cierra: queda pendiente y deja iniciar otro", () => {
    const viejo = hace(20);
    expect(derivarEstado({ ...base, abiertos: [{ id: 1, inicio_el: viejo, pendiente_revision: false }] }))
      .toEqual({ tipo: "sin_turno", pendienteDesde: viejo });
  });

  it("con un turno pendiente de revisión y el de hoy abierto, manda el de hoy", () => {
    const hoy = hace(2);
    const estado = derivarEstado({
      ...base,
      abiertos: [
        { id: 1, inicio_el: hace(40), pendiente_revision: true },
        { id: 2, inicio_el: hoy, pendiente_revision: false },
      ],
    });
    expect(estado).toEqual({ tipo: "en_turno", inicioEl: hoy });
  });

  it("el almuerzo abierto de un turno viejo no pone en pausa el de hoy", () => {
    const estado = derivarEstado({
      ...base,
      abiertos: [
        { id: 1, inicio_el: hace(40), pendiente_revision: true },
        { id: 2, inicio_el: hace(2), pendiente_revision: false },
      ],
      pausaAbierta: { turno_id: 1, inicio_el: hace(36) },
    });
    expect(estado.tipo).toBe("en_turno");
  });
});

describe("textos y reglas de la marcación", () => {
  it("la confirmación dice la hora que quedó registrada", () => {
    expect(mensajeConfirmacion("entrada", "2026-08-26T12:02:00Z")).toBe("Turno iniciado a las 7:02 a. m.");
    expect(mensajeConfirmacion("salida", "2026-08-26T22:02:00Z")).toBe("Turno cerrado a las 5:02 p. m.");
    expect(mensajeConfirmacion("pausa_inicio", "2026-08-26T17:31:00Z")).toContain("12:31 p. m.");
    expect(mensajeConfirmacion("pausa_fin", "2026-08-26T18:30:00Z")).toContain("1:30 p. m.");
  });

  it("solo la entrada y la salida llevan foto", () => {
    expect(llevaFoto("entrada")).toBe(true);
    expect(llevaFoto("salida")).toBe(true);
    expect(llevaFoto("pausa_inicio")).toBe(false);
    expect(llevaFoto("pausa_fin")).toBe(false);
  });

  it("rechaza acciones desconocidas", () => {
    expect(esAccion("entrada")).toBe(true);
    expect(esAccion("borrar")).toBe(false);
    expect(esAccion(null)).toBe(false);
  });

  it("el plazo de las fotos sale de la configuración", () => {
    expect(textoFoto(30)).toContain("30 días");
  });
});

describe("pantalla de inicio y menú por rol", () => {
  it("cada rol cae en una pantalla que sí puede ver", () => {
    expect(inicioPorRol({ role: "quiosco", marca_turno: false })).toBe("/quiosco");
    expect(inicioPorRol({ role: "empleado", marca_turno: true })).toBe("/turnos");
    expect(inicioPorRol({ role: "coordinador", marca_turno: true })).toBe("/horas");
    expect(inicioPorRol({ role: "admin", marca_turno: false })).toBe("/horas");
  });

  it("Mi turno aparece solo con el interruptor; el reporte, a quien lo ve; empleados, al administrador", () => {
    expect(menu({ role: "empleado", marca_turno: true }).map((e) => e.href)).toEqual(["/turnos"]);
    expect(menu({ role: "empleado", marca_turno: false })).toEqual([]);
    expect(menu({ role: "coordinador", marca_turno: true }).map((e) => e.href)).toEqual(["/turnos", "/horas"]);
    expect(menu({ role: "admin", marca_turno: false }).map((e) => e.href)).toEqual(["/horas", "/empleados"]);
    expect(menu({ role: "quiosco", marca_turno: false })).toEqual([]);
  });
});
