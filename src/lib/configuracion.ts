import { cache } from "react";
import { crearCliente } from "@/lib/supabase/server";
import { ZONA } from "@/lib/fecha";

export type Configuracion = {
  zona_horaria: string;
  turno_max_horas: number;
  fotos_dias: number;
  jornada_diaria_min: number;
  semana_max_min: number;
  extras_tope_dia_min: number;
  extras_tope_semana_min: number;
  aviso_sin_almuerzo_min: number;
};

// Solo se usan si la consulta falla; los valores que mandan viven en la base.
const POR_DEFECTO: Configuracion = {
  zona_horaria: ZONA,
  turno_max_horas: 14,
  fotos_dias: 45,
  jornada_diaria_min: 480,
  semana_max_min: 2520,
  extras_tope_dia_min: 120,
  extras_tope_semana_min: 720,
  aviso_sin_almuerzo_min: 360,
};

export const obtenerConfiguracion = cache(async (): Promise<Configuracion> => {
  const supabase = await crearCliente();
  const { data } = await supabase
    .from("configuracion")
    .select(
      "zona_horaria, turno_max_horas, fotos_dias, jornada_diaria_min, semana_max_min, extras_tope_dia_min, extras_tope_semana_min, aviso_sin_almuerzo_min",
    )
    .maybeSingle();
  return (data as Configuracion | null) ?? POR_DEFECTO;
});
