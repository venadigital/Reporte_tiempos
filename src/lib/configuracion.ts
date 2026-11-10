import { cache } from "react";
import { crearCliente } from "@/lib/supabase/server";
import { ZONA } from "@/lib/fecha";

export type Configuracion = {
  zona_horaria: string;
  turno_max_horas: number;
  fotos_dias: number;
};

// Solo se usan si la consulta falla; los valores que mandan viven en la base.
const POR_DEFECTO: Configuracion = { zona_horaria: ZONA, turno_max_horas: 14, fotos_dias: 45 };

export const obtenerConfiguracion = cache(async (): Promise<Configuracion> => {
  const supabase = await crearCliente();
  const { data } = await supabase
    .from("configuracion")
    .select("zona_horaria, turno_max_horas, fotos_dias")
    .maybeSingle();
  return (data as Configuracion | null) ?? POR_DEFECTO;
});
