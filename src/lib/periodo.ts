// Periodos de nómina: mes completo, quincena 1 (1–15) o quincena 2 (16–fin).
// Todo se calcula con fechas "AAAA-MM-DD" sin hora: no dependen de la zona del servidor.

import { DIAS, MESES, dos } from "@/lib/fecha";

export type TipoPeriodo = "q1" | "q2" | "mes";
export type Periodo = { tipo: TipoPeriodo; ym: string }; // ym = "2026-11"

export const TIPOS: { valor: TipoPeriodo; nombre: string }[] = [
  { valor: "q1", nombre: "Quincena 1" },
  { valor: "q2", nombre: "Quincena 2" },
  { valor: "mes", nombre: "Mes completo" },
];

const utc = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const aISO = (f: Date) => `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;

export function sumarDias(iso: string, dias: number): string {
  const f = utc(iso);
  f.setUTCDate(f.getUTCDate() + dias);
  return aISO(f);
}

/** El lunes de la semana (lunes a domingo) a la que pertenece un día. */
export function lunesDe(iso: string): string {
  const dow = utc(iso).getUTCDay(); // 0 = domingo
  return sumarDias(iso, dow === 0 ? -6 : 1 - dow);
}

export function ultimoDia(ym: string): number {
  const [a, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export function rango(p: Periodo): { desde: string; hasta: string } {
  const fin = ultimoDia(p.ym);
  if (p.tipo === "q1") return { desde: `${p.ym}-01`, hasta: `${p.ym}-15` };
  if (p.tipo === "q2") return { desde: `${p.ym}-16`, hasta: `${p.ym}-${dos(fin)}` };
  return { desde: `${p.ym}-01`, hasta: `${p.ym}-${dos(fin)}` };
}

/** La quincena en curso para un día dado. */
export function periodoDe(diaISO: string): Periodo {
  return { tipo: Number(diaISO.slice(8, 10)) <= 15 ? "q1" : "q2", ym: diaISO.slice(0, 7) };
}

/** Lee el periodo de la dirección; con valores raros cae en la quincena en curso. */
export function leerPeriodo(params: { periodo?: string; ym?: string }, hoyISO: string): Periodo {
  const actual = periodoDe(hoyISO);
  const tipo = TIPOS.some((t) => t.valor === params.periodo) ? (params.periodo as TipoPeriodo) : actual.tipo;
  const ymValido = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.ym ?? "");
  return { tipo, ym: ymValido ? (params.ym as string) : actual.ym };
}

export const consulta = (p: Periodo) => `periodo=${p.tipo}&ym=${p.ym}`;

export function moverMes(ym: string, meses: number): string {
  const [a, m] = ym.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1 + meses, 1));
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}`;
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "Noviembre 2026" */
export function tituloMes(ym: string): string {
  const [a, m] = ym.split("-").map(Number);
  return `${mayuscula(MESES[m - 1])} ${a}`;
}

/** "Del 1 al 15 de noviembre de 2026" */
export function textoRango(p: Periodo): string {
  const { desde, hasta } = rango(p);
  const [a, m] = p.ym.split("-").map(Number);
  return `Del ${Number(desde.slice(8))} al ${Number(hasta.slice(8))} de ${MESES[m - 1]} de ${a}`;
}

/** "lunes 2 de noviembre" a partir de una fecha sin hora. */
export function diaLargo(iso: string): string {
  const f = utc(iso);
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]}`;
}

/** "Lun 2 nov", para tablas. */
export function diaCorto(iso: string): string {
  const f = utc(iso);
  return `${mayuscula(DIAS[f.getUTCDay()].slice(0, 3))} ${f.getUTCDate()} ${MESES[f.getUTCMonth()].slice(0, 3)}`;
}

/** "26 oct – 1 nov": la semana que empieza ese lunes. */
export function textoSemana(lunesISO: string): string {
  const ini = utc(lunesISO);
  const fin = utc(sumarDias(lunesISO, 6));
  const mesIni = MESES[ini.getUTCMonth()].slice(0, 3);
  const mesFin = MESES[fin.getUTCMonth()].slice(0, 3);
  return mesIni === mesFin
    ? `${ini.getUTCDate()} – ${fin.getUTCDate()} ${mesFin}`
    : `${ini.getUTCDate()} ${mesIni} – ${fin.getUTCDate()} ${mesFin}`;
}
