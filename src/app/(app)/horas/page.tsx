import type { Metadata } from "next";
import { diaISO } from "@/lib/fecha";
import { armarAvisos, recargoVigente, sumar, type Recargo } from "@/lib/horas";
import { consulta, leerPeriodo, textoRango } from "@/lib/periodo";
import { tituloGrande } from "@/components/ui";
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
      <div className="flex flex-col gap-1">
        <h1 className={tituloGrande}>Horas del personal</h1>
        <p className="text-base text-suave">{textoRango(periodo)}</p>
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

  // Una fila por persona que marca (aunque esté en cero: que alguien aparezca sin
  // horas es información), más quien tenga turnos en el periodo aunque ya no marque.
  const conTurnos = new Set([...reporte.filas.map((f) => f.perfil_id), ...reporte.turnos.map((t) => t.perfil_id)]);
  const filas: FilaTabla[] = reporte.personas
    .filter((p) => (p.marca_turno && p.activo) || conTurnos.has(p.id))
    .map((p) => ({
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
