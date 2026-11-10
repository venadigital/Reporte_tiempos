// Piezas compartidas del sistema visual. Sin estado: sirven en el servidor y en el navegador.

import type { ReactNode } from "react";

export const botonPrincipal =
  "flex h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-accion px-5 text-[17px] font-semibold text-white transition-colors hover:bg-accion-fuerte disabled:opacity-50";
export const botonSuave =
  "flex h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-accion-suave px-5 text-[17px] font-semibold text-accion disabled:opacity-50";
export const botonCompacto =
  "flex h-11 items-center justify-center gap-2 rounded-xl bg-accion px-[18px] text-[15px] font-semibold text-white transition-colors hover:bg-accion-fuerte disabled:opacity-50";

export const tituloGrande = "text-[34px] leading-10 font-bold tracking-[-0.6px]";
export const sobretitulo = "text-[13px] leading-[18px] font-semibold tracking-[0.3px] text-suave uppercase";

export type Resultado = { ok: boolean; mensaje: string } | null;

export function IconoCamara({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1-1.6a1 1 0 0 1 .9-.4h4.8a1 1 0 0 1 .9.4l1 1.6h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

export function IconoReloj({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function Flecha({ atras = false, className = "h-[18px] w-[18px]" }: { atras?: boolean; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={atras ? "M14.5 6l-6 6 6 6" : "M9.5 6l6 6-6 6"} />
    </svg>
  );
}

/** Confirmación (se anuncia) o error (alerta), con ícono además del color. */
export function Aviso({ resultado }: { resultado: Resultado }) {
  if (!resultado) return null;
  return (
    <p
      role={resultado.ok ? "status" : "alert"}
      className={`flex items-center gap-2.5 rounded-2xl px-4 py-3.5 text-[15px] leading-5 font-medium ${
        resultado.ok ? "bg-white text-tinta" : "bg-error-fondo text-error-texto"
      }`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className={`h-[22px] w-[22px] shrink-0 ${resultado.ok ? "text-turno-texto" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        {resultado.ok ? <path d="M8 12.5l2.8 2.8L16 9.8" /> : <path d="M12 7.5v5.5M12 16.4v.1" />}
      </svg>
      {resultado.mensaje}
    </p>
  );
}

/** Lista agrupada: título en versalitas, tarjeta blanca con filas y nota al pie. */
export function Grupo({ titulo, nota, children }: { titulo?: string; nota?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {titulo && <h2 className={`px-4 ${sobretitulo} tracking-[0.4px]`}>{titulo}</h2>}
      <div className="divide-y divide-linea overflow-hidden rounded-2xl bg-white">{children}</div>
      {nota && <p className="px-4 text-[13px] leading-[18px] text-suave">{nota}</p>}
    </section>
  );
}

export const fila = "flex min-h-[52px] items-center gap-3 px-4 text-base";
export const campoFila =
  "min-w-0 flex-1 border-0 bg-transparent py-3 text-right text-base text-tinta outline-none placeholder:text-suave/70";
export const filaBoton =
  "flex min-h-[52px] w-full items-center px-4 text-left text-base font-medium disabled:opacity-50";

/** Interruptor accesible: una casilla real con el dibujo encima. */
export function Interruptor({
  name,
  etiqueta,
  defaultChecked,
  disabled,
}: {
  name: string;
  etiqueta: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`${fila} relative min-h-14 cursor-pointer`}>
      <span className="flex-1">{etiqueta}</span>
      <input
        type="checkbox"
        role="switch"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="peer absolute right-4 h-[31px] w-[51px] cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden
        className="flex h-[31px] w-[51px] items-center rounded-full bg-pausa-fondo p-0.5 transition-colors peer-checked:bg-turno peer-focus-visible:ring-2 peer-focus-visible:ring-accion peer-disabled:opacity-40 peer-checked:[&>span]:translate-x-5"
      >
        <span className="h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform" />
      </span>
    </label>
  );
}

/** Iniciales para el círculo de una persona: "Camila Rojas" → "CR". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? [partes[0][0], partes[partes.length - 1][0]] : [partes[0]?.[0] ?? "?"];
  return letras.join("").toUpperCase();
}
