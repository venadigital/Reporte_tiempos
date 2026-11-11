import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { administraEmpleados, inicioPorRol } from "@/lib/auth/permisos";
import { crearCliente } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { festivosPorAgotarse, horaEnPunto } from "@/lib/configuracion-reglas";
import { diaISO } from "@/lib/fecha";
import { hmm, type Recargo } from "@/lib/horas";
import { diaLargo } from "@/lib/periodo";
import { Grupo, fila, tituloGrande } from "@/components/ui";
import { FormularioConfiguracion } from "./formulario";

export const metadata: Metadata = { title: "Configuración" };

const NOMBRE_RECARGO: Record<string, string> = {
  nocturno: "Nocturno",
  extra_diurna: "Extra diurna",
  extra_nocturna: "Extra nocturna",
  dominical: "Dominical y festivo",
};

export default async function PaginaConfiguracion() {
  const perfil = await exigirPerfil();
  if (!administraEmpleados(perfil.role)) redirect(inicioPorRol(perfil));

  const [config, supabase] = await Promise.all([obtenerConfiguracion(), crearCliente()]);
  const [{ data: festivo }, { data: recargos }] = await Promise.all([
    supabase.from("festivo").select("fecha").order("fecha", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("recargo").select("concepto, desde, porcentaje").order("desde"),
  ]);

  const hoy = diaISO(new Date(), config.zona_horaria);
  const ultimoFestivo = (festivo as { fecha: string } | null)?.fecha ?? null;
  const dato = "text-suave tabular-nums";

  // De cada recargo, el vigente hoy y, si lo hay, el próximo cambio
  const porConcepto = new Map<string, Recargo[]>();
  for (const r of (recargos ?? []) as Recargo[]) porConcepto.set(r.concepto, [...(porConcepto.get(r.concepto) ?? []), r]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-[22px] px-5 pt-9 pb-10">
      <header className="flex flex-col gap-1 px-1">
        <h1 className={tituloGrande}>Configuración</h1>
        <p className="text-base leading-[22px] text-suave">Los parámetros del negocio. Cada cambio queda en la bitácora.</p>
      </header>

      <FormularioConfiguracion inicial={config} />

      <Grupo titulo="Ley laboral" nota="Los fija la ley colombiana y no se editan aquí. Los porcentajes son solo rótulos del reporte: el sistema entrega horas, no pesos.">
        <p className={fila}>
          <span className="flex-1">Franja diurna</span>
          <span className={dato}>
            {horaEnPunto(config.hora_inicia_diurna)} – {horaEnPunto(config.hora_inicia_nocturna)}
          </span>
        </p>
        <p className={fila}>
          <span className="flex-1">Tope semanal</span>
          <span className={dato}>{hmm(config.semana_max_min)} horas</span>
        </p>
        <p className={fila}>
          <span className="flex-1">Tope de extras</span>
          <span className={dato}>
            {hmm(config.extras_tope_dia_min)} al día · {hmm(config.extras_tope_semana_min)} a la semana
          </span>
        </p>
        {[...porConcepto.entries()].map(([concepto, lista]) => {
          const vigente = [...lista].reverse().find((r) => r.desde <= hoy);
          const proximo = lista.find((r) => r.desde > hoy);
          return (
            <p key={concepto} className={`${fila} flex-wrap gap-y-0 py-2`}>
              <span className="flex-1">{NOMBRE_RECARGO[concepto] ?? concepto}</span>
              <span className={dato}>{vigente ? `+${Number(vigente.porcentaje)} %` : "—"}</span>
              {proximo && (
                <span className="basis-full text-[13px] text-suave">
                  Sube a +{Number(proximo.porcentaje)} % el {diaLargo(proximo.desde).replace(/^\S+ /, "")} de {proximo.desde.slice(0, 4)}
                </span>
              )}
            </p>
          );
        })}
      </Grupo>

      <Grupo
        titulo="Festivos"
        nota="Cuando se acaban los festivos cargados el cálculo no falla: deja de reconocerlos y esas horas se pagarían como día normal. Se vuelven a generar con el script del proyecto."
      >
        <p className={fila}>
          <span className="flex-1">Cargados hasta</span>
          <span className={dato}>{ultimoFestivo ? `${diaLargo(ultimoFestivo).replace(/^\S+ /, "")} de ${ultimoFestivo.slice(0, 4)}` : "ninguno"}</span>
        </p>
        {festivosPorAgotarse(ultimoFestivo, hoy) && (
          <p role="alert" className="px-4 py-3 text-[15px] leading-5 font-medium text-aviso-texto">
            Los festivos están por agotarse. Hay que volver a generarlos antes de esa fecha.
          </p>
        )}
      </Grupo>
    </main>
  );
}
