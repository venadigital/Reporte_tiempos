// Vistas puras del reporte: reciben los datos ya sumados. No consultan nada.

import Link from "next/link";
import { hmm, tieneExtras, type Aviso, type Columnas } from "@/lib/horas";
import { TIPOS, consulta, moverMes, tituloMes, type Periodo } from "@/lib/periodo";
import { Flecha, sobretitulo } from "@/components/ui";

export const tarjeta = "rounded-[20px] bg-white";

/** Los ceros salen como una raya gris para que lo importante no se pierda. */
export function Horas({ minutos, className = "" }: { minutos: number; className?: string }) {
  return minutos > 0 ? <span className={className}>{hmm(minutos)}</span> : <span className="text-[#b4b4bc]">—</span>;
}

// ── Selector de periodo: enlaces, sin JavaScript ─────────────────────────────
export function SelectorPeriodo({ periodo, base }: { periodo: Periodo; base: string }) {
  const enlace = (p: Periodo) => `${base}?${consulta(p)}`;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <nav aria-label="Periodo" className="flex rounded-xl bg-pausa-fondo p-[3px]">
        {TIPOS.map((t) => {
          const activo = t.valor === periodo.tipo;
          return (
            <Link
              key={t.valor}
              href={enlace({ ...periodo, tipo: t.valor })}
              aria-current={activo ? "true" : undefined}
              className={`flex h-[38px] items-center rounded-[9px] px-4 text-sm ${
                activo ? "bg-white font-semibold text-tinta shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "font-medium text-pausa-tinta"
              }`}
            >
              {t.nombre}
            </Link>
          );
        })}
      </nav>
      <div className="flex h-11 items-center gap-1 rounded-xl bg-white px-1">
        <Link href={enlace({ ...periodo, ym: moverMes(periodo.ym, -1) })} aria-label="Mes anterior" className="flex h-10 w-10 items-center justify-center text-accion">
          <Flecha atras />
        </Link>
        <span className="min-w-[132px] text-center text-[15px] font-semibold">{tituloMes(periodo.ym)}</span>
        <Link href={enlace({ ...periodo, ym: moverMes(periodo.ym, 1) })} aria-label="Mes siguiente" className="flex h-10 w-10 items-center justify-center text-accion">
          <Flecha />
        </Link>
      </div>
    </div>
  );
}

// ── Por revisar ──────────────────────────────────────────────────────────────
function IconoAviso({ nivel }: { nivel: Aviso["nivel"] }) {
  return nivel === "rojo" ? (
    <svg role="img" aria-label="Urgente" viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0 text-error-texto" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.4v.1" />
    </svg>
  ) : (
    <svg role="img" aria-label="Aviso" viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0 text-aviso-texto" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4.5l8.5 14.5h-17z" />
      <path d="M12 10v4M12 16.6v.1" />
    </svg>
  );
}

/** Solo se pinta si hay algo. `enlace` es opcional: en el detalle ya se está viendo a la persona. */
export function PorRevisar({ avisos, enlace }: { avisos: Aviso[]; enlace?: (a: Aviso) => string }) {
  if (avisos.length === 0) return null;
  return (
    <section aria-label="Por revisar" className={`${tarjeta} px-5 py-1.5`}>
      <h2 className={`${sobretitulo} pt-3.5 pb-2.5 tracking-[0.4px]`}>Por revisar · {avisos.length}</h2>
      <ul className="divide-y divide-linea border-t border-linea">
        {avisos.map((a) => (
          <li key={a.clave} className="flex items-center gap-3.5 py-3.5">
            <IconoAviso nivel={a.nivel} />
            <p className="flex-1 text-[15px] leading-[21px]">
              <strong className="font-semibold">{a.nombre}</strong> {a.texto}
            </p>
            {enlace && (
              <Link href={enlace(a)} className="text-[15px] font-semibold text-accion">
                Ver<span className="sr-only"> el detalle de {a.nombre}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Tabla principal ──────────────────────────────────────────────────────────
export type FilaTabla = {
  id: string;
  nombre: string;
  cargo: string | null;
  turnos: number;
  columnas: Columnas;
};

export type Rotulos = { nocturno: string; extraDiurna: string; extraNocturna: string; dominical: string };

const th = "px-3 py-4 font-semibold";
const td = "px-3 py-4";

function Encabezado({ titulo, recargo }: { titulo: string; recargo?: string }) {
  return (
    <th scope="col" className={th}>
      {titulo}
      {recargo && <span className="block font-normal">{recargo}</span>}
    </th>
  );
}

/** Una fila por persona, aunque esté en cero. Sin total general: no se le paga a nadie. */
export function TablaHoras({ filas, rotulos, detalle }: { filas: FilaTabla[]; rotulos: Rotulos; detalle: (id: string) => string }) {
  if (filas.length === 0) {
    return (
      <p className={`${tarjeta} p-8 text-center text-base text-suave`}>
        Todavía no hay personas que registren turnos. Se activan desde Empleados.
      </p>
    );
  }
  return (
    <section className={`${tarjeta} overflow-x-auto`}>
      <table className="w-full min-w-[920px] border-collapse text-[15px] tabular-nums">
        <thead>
          <tr className="text-right text-[13px] text-suave">
            <th scope="col" className={`${th} pl-5 text-left`}>Empleado</th>
            <Encabezado titulo="Diurnas" />
            <Encabezado titulo="Nocturnas" recargo={rotulos.nocturno} />
            <Encabezado titulo="Extra diurnas" recargo={rotulos.extraDiurna} />
            <Encabezado titulo="Extra nocturnas" recargo={rotulos.extraNocturna} />
            <Encabezado titulo="Dominicales" recargo={rotulos.dominical} />
            <Encabezado titulo="Dom. extra" />
            <th scope="col" className={`${th} text-tinta`}>Total</th>
            <th scope="col" className={`${th} pr-5`}><span className="sr-only">Detalle</span></th>
          </tr>
        </thead>
        <tbody className="text-right">
          {filas.map((f) => {
            const c = f.columnas;
            return (
              // Las filas con extras van resaltadas
              <tr key={f.id} className={`border-t border-linea ${tieneExtras(c) ? "bg-[#fff8ea]" : ""}`}>
                <th scope="row" className={`${td} pl-5 text-left font-normal`}>
                  <span className="block font-semibold">{f.nombre}</span>
                  <span className="block text-[13px] text-suave">
                    {[f.cargo, f.turnos === 0 ? "sin turnos" : f.turnos === 1 ? "1 turno" : `${f.turnos} turnos`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </th>
                <td className={td}><Horas minutos={c.diurnas} /></td>
                <td className={td}><Horas minutos={c.nocturnas} /></td>
                <td className={td}><Horas minutos={c.extraDiurnas} className="font-semibold text-aviso-texto" /></td>
                <td className={td}><Horas minutos={c.extraNocturnas} className="font-semibold text-aviso-texto" /></td>
                <td className={td}><Horas minutos={c.dominicales} /></td>
                <td className={td}><Horas minutos={c.domExtra} className="font-semibold text-aviso-texto" /></td>
                <td className={td}><Horas minutos={c.total} className="font-bold" /></td>
                <td className={`${td} pr-5`}>
                  <Link href={detalle(f.id)} className="font-semibold text-accion">
                    Detalle<span className="sr-only"> de {f.nombre}</span>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function ErrorDeCarga() {
  return (
    <p role="alert" className="rounded-2xl bg-error-fondo px-4 py-3.5 text-[15px] text-error-texto">
      No se pudo cargar el reporte. Recarga la página; no uses cifras de una carga incompleta.
    </p>
  );
}
