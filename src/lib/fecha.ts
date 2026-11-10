// Fechas y horas en la zona del negocio.
//
// El servidor corre en UTC: "hoy" y la hora de una marcación SIEMPRE se calculan
// con la zona explícita. Los textos se arman a mano (no con toLocaleString) porque
// el formato en español mete espacios especiales distintos en el servidor y en el
// navegador, y la pantalla deja de pintar al hidratar.

export const ZONA = "America/Bogota";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export type Partes = {
  anio: number;
  mes: number; // 1-12
  dia: number;
  hora: number; // 0-23
  minuto: number;
  diaSemana: number; // 0 = domingo
};

type Instante = Date | string | number;

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateador(zona: string) {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formateadores.set(zona, f);
  }
  return f;
}

/** Descompone un instante en la zona del negocio. */
export function partes(valor: Instante, zona: string = ZONA): Partes {
  const p: Record<string, number> = {};
  for (const { type, value } of formateador(zona).formatToParts(new Date(valor))) {
    if (type !== "literal") p[type] = Number(value);
  }
  return {
    anio: p.year,
    mes: p.month,
    dia: p.day,
    hora: p.hour % 24,
    minuto: p.minute,
    diaSemana: new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(),
  };
}

const dos = (n: number) => String(n).padStart(2, "0");

/** "2026-08-26": el día calendario en la zona del negocio. */
export function diaISO(valor: Instante, zona: string = ZONA): string {
  const p = partes(valor, zona);
  return `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`;
}

/** La hora en dos piezas, para pintar el número grande: { hora: "7:02", periodo: "a. m." } */
export function horaPartida(valor: Instante, zona: string = ZONA): { hora: string; periodo: string } {
  const { hora, minuto } = partes(valor, zona);
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  return { hora: `${h12}:${dos(minuto)}`, periodo: hora < 12 ? "a. m." : "p. m." };
}

/** "7:02 a. m." */
export function horaCorta(valor: Instante, zona: string = ZONA): string {
  const { hora, periodo } = horaPartida(valor, zona);
  return `${hora} ${periodo}`;
}

/** "martes 26 de agosto" */
export function fechaLarga(valor: Instante, zona: string = ZONA): string {
  const p = partes(valor, zona);
  return `${DIAS[p.diaSemana]} ${p.dia} de ${MESES[p.mes - 1]}`;
}

/** "Buenos días" / "Buenas tardes" / "Buenas noches" */
export function saludo(valor: Instante, zona: string = ZONA): string {
  const { hora } = partes(valor, zona);
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

function diasEntre(desde: Instante, hasta: Instante, zona: string): number {
  const a = partes(desde, zona);
  const b = partes(hasta, zona);
  return Math.round(
    (Date.UTC(b.anio, b.mes - 1, b.dia) - Date.UTC(a.anio, a.mes - 1, a.dia)) / 86_400_000,
  );
}

/**
 * Cómo se dice el día de una marcación, pensando en los turnos de noche:
 * "a las" (hoy), "ayer a las" o "el lunes 24 de agosto a las".
 */
export function prefijoDia(valor: Instante, ahora: Instante, zona: string = ZONA): string {
  const dias = diasEntre(valor, ahora, zona);
  if (dias === 0) return "a las";
  if (dias === 1) return "ayer a las";
  return `el ${fechaLarga(valor, zona)} a las`;
}

/** "a las 7:02 a. m.", "ayer a las 10:02 p. m." o "el lunes 24 de agosto a las 7:02 a. m." */
export function horaConDia(valor: Instante, ahora: Instante, zona: string = ZONA): string {
  return `${prefijoDia(valor, ahora, zona)} ${horaCorta(valor, zona)}`;
}

/** Primer nombre, para el saludo. */
export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}
