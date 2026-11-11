// Forma de una corrección de turno. La comparten el formulario y la acción del
// servidor; la base (private.turno_valida) vuelve a validar todo lo demás.

import { instanteEnZona } from "@/lib/fecha";

export type TurnoCorregido = { inicio: string; fin: string; pausas: { inicio: string; fin: string }[] };

/**
 * Lee entrada, salida y almuerzos escritos en hora local y los convierte a instantes.
 * Devuelve el mensaje de error si falta algo.
 */
export function leerCorreccion(
  d: { entrada: string; salida: string; pausas: { inicio: string; fin: string }[]; motivo: string },
  zona: string,
): { ok: true; turno: TurnoCorregido } | { ok: false; mensaje: string } {
  const mal = (mensaje: string) => ({ ok: false as const, mensaje });

  if (!d.motivo.trim()) return mal("Escribe el motivo de la corrección.");
  const inicio = instanteEnZona(d.entrada, zona);
  const fin = instanteEnZona(d.salida, zona);
  if (!inicio || !fin) return mal("Hacen falta la hora de entrada y la de salida.");
  if (fin <= inicio) return mal("La salida debe ser posterior a la entrada.");

  const pausas: TurnoCorregido["pausas"] = [];
  for (const p of d.pausas) {
    if (!p.inicio && !p.fin) continue; // renglón vacío: no hay almuerzo
    const pi = instanteEnZona(p.inicio, zona);
    const pf = instanteEnZona(p.fin, zona);
    if (!pi || !pf) return mal("Cada almuerzo necesita la hora de salida y la de regreso.");
    if (pf <= pi) return mal("El regreso del almuerzo debe ser posterior a la salida a almorzar.");
    if (pi < inicio || pf > fin) return mal("El almuerzo debe caer dentro del turno.");
    pausas.push({ inicio: pi, fin: pf });
  }
  return { ok: true, turno: { inicio, fin, pausas } };
}
