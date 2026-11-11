// Forma de la pantalla de configuración. La base (configuracion_actualizar)
// vuelve a validar los mismos rangos.

import { sumarDias } from "@/lib/periodo";

export type ConfiguracionEditable = {
  jornada_diaria_min: number;
  hora_cierre_operacion: number | null;
  turno_max_horas: number;
  aviso_sin_almuerzo_min: number;
  fotos_dias: number;
  pin_intentos_max: number;
  pin_bloqueo_min: number;
};

const entero = (texto: string) => (/^\d+$/.test(texto.trim()) ? Number(texto) : null);
/** Horas escritas con decimales (7,5 o 7.5) a minutos enteros. */
const horasAMinutos = (texto: string) => {
  const n = Number(texto.trim().replace(",", "."));
  return texto.trim() !== "" && Number.isFinite(n) ? Math.round(n * 60) : null;
};
const entre = (n: number | null, min: number, max: number): n is number => n !== null && n >= min && n <= max;

/** "6:00 p. m." para las opciones de la regla de cierre. */
export function horaEnPunto(hora: number): string {
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  return `${h12}:00 ${hora < 12 ? "a. m." : "p. m."}`;
}

export function leerConfiguracion(f: {
  jornada: string; // horas
  cierre: string; // "" = la regla no aplica; si no, la hora 0–23
  turnoMax: string; // horas
  sinAlmuerzo: string; // horas
  fotos: string; // días
  pinIntentos: string;
  pinBloqueo: string; // minutos
}): { ok: true; valores: ConfiguracionEditable } | { ok: false; mensaje: string } {
  const mal = (mensaje: string) => ({ ok: false as const, mensaje });

  const jornada = horasAMinutos(f.jornada);
  if (!entre(jornada, 60, 720)) return mal("La jornada diaria debe estar entre 1 y 12 horas.");

  const cierre = f.cierre.trim() === "" ? null : entero(f.cierre);
  if (f.cierre.trim() !== "" && !entre(cierre, 0, 23)) return mal("La hora de cierre no es válida.");

  const turnoMax = entero(f.turnoMax);
  if (!entre(turnoMax, 4, 48)) return mal("El máximo de un turno abierto debe estar entre 4 y 48 horas.");
  if (turnoMax * 60 <= jornada) return mal("El máximo de un turno abierto debe ser mayor que la jornada diaria.");

  const sinAlmuerzo = horasAMinutos(f.sinAlmuerzo);
  if (!entre(sinAlmuerzo, 60, 720)) return mal("El aviso de turno sin almuerzo debe estar entre 1 y 12 horas.");

  const fotos = entero(f.fotos);
  if (!entre(fotos, 1, 3650)) return mal("Las fotos se guardan entre 1 y 3650 días.");

  const pinIntentos = entero(f.pinIntentos);
  if (!entre(pinIntentos, 1, 20)) return mal("Los intentos del PIN deben estar entre 1 y 20.");

  const pinBloqueo = entero(f.pinBloqueo);
  if (!entre(pinBloqueo, 1, 1440)) return mal("El bloqueo del PIN debe estar entre 1 y 1440 minutos.");

  return {
    ok: true,
    valores: {
      jornada_diaria_min: jornada,
      hora_cierre_operacion: cierre,
      turno_max_horas: turnoMax,
      aviso_sin_almuerzo_min: sinAlmuerzo,
      fotos_dias: fotos,
      pin_intentos_max: pinIntentos,
      pin_bloqueo_min: pinBloqueo,
    },
  };
}

/** Minutos a horas para mostrar en un campo: 450 → "7.5", 480 → "8". */
export const minutosAHoras = (minutos: number) => String(Math.round((minutos / 60) * 100) / 100);

/**
 * Cuando se acaban los festivos cargados el cálculo NO falla: deja de reconocerlos
 * y esas horas se pagarían como día normal, en silencio. Por eso se avisa antes.
 */
export function festivosPorAgotarse(ultimoFestivo: string | null, hoyISO: string, margenDias = 90): boolean {
  return ultimoFestivo === null || ultimoFestivo < sumarDias(hoyISO, margenDias);
}
