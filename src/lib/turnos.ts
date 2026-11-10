// Reglas de pantalla de la marcación. Las reglas de verdad las hace cumplir la
// base de datos (private.turno_marcar); aquí solo se decide qué mostrar.

import { horaCorta } from "@/lib/fecha";

export type Accion = "entrada" | "salida" | "pausa_inicio" | "pausa_fin";

export const ACCIONES: readonly Accion[] = ["entrada", "salida", "pausa_inicio", "pausa_fin"];
export const esAccion = (v: unknown): v is Accion => ACCIONES.includes(v as Accion);

/** Sin foto no hay entrada ni salida. El almuerzo no lleva foto. */
export const llevaFoto = (accion: Accion) => accion === "entrada" || accion === "salida";

export const FOTO_MAX_BYTES = 3 * 1024 * 1024;
export const FOTO_LADO_PX = 640;
export const FOTO_CALIDAD = 0.82;

export type TurnoAbierto = {
  id: number;
  inicio_el: string;
  pendiente_revision: boolean;
};

export type EstadoTurno =
  | { tipo: "no_marca" }
  // pendienteDesde: hay un turno anterior que se quedó sin cerrar
  | { tipo: "sin_turno"; pendienteDesde: string | null }
  | { tipo: "en_turno"; inicioEl: string }
  | { tipo: "en_almuerzo"; inicioEl: string; pausaInicioEl: string };

/**
 * Qué pantalla le toca a la persona.
 *
 * Un turno abierto hace más del máximo ya no se puede cerrar desde aquí (nunca
 * se inventa la salida): cuenta como "sin turno", se le avisa que quedó pendiente
 * de revisión y puede iniciar el de hoy.
 */
export function derivarEstado(datos: {
  marcaTurno: boolean;
  abiertos: TurnoAbierto[];
  pausaAbierta: { turno_id: number; inicio_el: string } | null;
  ahora: Date | number;
  maxHoras: number;
}): EstadoTurno {
  if (!datos.marcaTurno) return { tipo: "no_marca" };

  const limite = new Date(datos.ahora).getTime() - datos.maxHoras * 3_600_000;
  const vigente = datos.abiertos.find(
    (t) => !t.pendiente_revision && new Date(t.inicio_el).getTime() >= limite,
  );

  if (!vigente) {
    const pendientes = datos.abiertos
      .map((t) => t.inicio_el)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return { tipo: "sin_turno", pendienteDesde: pendientes[0] ?? null };
  }

  if (datos.pausaAbierta && datos.pausaAbierta.turno_id === vigente.id) {
    return {
      tipo: "en_almuerzo",
      inicioEl: vigente.inicio_el,
      pausaInicioEl: datos.pausaAbierta.inicio_el,
    };
  }
  return { tipo: "en_turno", inicioEl: vigente.inicio_el };
}

/**
 * La confirmación dice la hora que quedó registrada, no un simple "listo".
 * Sin punto final: la hora ya termina en "m.".
 */
export function mensajeConfirmacion(accion: Accion, marcadoEl: string, zona?: string): string {
  const hora = horaCorta(marcadoEl, zona);
  switch (accion) {
    case "entrada":
      return `Turno iniciado a las ${hora}`;
    case "pausa_inicio":
      return `Salida a almorzar registrada a las ${hora}`;
    case "pausa_fin":
      return `Regreso del almuerzo registrado a las ${hora}`;
    case "salida":
      return `Turno cerrado a las ${hora}`;
  }
}

/** Texto bajo el botón de la cámara. El número de días sale de la configuración. */
export const textoFoto = (dias: number) =>
  `Tu hora queda registrada al tomarla. La foto se guarda ${dias} días y solo la ve la administración.`;
