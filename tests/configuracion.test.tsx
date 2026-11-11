import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { festivosPorAgotarse, horaEnPunto, leerConfiguracion, minutosAHoras } from "@/lib/configuracion-reglas";
import { FormularioConfiguracion } from "@/app/(app)/configuracion/formulario";

vi.mock("@/app/(app)/configuracion/actions", () => ({ guardarConfiguracion: vi.fn() }));

const base = { jornada: "8", cierre: "", turnoMax: "14", sinAlmuerzo: "6", fotos: "45", pinIntentos: "5", pinBloqueo: "15" };

describe("forma de la configuración", () => {
  it("convierte las horas a minutos y deja la regla de cierre vacía si no aplica", () => {
    expect(leerConfiguracion(base)).toEqual({
      ok: true,
      valores: {
        jornada_diaria_min: 480, hora_cierre_operacion: null, turno_max_horas: 14,
        aviso_sin_almuerzo_min: 360, fotos_dias: 45, pin_intentos_max: 5, pin_bloqueo_min: 15,
      },
    });
  });

  it("acepta medias horas, con coma o con punto, y la hora de cierre", () => {
    const r = leerConfiguracion({ ...base, jornada: "7,5", sinAlmuerzo: "5.5", cierre: "21" });
    expect(r).toMatchObject({ ok: true, valores: { jornada_diaria_min: 450, aviso_sin_almuerzo_min: 330, hora_cierre_operacion: 21 } });
    expect(leerConfiguracion({ ...base, cierre: "0" })).toMatchObject({ ok: true, valores: { hora_cierre_operacion: 0 } });
  });

  it("rechaza valores fuera de rango, cada uno con su mensaje", () => {
    const mal = (cambio: Partial<typeof base>) => leerConfiguracion({ ...base, ...cambio });
    expect(mal({ jornada: "0.5" })).toMatchObject({ ok: false, mensaje: expect.stringMatching(/jornada diaria/) });
    expect(mal({ jornada: "" })).toMatchObject({ ok: false, mensaje: expect.stringMatching(/jornada diaria/) });
    expect(mal({ cierre: "24" })).toMatchObject({ ok: false, mensaje: expect.stringMatching(/hora de cierre/) });
    expect(mal({ turnoMax: "3" })).toMatchObject({ ok: false, mensaje: expect.stringMatching(/entre 4 y 48/) });
    expect(mal({ fotos: "0" })).toMatchObject({ ok: false, mensaje: expect.stringMatching(/1 y 3650 días/) });
    expect(mal({ fotos: "45.5" })).toMatchObject({ ok: false });
    expect(mal({ pinIntentos: "0" })).toMatchObject({ ok: false, mensaje: expect.stringMatching(/intentos/) });
    expect(mal({ pinBloqueo: "2000" })).toMatchObject({ ok: false, mensaje: expect.stringMatching(/bloqueo/) });
  });

  it("el máximo de un turno abierto tiene que ser mayor que la jornada", () => {
    expect(leerConfiguracion({ ...base, jornada: "8", turnoMax: "8" })).toMatchObject({ ok: false, mensaje: expect.stringMatching(/mayor que la jornada/) });
    expect(leerConfiguracion({ ...base, jornada: "8", turnoMax: "9" })).toMatchObject({ ok: true });
  });

  it("escribe las horas para la persona", () => {
    expect(minutosAHoras(480)).toBe("8");
    expect(minutosAHoras(450)).toBe("7.5");
    expect(horaEnPunto(21)).toBe("9:00 p. m.");
    expect(horaEnPunto(0)).toBe("12:00 a. m.");
    expect(horaEnPunto(12)).toBe("12:00 p. m.");
  });
});

describe("los festivos se acaban", () => {
  it("avisa cuando faltan menos de 90 días para el último festivo cargado, o si no hay ninguno", () => {
    expect(festivosPorAgotarse("2035-12-25", "2026-11-11")).toBe(false);
    expect(festivosPorAgotarse("2035-12-25", "2035-09-25")).toBe(false);
    expect(festivosPorAgotarse("2035-12-25", "2035-09-27")).toBe(true);
    expect(festivosPorAgotarse("2035-12-25", "2036-02-01")).toBe(true);
    expect(festivosPorAgotarse(null, "2026-11-11")).toBe(true);
  });
});

describe("pantalla de configuración", () => {
  const inicial = {
    jornada_diaria_min: 450, hora_cierre_operacion: 21, turno_max_horas: 14,
    aviso_sin_almuerzo_min: 360, fotos_dias: 45, pin_intentos_max: 5, pin_bloqueo_min: 15,
  };

  it("carga los valores guardados en unidades de persona", () => {
    render(<FormularioConfiguracion inicial={inicial} />);
    expect((screen.getByLabelText(/Jornada diaria/) as HTMLInputElement).value).toBe("7.5");
    expect((screen.getByLabelText(/Todo es extra desde/) as HTMLSelectElement).value).toBe("21");
    expect((screen.getByLabelText(/Guardar las fotos/) as HTMLInputElement).value).toBe("45");
    expect((screen.getByLabelText(/Aviso sin almuerzo/) as HTMLInputElement).value).toBe("6");
    expect((screen.getByLabelText(/Bloqueo/) as HTMLInputElement).value).toBe("15");
  });

  it("sin regla de cierre muestra 'No aplica' y advierte que la jornada cambia periodos ya pagados", () => {
    render(<FormularioConfiguracion inicial={{ ...inicial, hora_cierre_operacion: null }} />);
    const cierre = screen.getByLabelText(/Todo es extra desde/) as HTMLSelectElement;
    expect(cierre.value).toBe("");
    expect(cierre.selectedOptions[0].textContent).toBe("No aplica");
    expect(screen.getByText(/también los que ya se pagaron/)).toBeTruthy();
  });
});
