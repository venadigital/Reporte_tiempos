// Reglas de pantalla del quiosco (el computador compartido). Las reglas de verdad
// las hace cumplir la base (quiosco_pin_verificar y quiosco_marcar).

import { horaCorta, prefijoDia, primerNombre } from "@/lib/fecha";
import type { Accion } from "@/lib/turnos";

/** Una fila de public.quiosco_estado(): sin datos personales, solo nombre y estado. */
export type PersonaQuiosco = {
  perfil_id: string;
  nombre: string;
  en_turno: boolean;
  inicio_el: string | null;
  en_pausa: boolean;
  pausa_inicio_el: string | null;
  tiene_pin: boolean;
};

export type EstadoPersona = "sin_turno" | "en_turno" | "almorzando";

/** Lo que pinta la lista. Las horas viajan ya escritas desde el servidor. */
export type PersonaVista = {
  id: string;
  nombre: string;
  primerNombre: string;
  estado: EstadoPersona;
  textoEstado: string;
  tienePin: boolean;
  acciones: Accion[];
};

export const PIN_LARGO = 4;
/** Es una pantalla compartida: no puede quedarse con un PIN a medio escribir. */
export const INACTIVIDAD_MS = 45_000;
export const LISTO_MS = 3_500;
export const REFRESCO_LISTA_MS = 60_000;

export function estadoDe(p: Pick<PersonaQuiosco, "en_turno" | "en_pausa">): EstadoPersona {
  if (!p.en_turno) return "sin_turno";
  return p.en_pausa ? "almorzando" : "en_turno";
}

/** Si solo hay una acción posible, el paso de elegir se salta. */
export function accionesPosibles(estado: EstadoPersona): Accion[] {
  switch (estado) {
    case "sin_turno":
      return ["entrada"];
    case "almorzando":
      return ["pausa_fin"];
    case "en_turno":
      return ["salida", "pausa_inicio"];
  }
}

export function textoEstado(p: PersonaQuiosco, ahora: Date | number, zona?: string): string {
  const estado = estadoDe(p);
  if (estado === "sin_turno") return "Sin turno";
  if (estado === "almorzando") return "Almorzando";
  if (!p.inicio_el) return "En turno";
  // "a las" → "", "ayer a las" → "ayer": un turno de noche dice desde cuándo
  const dia = prefijoDia(p.inicio_el, ahora, zona).replace(/ ?a las$/, "");
  return `En turno desde ${dia ? `${dia} ` : ""}${horaCorta(p.inicio_el, zona)}`;
}

export function aVista(p: PersonaQuiosco, ahora: Date | number, zona?: string): PersonaVista {
  const estado = estadoDe(p);
  return {
    id: p.perfil_id,
    nombre: p.nombre,
    primerNombre: primerNombre(p.nombre),
    estado,
    textoEstado: textoEstado(p, ahora, zona),
    tienePin: p.tiene_pin,
    acciones: accionesPosibles(estado),
  };
}

/** El botón que se toca. */
export const TITULO_ACCION: Record<Accion, string> = {
  entrada: "Iniciar turno",
  salida: "Cerrar turno",
  pausa_inicio: "Salgo a almorzar",
  pausa_fin: "Regresé del almuerzo",
};

/** "Vas a …" en la pantalla del PIN. */
export const FRASE_ACCION: Record<Accion, string> = {
  entrada: "iniciar tu turno",
  salida: "cerrar tu turno",
  pausa_inicio: "salir a almorzar",
  pausa_fin: "marcar tu regreso del almuerzo",
};

/** El "listo" dice la hora que quedó registrada. */
export function mensajeListo(accion: Accion, marcadoEl: string, zona?: string): string {
  const hora = horaCorta(marcadoEl, zona);
  switch (accion) {
    case "entrada":
      return `Entrada registrada a las ${hora}`;
    case "salida":
      return `Salida registrada a las ${hora}`;
    case "pausa_inicio":
      return `Salida a almorzar registrada a las ${hora}`;
    case "pausa_fin":
      return `Regreso del almuerzo registrado a las ${hora}`;
  }
}

export const esPin = (v: unknown): v is string => typeof v === "string" && /^[0-9]{4}$/.test(v);
export const esUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
