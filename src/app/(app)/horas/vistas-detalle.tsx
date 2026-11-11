// Vistas puras del detalle de una persona.

import Link from "next/link";
import { hmm, type Columnas, type EstadoTurno, type Semana } from "@/lib/horas";
import { textoSemana } from "@/lib/periodo";
import { sobretitulo } from "@/components/ui";
import { FotoTurno } from "./foto-turno";
import { Horas, tarjeta } from "./vistas";

// Los colores que hay que distinguir cambian también de claridad, no solo de tono.
const PARTES: { clave: keyof Columnas; nombre: string; color: string }[] = [
  { clave: "diurnas", nombre: "Diurnas", color: "#a9c9f5" },
  { clave: "nocturnas", nombre: "Nocturnas", color: "#0a5fd9" },
  { clave: "extraDiurnas", nombre: "Extra diurnas", color: "#f4c169" },
  { clave: "extraNocturnas", nombre: "Extra nocturnas", color: "#e08a00" },
  { clave: "dominicales", nombre: "Dominicales", color: "#1d2b53" },
  { clave: "domExtra", nombre: "Dom. extra", color: "#8a4a00" },
];

/** Barra con cuánto de lo trabajado lleva cada recargo. */
export function Composicion({ columnas }: { columnas: Columnas }) {
  const partes = PARTES.filter((p) => columnas[p.clave] > 0);
  return (
    <section className={`${tarjeta} flex flex-col gap-4 p-5`}>
      <h2 className={`${sobretitulo} tracking-[0.4px]`}>Composición</h2>
      {partes.length === 0 ? (
        <p className="text-[15px] text-suave">Sin horas en este periodo.</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={partes.map((p) => `${p.nombre} ${hmm(columnas[p.clave])}`).join(", ")}
            className="flex h-[18px] gap-0.5 overflow-hidden rounded-full"
          >
            {partes.map((p) => (
              <span key={p.clave} style={{ flex: `${columnas[p.clave]} 1 0`, background: p.color }} />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-2.5 text-sm tabular-nums">
            {partes.map((p) => (
              <li key={p.clave} className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />
                <span className="flex-1">{p.nombre}</span>
                <strong className="font-semibold">{hmm(columnas[p.clave])}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * El periodo partido en semanas (lunes a domingo) aunque no cuadren con la
 * quincena: el tope de extras es semanal y la nómina es quincenal.
 */
export function SemanaASemana({ semanas, topeExtraMin }: { semanas: Semana[]; topeExtraMin: number }) {
  const mayor = Math.max(1, ...semanas.map((s) => s.total));
  return (
    <section className={`${tarjeta} flex flex-col gap-3.5 p-5`}>
      <h2 className={`${sobretitulo} tracking-[0.4px]`}>Semana a semana</h2>
      {semanas.length === 0 && <p className="text-[15px] text-suave">Sin horas en estas semanas.</p>}
      {semanas.map((s) => (
        <div key={s.semana} className="flex flex-col gap-1.5">
          <p className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold">{textoSemana(s.semana)}</span>
            <span className="text-suave tabular-nums">
              {hmm(s.ordinarias)} ordinarias{s.extra > 0 ? ` + ${hmm(s.extra)} extra` : ""}
            </span>
          </p>
          <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-relleno">
            <span className="bg-accion" style={{ width: `${(s.ordinarias / mayor) * 100}%` }} />
            <span className="bg-[#e08a00]" style={{ width: `${(s.extra / mayor) * 100}%` }} />
          </div>
          {s.extra > topeExtraMin && (
            <p className="mt-0.5 self-start rounded-lg bg-aviso-fondo px-2.5 py-1 text-[13px] font-semibold text-aviso-texto">
              Pasó el tope legal de extras: {hmm(topeExtraMin)}
            </p>
          )}
        </div>
      ))}
      <p className="text-[13px] leading-[18px] text-suave">Semanas completas, de lunes a domingo, aunque el periodo las corte.</p>
    </section>
  );
}

export type TurnoVista = {
  id: number;
  dia: string; // "Lun 2 nov"
  entrada: string;
  salida: string | null;
  estado: EstadoTurno;
  almuerzoMin: number;
  almuerzoAbierto: boolean;
  trabajadasMin: number | null;
  fotos: { titulo: string; detalle: string; url: string }[];
  /** Lo que se dice cuando no hay miniaturas: "Sin foto" (a mano) o "Foto vencida". */
  sinFotos: string | null;
  origen: string;
  motivo: string | null;
};

const th = "px-3 py-3.5 font-semibold";
const td = "px-3 py-3.5 align-middle";

export function TablaTurnos({
  turnos,
  nombre,
  leyendaFoto,
  enlaceCorregir,
}: {
  turnos: TurnoVista[];
  nombre: string;
  leyendaFoto: string;
  /** Solo se pasa a quien puede corregir: sin él no aparecen los botones. */
  enlaceCorregir?: (id: number) => string;
}) {
  if (turnos.length === 0) {
    return <p className={`${tarjeta} p-8 text-center text-base text-suave`}>No hay turnos en este periodo.</p>;
  }
  return (
    <section className={`${tarjeta} overflow-x-auto`}>
      <table className="w-full min-w-[900px] border-collapse text-[15px] tabular-nums">
        <thead>
          <tr className="text-left text-[13px] text-suave">
            <th scope="col" className={`${th} pl-5`}>Día</th>
            <th scope="col" className={th}>Entrada y salida</th>
            <th scope="col" className={`${th} text-right`}>Almuerzo</th>
            <th scope="col" className={`${th} text-right`}>Trabajadas</th>
            <th scope="col" className={th}>Fotos</th>
            <th scope="col" className={th}>Cómo marcó</th>
            {enlaceCorregir && <th scope="col" className={`${th} pr-5`}><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {turnos.map((t) => {
            const sinCerrar = t.estado === "sin_cerrar";
            return (
              <tr key={t.id} className={`border-t border-linea ${sinCerrar ? "bg-[#fdf1ef]" : ""}`}>
                <th scope="row" className={`${td} pl-5 text-left font-semibold whitespace-nowrap`}>{t.dia}</th>
                <td className={td}>
                  {t.entrada} –{" "}
                  {t.salida ??
                    (sinCerrar ? (
                      <strong className="font-semibold text-error-texto">sin cerrar</strong>
                    ) : (
                      <span className="text-suave">en curso</span>
                    ))}
                  {t.motivo && <span className="block text-[13px] text-suave">Motivo: {t.motivo}</span>}
                </td>
                <td className={`${td} text-right`}>
                  <Horas minutos={t.almuerzoMin} />
                  {t.almuerzoAbierto && <span className="block text-[13px] text-aviso-texto">sin regreso</span>}
                </td>
                <td className={`${td} text-right`}>
                  {t.trabajadasMin !== null ? (
                    <span className="font-semibold">{hmm(t.trabajadasMin)}</span>
                  ) : sinCerrar ? (
                    <span className="font-semibold text-error-texto">No suma</span>
                  ) : (
                    <span className="text-[#b4b4bc]">—</span>
                  )}
                </td>
                <td className={td}>
                  {t.fotos.length > 0 ? (
                    <span className="flex gap-1.5">
                      {t.fotos.map((f) => (
                        <FotoTurno key={f.titulo} url={f.url} titulo={f.titulo} detalle={`${nombre} · ${f.detalle}`} leyenda={leyendaFoto} />
                      ))}
                    </span>
                  ) : (
                    <span className="text-sm text-suave">{t.sinFotos}</span>
                  )}
                </td>
                <td className={`${td} text-suave`}>{t.origen}</td>
                {enlaceCorregir && (
                  <td className={`${td} pr-5 text-right`}>
                    <Link
                      href={enlaceCorregir(t.id)}
                      className={
                        sinCerrar
                          ? "inline-flex min-h-9 items-center rounded-[10px] bg-accion px-3.5 font-semibold whitespace-nowrap text-white"
                          : "font-semibold text-accion"
                      }
                    >
                      {sinCerrar ? "Poner salida" : "Corregir"}
                      <span className="sr-only"> el turno del {t.dia}</span>
                    </Link>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
