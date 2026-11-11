import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { diaISO, horaCorta } from "@/lib/fecha";
import { ORIGEN, armarAvisos, estadoTurno, hmm, porSemana, sumar, type TurnoListado } from "@/lib/horas";
import { consulta, diaCorto, leerPeriodo, textoRango } from "@/lib/periodo";
import { esUuid } from "@/lib/quiosco";
import { Aviso, Flecha, tituloGrande } from "@/components/ui";
import { cargarReporte, exigirReporte } from "../datos";
import { firmarFotos } from "../fotos";
import { ErrorDeCarga, PorRevisar, SelectorPeriodo } from "../vistas";
import { Composicion, SemanaASemana, TablaTurnos, type TurnoVista } from "../vistas-detalle";

export const metadata: Metadata = { title: "Detalle de horas" };

const HECHO: Record<string, string> = {
  corregido: "Turno corregido. Quedó en la bitácora con el motivo.",
  agregado: "Turno agregado. Queda marcado como corregido a mano, sin foto.",
  eliminado: "Turno borrado. Quedó en la bitácora con el motivo.",
};

export default async function PaginaDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string; ym?: string; hecho?: string }>;
}) {
  const { puedeCorregir } = await exigirReporte();
  const [{ id }, consultaUrl] = await Promise.all([params, searchParams]);
  if (!esUuid(id)) notFound();

  const periodo = leerPeriodo(consultaUrl, diaISO(new Date()));
  const qs = consulta(periodo);
  const reporte = await cargarReporte(periodo, id);

  const volver = (
    <Link href={`/horas?${qs}`} className="flex h-11 items-center gap-1 self-start text-[15px] font-medium text-accion">
      <Flecha atras />
      Horas del personal
    </Link>
  );

  if (!reporte) {
    return (
      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-5 pb-12 sm:px-6">
        {volver}
        <ErrorDeCarga />
      </main>
    );
  }

  const persona = reporte.personas[0];
  if (!persona) notFound(); // una persona que no existe da "no encontrado"

  const zona = reporte.config.zona_horaria;
  const fotos = await firmarFotos(reporte.turnos.flatMap((t) => [t.foto_inicio_path, t.foto_fin_path]));
  const columnas = sumar(reporte.filas);

  const aVista = (t: TurnoListado): TurnoVista => {
    const estado = estadoTurno(t, reporte.ahora, reporte.config.turno_max_horas);
    const miniaturas = [
      { titulo: "Foto de entrada", ruta: t.foto_inicio_path, instante: t.inicio_el },
      { titulo: "Foto de salida", ruta: t.foto_fin_path, instante: t.fin_el },
    ].flatMap((f) => {
      const url = f.ruta ? fotos.get(f.ruta) : undefined;
      return url && f.instante
        ? [{ titulo: f.titulo, url, detalle: `${diaCorto(diaISO(f.instante, zona))} · ${horaCorta(f.instante, zona)}` }]
        : [];
    });
    return {
      id: t.turno_id,
      dia: diaCorto(t.dia),
      entrada: horaCorta(t.inicio_el, zona),
      salida: t.fin_el ? horaCorta(t.fin_el, zona) : null,
      estado,
      almuerzoMin: t.minutos_pausa,
      almuerzoAbierto: t.pausa_abierta,
      trabajadasMin: t.minutos_trabajados,
      fotos: miniaturas,
      // Un turno creado a mano dice "sin foto" y no cuenta como falta de foto
      sinFotos: miniaturas.length > 0 ? null : t.origen === "ajuste" ? "Sin foto" : "Foto vencida",
      origen: ORIGEN[t.origen],
      motivo: t.ajuste_motivo,
    };
  };

  const avisos = armarAvisos({
    nombres: new Map([[persona.id, persona.nombre]]),
    periodo,
    desde: reporte.desde,
    hasta: reporte.hasta,
    filasSemanas: reporte.filasSemanas,
    turnos: reporte.turnos,
    abiertos: reporte.abiertos,
    ahora: reporte.ahora,
    zona,
    maxHoras: reporte.config.turno_max_horas,
    topeSemanaMin: reporte.config.extras_tope_semana_min,
    topeDiaMin: reporte.config.extras_tope_dia_min,
    sinAlmuerzoMin: reporte.config.aviso_sin_almuerzo_min,
  });

  const cifra = "text-[26px] leading-8 font-bold tabular-nums";

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-5 pb-12 sm:px-6">
      {volver}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className={tituloGrande}>{persona.nombre}</h1>
          <p className="text-base text-suave">{[persona.cargo, textoRango(periodo)].filter(Boolean).join(" · ")}</p>
        </div>
        <dl className="flex items-center gap-7 text-right">
          <div>
            <dt className="text-[13px] text-suave">Turnos</dt>
            <dd className={cifra}>{reporte.turnos.length}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-suave">Total trabajado</dt>
            <dd className={cifra}>{hmm(columnas.total)}</dd>
          </div>
        </dl>
      </div>

      <SelectorPeriodo periodo={periodo} base={`/horas/${id}`} />

      {consultaUrl.hecho && HECHO[consultaUrl.hecho] && <Aviso resultado={{ ok: true, mensaje: HECHO[consultaUrl.hecho] }} />}
      <PorRevisar avisos={avisos} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Composicion columnas={columnas} />
        <SemanaASemana semanas={porSemana(reporte.filasSemanas)} topeExtraMin={reporte.config.extras_tope_semana_min} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold tracking-[-0.3px]">Turnos</h2>
        {puedeCorregir && (
          <Link
            href={`/horas/${id}/turno/nuevo?${qs}`}
            className="flex h-11 items-center gap-2 rounded-xl bg-accion-suave px-4 text-[15px] font-semibold text-accion"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Agregar un turno que no se marcó
          </Link>
        )}
      </div>

      <TablaTurnos
        turnos={reporte.turnos.map(aVista)}
        nombre={persona.nombre}
        leyendaFoto={`La hora la puso el servidor al tomarse la foto, no el aparato. Las fotos se borran a los ${reporte.config.fotos_dias} días; el registro del turno se conserva siempre.`}
        enlaceCorregir={puedeCorregir ? (turno) => `/horas/${id}/turno/${turno}?${qs}` : undefined}
      />
    </main>
  );
}
