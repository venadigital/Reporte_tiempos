import { describe, expect, it } from "vitest";
import { diaISO, fechaLarga, horaConDia, horaCorta, horaPartida, partes, prefijoDia, primerNombre, saludo } from "@/lib/fecha";

// Todos los instantes van en UTC, como los entrega la base. Colombia es UTC-5.
describe("hora y fecha en la zona del negocio", () => {
  it("escribe la hora en formato de 12 horas", () => {
    expect(horaCorta("2026-08-26T12:02:00Z")).toBe("7:02 a. m.");
    expect(horaCorta("2026-08-26T17:31:00Z")).toBe("12:31 p. m.");
    expect(horaCorta("2026-08-26T05:05:00Z")).toBe("12:05 a. m.");
    expect(horaCorta("2026-08-27T03:02:00Z")).toBe("10:02 p. m.");
  });

  it("escribe la fecha larga con el día de la semana", () => {
    expect(fechaLarga("2026-08-26T12:00:00Z")).toBe("miércoles 26 de agosto");
    expect(fechaLarga("2026-03-02T12:00:00Z")).toBe("lunes 2 de marzo");
  });

  it("desde las 7 p. m. el servidor ya cree que es mañana: el día sale de la zona", () => {
    // 27 de agosto 01:30 UTC = 26 de agosto 8:30 p. m. en Colombia
    expect(diaISO("2026-08-27T01:30:00Z")).toBe("2026-08-26");
    expect(partes("2026-08-27T01:30:00Z")).toMatchObject({ dia: 26, hora: 20, minuto: 30, diaSemana: 3 });
  });

  it("respeta otra zona si la configuración la cambia", () => {
    expect(horaCorta("2026-08-26T12:02:00Z", "America/Mexico_City")).toBe("6:02 a. m.");
  });

  it("saluda según la hora local", () => {
    expect(saludo("2026-08-26T16:59:00Z")).toBe("Buenos días"); // 11:59 a. m.
    expect(saludo("2026-08-26T17:00:00Z")).toBe("Buenas tardes"); // 12:00 m.
    expect(saludo("2026-08-27T00:00:00Z")).toBe("Buenas noches"); // 7:00 p. m.
  });
});

describe("la hora de una marcación con su día (turnos de noche)", () => {
  const ahora = "2026-08-26T15:00:00Z"; // miércoles 10:00 a. m.

  it("hoy: solo la hora", () => {
    expect(horaConDia("2026-08-26T12:02:00Z", ahora)).toBe("a las 7:02 a. m.");
  });
  it("anoche: dice ayer", () => {
    expect(horaConDia("2026-08-26T03:02:00Z", ahora)).toBe("ayer a las 10:02 p. m.");
  });
  it("se parte en prefijo y hora para pintar el número grande", () => {
    expect(prefijoDia("2026-08-26T03:02:00Z", ahora)).toBe("ayer a las");
    expect(horaPartida("2026-08-26T03:02:00Z")).toEqual({ hora: "10:02", periodo: "p. m." });
    expect(horaPartida("2026-08-26T17:00:00Z")).toEqual({ hora: "12:00", periodo: "p. m." });
  });
  it("más atrás: dice el día", () => {
    expect(horaConDia("2026-08-24T12:02:00Z", ahora)).toBe("el lunes 24 de agosto a las 7:02 a. m.");
  });
});

describe("primer nombre", () => {
  it("toma la primera palabra", () => {
    expect(primerNombre("  Camila Andrea Rojas ")).toBe("Camila");
  });
});
