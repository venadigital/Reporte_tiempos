"use client";

// Vistas puras del quiosco: reciben todo por propiedades. El orden y los
// temporizadores viven en quiosco.tsx.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { fechaLarga, horaPartida } from "@/lib/fecha";
import { llevaFoto, type Accion } from "@/lib/turnos";
import { FRASE_ACCION, PIN_LARGO, TITULO_ACCION, type EstadoPersona, type PersonaVista } from "@/lib/quiosco";
import { IconoCamara, botonSuave, iniciales, sobretitulo } from "@/components/ui";

const marco = "mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-6 py-10 lg:px-16 lg:py-14";

const TONO: Record<EstadoPersona, { circulo: string; texto: string }> = {
  en_turno: { circulo: "bg-turno-fondo text-turno-texto", texto: "text-turno-texto" },
  almorzando: { circulo: "bg-aviso-fondo text-aviso-texto", texto: "text-aviso-texto" },
  sin_turno: { circulo: "bg-relleno text-pausa-tinta", texto: "text-suave" },
};

function IconoPausa({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <rect x="5" y="4" width="5" height="16" rx="1.5" />
      <rect x="14" y="4" width="5" height="16" rx="1.5" />
    </svg>
  );
}

// ── Reloj ────────────────────────────────────────────────────────────────────
// Arranca vacío y se llena en el navegador: el servidor y el navegador no
// pintarían el mismo segundo, y la pantalla dejaría de hidratar.
function cadaSegundo(avisar: () => void) {
  const id = setInterval(avisar, 1000);
  return () => clearInterval(id);
}

export function Reloj({ zona }: { zona: string }) {
  const marca = useSyncExternalStore(
    cadaSegundo,
    () => {
      const ahora = Date.now();
      const { hora, periodo } = horaPartida(ahora, zona);
      return `${hora}|${periodo}|${fechaLarga(ahora, zona)}`;
    },
    () => "",
  );
  const [hora = "", periodo = "", fecha = ""] = marca.split("|");

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="flex flex-col gap-1.5">
        <p className={`${sobretitulo} min-h-[18px] text-[15px] tracking-[0.4px]`}>{fecha}</p>
        <h1 className="text-[44px] leading-[50px] font-bold tracking-[-0.8px]">Marca tu turno</h1>
      </div>
      <p aria-label={hora ? `Son las ${hora} ${periodo}` : undefined} className="min-h-[76px] text-[76px] leading-[76px] font-bold tracking-[-2.5px] tabular-nums">
        {hora} <span className="text-3xl font-semibold tracking-normal text-suave">{periodo}</span>
      </p>
    </header>
  );
}

// ── 1. Lista ─────────────────────────────────────────────────────────────────
export function ListaPersonas({
  personas,
  zona,
  onElegir,
}: {
  personas: PersonaVista[];
  zona: string;
  onElegir: (persona: PersonaVista) => void;
}) {
  return (
    <main className={`${marco} gap-10`}>
      <Reloj zona={zona} />

      {personas.length === 0 ? (
        // Sin nadie con turnos activados lo dice; no sale en blanco.
        <p className="rounded-3xl bg-white p-8 text-center text-lg text-suave">
          Todavía no hay personas que registren turnos. El administrador las activa desde Empleados.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((p) => {
            const tono = TONO[p.estado];
            const contenido = (
              <>
                <span
                  aria-hidden
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[22px] font-bold ${
                    p.tienePin ? tono.circulo : "bg-[#dcdce2] text-pausa-texto"
                  }`}
                >
                  {iniciales(p.nombre)}
                </span>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[22px] leading-7 font-semibold">{p.nombre}</span>
                  {p.tienePin ? (
                    <span className={`flex items-center gap-2 text-base font-medium ${tono.texto}`}>
                      {p.estado === "almorzando" ? (
                        <IconoPausa />
                      ) : (
                        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${p.estado === "en_turno" ? "bg-turno" : "bg-[#b4b4bc]"}`} />
                      )}
                      {p.textoEstado}
                    </span>
                  ) : (
                    <span className="text-base leading-[21px]">Sin PIN · marca desde tu celular</span>
                  )}
                </span>
              </>
            );
            const caja = "flex min-h-[124px] w-full items-center gap-[18px] rounded-3xl p-[22px] text-left";
            return (
              <li key={p.id}>
                {p.tienePin ? (
                  <button type="button" onClick={() => onElegir(p)} className={`${caja} bg-white transition-transform active:scale-[0.98]`}>
                    {contenido}
                  </button>
                ) : (
                  <div className={`${caja} bg-[#e9e9ee] text-pausa-texto`}>{contenido}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-auto text-center text-xl font-medium text-suave">Toca tu nombre para marcar</p>
    </main>
  );
}

function Saludo({ persona, children }: { persona: PersonaVista; children: React.ReactNode }) {
  return (
    <>
      <span aria-hidden className={`flex h-24 w-24 items-center justify-center rounded-full text-[34px] font-bold ${TONO[persona.estado].circulo}`}>
        {iniciales(persona.nombre)}
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-5xl leading-[54px] font-bold tracking-[-1px]">Hola, {persona.primerNombre}</h1>
        <p className="text-[22px] leading-[30px] text-suave">{children}</p>
      </div>
    </>
  );
}

// ── 2. Acción (solo si hay más de una) ───────────────────────────────────────
export function ElegirAccion({
  persona,
  onAccion,
  onCancelar,
}: {
  persona: PersonaVista;
  onAccion: (accion: Accion) => void;
  onCancelar: () => void;
}) {
  return (
    <main className={`${marco} items-start justify-center gap-7`}>
      <Saludo persona={persona}>¿Qué vas a marcar?</Saludo>
      <div className="flex w-full max-w-xl flex-col gap-4">
        {persona.acciones.map((accion, i) => (
          <button
            key={accion}
            type="button"
            onClick={() => onAccion(accion)}
            className={`flex h-[84px] items-center justify-center gap-3 rounded-3xl text-2xl font-semibold ${
              i === 0 ? "bg-accion text-white" : "bg-accion-suave text-accion"
            }`}
          >
            {llevaFoto(accion) && <IconoCamara className="h-7 w-7" />}
            {TITULO_ACCION[accion]}
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancelar} className={`${botonSuave} h-[52px] bg-transparent px-2 text-lg`}>
        Cancelar
      </button>
    </main>
  );
}

// ── 3. PIN ───────────────────────────────────────────────────────────────────
const tecla = "flex h-[88px] items-center justify-center rounded-full text-[40px] font-medium disabled:opacity-40 lg:h-[108px]";

export function TecladoPin({
  persona,
  accion,
  pin,
  error,
  ocupado,
  onDigito,
  onBorrar,
  onCancelar,
}: {
  persona: PersonaVista;
  accion: Accion;
  pin: string;
  error: string | null;
  ocupado: boolean;
  onDigito: (digito: string) => void;
  onBorrar: () => void;
  onCancelar: () => void;
}) {
  // En un computador también se puede escribir con el teclado físico.
  const caja = useRef<HTMLElement | null>(null);
  useEffect(() => caja.current?.focus(), []);

  function alTeclear(e: React.KeyboardEvent) {
    if (/^[0-9]$/.test(e.key)) onDigito(e.key);
    else if (e.key === "Backspace") onBorrar();
    else if (e.key === "Escape") onCancelar();
  }

  return (
    <main
      ref={caja}
      tabIndex={-1}
      onKeyDown={alTeclear}
      className={`${marco} items-center justify-center gap-12 outline-none lg:flex-row lg:justify-between lg:gap-16`}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start gap-7">
        <Saludo persona={persona}>
          Vas a <strong className="font-semibold text-tinta">{FRASE_ACCION[accion]}</strong>. Escribe tu PIN de {PIN_LARGO}{" "}
          dígitos.
        </Saludo>

        <div role="img" aria-label={`${pin.length} de ${PIN_LARGO} dígitos escritos`} className="flex gap-5 py-2">
          {Array.from({ length: PIN_LARGO }, (_, i) => (
            <span
              key={i}
              className={`h-[22px] w-[22px] rounded-full ${i < pin.length ? "bg-tinta" : "border-2 border-[#8e8e96]"}`}
            />
          ))}
        </div>

        <p role={error ? "alert" : undefined} aria-live="polite" className={`min-h-[22px] text-base leading-[22px] ${error ? "font-semibold text-error-texto" : "text-suave"}`}>
          {error ??
            (ocupado
              ? "Verificando…"
              : llevaFoto(accion)
                ? `Después se abre la cámara para tu foto de ${accion === "entrada" ? "entrada" : "salida"}.`
                : "El almuerzo no lleva foto.")}
        </p>

        <button type="button" onClick={onCancelar} className={`${botonSuave} h-[52px] px-6 text-lg`}>
          Cancelar
        </button>
      </div>

      <div className="grid w-full max-w-[372px] shrink-0 grid-cols-3 gap-4 lg:gap-6">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" disabled={ocupado} onClick={() => onDigito(d)} className={`${tecla} bg-white active:bg-relleno`}>
            {d}
          </button>
        ))}
        <span aria-hidden />
        <button type="button" disabled={ocupado} onClick={() => onDigito("0")} className={`${tecla} bg-white active:bg-relleno`}>
          0
        </button>
        <button type="button" disabled={ocupado || pin.length === 0} onClick={onBorrar} aria-label="Borrar el último dígito" className={tecla}>
          <svg aria-hidden viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5h9.5A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5H9l-6-7z" />
            <path d="M12 9.5l5 5M17 9.5l-5 5" />
          </svg>
        </button>
      </div>
    </main>
  );
}

// ── 5. Listo ─────────────────────────────────────────────────────────────────
export function Listo({ persona, mensaje }: { persona: PersonaVista; mensaje: string }) {
  return (
    <main className={`${marco} items-center justify-center gap-6 text-center`}>
      <span aria-hidden className="flex h-28 w-28 items-center justify-center rounded-full bg-turno-fondo text-turno-texto">
        <svg viewBox="0 0 24 24" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <div role="status" className="flex flex-col gap-2">
        <h1 className="text-5xl leading-[54px] font-bold tracking-[-1px]">Listo, {persona.primerNombre}</h1>
        <p className="text-[26px] leading-[34px]">{mensaje}</p>
      </div>
      <p className="text-lg text-suave">Volviendo a la lista…</p>
    </main>
  );
}

export function Fallo({ mensaje, onVolver }: { mensaje: string; onVolver: () => void }) {
  return (
    <main className={`${marco} items-center justify-center gap-6 text-center`}>
      <div role="alert" className="flex max-w-xl flex-col gap-2">
        <h1 className="text-[40px] leading-[46px] font-bold tracking-[-0.8px]">No se pudo marcar</h1>
        <p className="text-[22px] leading-[30px] text-suave">{mensaje}</p>
      </div>
      <button type="button" onClick={onVolver} className="flex h-16 items-center justify-center rounded-3xl bg-accion px-8 text-xl font-semibold text-white">
        Volver a la lista
      </button>
    </main>
  );
}
