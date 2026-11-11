import { cache } from "react";
import { crearCliente } from "@/lib/supabase/server";
import { ZONA } from "@/lib/fecha";

export type Configuracion = {
  zona_horaria: string;
  hora_inicia_diurna: number;
  hora_inicia_nocturna: number;
  hora_cierre_operacion: number | null;
  jornada_diaria_min: number;
  semana_max_min: number;
  extras_tope_dia_min: number;
  extras_tope_semana_min: number;
  turno_max_horas: number;
  aviso_sin_almuerzo_min: number;
  fotos_dias: number;
  pin_intentos_max: number;
  pin_bloqueo_min: number;
};

// Solo se usan si la consulta falla; los valores que mandan viven en la base.
const POR_DEFECTO: Configuracion = {
  zona_horaria: ZONA,
  hora_inicia_diurna: 6,
  hora_inicia_nocturna: 19,
  hora_cierre_operacion: null,
  jornada_diaria_min: 480,
  semana_max_min: 2520,
  extras_tope_dia_min: 120,
  extras_tope_semana_min: 720,
  turno_max_horas: 14,
  aviso_sin_almuerzo_min: 360,
  fotos_dias: 45,
  pin_intentos_max: 5,
  pin_bloqueo_min: 15,
};

export const obtenerConfiguracion = cache(async (): Promise<Configuracion> => {
  const supabase = await crearCliente();
  const { data } = await supabase.from("configuracion").select(Object.keys(POR_DEFECTO).join(", ")).maybeSingle();
  return (data as Configuracion | null) ?? POR_DEFECTO;
});
