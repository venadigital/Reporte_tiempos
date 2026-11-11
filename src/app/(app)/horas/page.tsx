import type { Metadata } from "next";
import { diaISO } from "@/lib/fecha";
import { armarAvisos, quienesSalen, recargoVigente, sumar, type Recargo } from "@/lib/horas";
import { consulta, leerPeriodo, textoRango } from "@/lib/periodo";
import { botonCompacto, tituloGrande } from "@/components/ui";
import { cargarReporte, exigirReporte } from "./datos";
import { ErrorDeCarga, PorRevisar, SelectorPeriodo, TablaHoras, type FilaTabla, type Rotulos } from "./vistas";

export const metadata: Metadata = { title: "Horas del personal" };

function rotulos(recargos: Recargo[], fecha: string): Rotulos {
  const pct = (concepto: string) => {
    const valor = recargoVigente(recargos, concepto, fecha);
    return valor === null ? "" : `+${valor} %`;
  };
  return {
    nocturno: pct("nocturno"),
    extraDiurna: pct("extra_diurna"),
    extraNocturna: pct("extra_nocturna"),
    dominical: pct("dominical"),
  };
}

export default async function PaginaHoras({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; ym?: string }>;
}) {
  await exigirReporte();
  const periodo = leerPeriodo(await searchParams, diaISO(new Date()));
  const reporte = await cargarReporte(periodo);

  const encabezado = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className={tituloGrande}>Horas del personal</h1>
          <p className="text-base text-suave">{textoRango(periodo)}</p>
        </div>
        {/* Enlace simple, no de la aplicación: es una descarga, no una página */}
        <a href={`/horas/exportar?${consulta(periodo)}`} download className={botonCompacto}>
          <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14" />
          </svg>
          Descargar Excel
        </a>
      </div>
      <SelectorPeriodo periodo={periodo} base="/horas" />
    </>
  );

  if (!reporte) {
    return (
      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-9 sm:px-6">
        {encabezado}
        <ErrorDeCarga />
      </main>
    );
  }

  const filas: FilaTabla[] = quienesSalen(reporte.personas, reporte.filas, reporte.turnos).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    cargo: p.cargo,
    turnos: reporte.turnos.filter((t) => t.perfil_id === p.id).length,
    columnas: sumar(reporte.filas.filter((f) => f.perfil_id === p.id)),
  }));

  const avisos = armarAvisos({
    nombres: new Map(reporte.personas.map((p) => [p.id, p.nombre])),
    periodo,
    desde: reporte.desde,
    hasta: reporte.hasta,
    filasSemanas: reporte.filasSemanas,
    turnos: reporte.turnos,
    abiertos: reporte.abiertos,
    ahora: reporte.ahora,
    zona: reporte.config.zona_horaria,
    maxHoras: reporte.config.turno_max_horas,
    topeSemanaMin: reporte.config.extras_tope_semana_min,
    topeDiaMin: reporte.config.extras_tope_dia_min,
    sinAlmuerzoMin: reporte.config.aviso_sin_almuerzo_min,
  });

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-9 sm:px-6">
      {encabezado}
      <PorRevisar avisos={avisos} enlace={(a) => `/horas/${a.perfilId}?${consulta(a.periodo)}`} />
      <TablaHoras
        filas={filas}
        rotulos={rotulos(reporte.recargos, reporte.hasta)}
        detalle={(id) => `/horas/${id}?${consulta(periodo)}`}
      />
      <p className="px-1 text-[13px] leading-[19px] text-suave">
        Horas en formato h:mm. El sistema entrega horas, no pesos: los porcentajes son el recargo legal de
        referencia. Un turno sin cerrar no suma hasta que se corrija. No hay total general porque sumar las horas de
        todos da un número que no se le paga a nadie.
      </p>
    </main>
  );
}
