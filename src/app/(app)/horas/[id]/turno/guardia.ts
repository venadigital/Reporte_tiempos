import { notFound, redirect } from "next/navigation";
import { diaISO } from "@/lib/fecha";
import { consulta, leerPeriodo } from "@/lib/periodo";
import { esUuid } from "@/lib/quiosco";
import { crearCliente } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { exigirReporte } from "../../datos";

/**
 * Guardia de las páginas de corrección: solo quien puede corregir. El coordinador
 * ve el reporte, pero estas páginas lo devuelven al detalle.
 */
export async function prepararCorreccion(id: string, consultaUrl: { periodo?: string; ym?: string }) {
  const { puedeCorregir } = await exigirReporte();
  if (!esUuid(id)) notFound();

  const periodo = leerPeriodo(consultaUrl, diaISO(new Date()));
  const qs = consulta(periodo);
  if (!puedeCorregir) redirect(`/horas/${id}?${qs}`);

  const [config, supabase] = await Promise.all([obtenerConfiguracion(), crearCliente()]);
  const { data: persona } = await supabase.from("profiles").select("id, nombre").eq("id", id).maybeSingle();
  if (!persona) notFound();

  return { periodo, qs, config, supabase, persona: persona as { id: string; nombre: string } };
}
