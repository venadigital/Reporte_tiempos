// Vista pura de "Mi turno": recibe todo por propiedades y no sabe de servidor ni
// de cámara. Tiene UN solo trabajo: marcar. No muestra horas del día, de la semana
// ni turnos pasados.

import type { Accion } from "@/lib/turnos";

export type VistaTurno =
  | { tipo: "sin_turno"; pendiente: string | null }
  | { tipo: "en_turno"; entrada: string }
  | { tipo: "en_almuerzo"; salio: string };

export type Aviso = { ok: boolean; mensaje: string };

type Props = {
  vista: VistaTurno;
  nombre: string;
  fecha: string;
  saludo: string;
  aviso: Aviso | null;
  ocupado: boolean;
  onAccion: (accion: Accion) => void;
};

function IconoCamara() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1-1.6A1 1 0 0 1 9.6 4h4.8a1 1 0 0 1 .9.4l1 1.6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

const botonPrincipal =
  "flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-tinta text-lg font-semibold text-white disabled:opacity-50";
const botonSecundario =
  "flex h-14 w-full items-center justify-center rounded-2xl border border-linea bg-white text-base font-semibold disabled:opacity-50";

export function PantallaTurno({ vista, nombre, fecha, saludo, aviso, ocupado, onAccion }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <header>
        <p className="text-sm text-suave first-letter:uppercase">{fecha}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {saludo}, {nombre}
        </h1>
      </header>

      {aviso && (
        <p
          role={aviso.ok ? "status" : "alert"}
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            aviso.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"
          }`}
        >
          {aviso.mensaje}
        </p>
      )}

      {vista.tipo === "sin_turno" && (
        <>
          {vista.pendiente && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Tu turno que empezó {vista.pendiente} quedó sin cerrar. Está pendiente de revisión: el
              administrador le pone la hora de salida. Ya puedes iniciar el turno de hoy.
            </p>
          )}
          <section className="flex flex-col gap-3">
            <button type="button" className={botonPrincipal} disabled={ocupado} onClick={() => onAccion("entrada")}>
              <IconoCamara />
              Iniciar turno
            </button>
            <p className="text-center text-sm text-suave">Se abre la cámara para tu foto de entrada.</p>
          </section>
          <p className="mt-auto rounded-2xl border border-linea px-4 py-3 text-sm text-suave">
            Marca al llegar, al salir a almorzar, al regresar y al irte.
          </p>
        </>
      )}

      {vista.tipo === "en_turno" && (
        <>
          <section className="rounded-3xl bg-turno-oscuro p-6 text-white">
            <p className="flex items-center gap-2 text-sm font-medium text-white/80">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-turno" />
              Turno abierto
            </p>
            <p className="mt-3 text-2xl font-semibold">Estás en turno</p>
            <p className="mt-1 text-white/80">Entraste {vista.entrada}</p>
          </section>
          <section className="flex flex-col gap-3">
            <button type="button" className={botonPrincipal} disabled={ocupado} onClick={() => onAccion("salida")}>
              <IconoCamara />
              Cerrar turno
            </button>
            <button type="button" className={botonSecundario} disabled={ocupado} onClick={() => onAccion("pausa_inicio")}>
              Salgo a almorzar
            </button>
            <p className="text-center text-sm text-suave">Al cerrar se abre la cámara para tu foto de salida.</p>
          </section>
        </>
      )}

      {vista.tipo === "en_almuerzo" && (
        <>
          {/* La tarjeta se apaga: es la señal de que ese tiempo no cuenta. */}
          <section className="rounded-3xl bg-neutral-200 p-6 text-neutral-700">
            <p className="flex items-center gap-2 text-sm font-medium text-neutral-500">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-neutral-400" />
              Turno en pausa
            </p>
            <p className="mt-3 text-2xl font-semibold">Estás almorzando</p>
            <p className="mt-1 text-neutral-500">Saliste {vista.salio}</p>
          </section>
          <section className="flex flex-col gap-3">
            <button type="button" className={botonPrincipal} disabled={ocupado} onClick={() => onAccion("pausa_fin")}>
              Regresé del almuerzo
            </button>
            <p className="text-center text-sm text-suave">
              Primero marca tu regreso. No se puede cerrar el turno con el almuerzo abierto: no sabríamos
              cuánto descontar.
            </p>
          </section>
        </>
      )}
    </main>
  );
}

export function PantallaNoMarca() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8">
      <h1 className="text-xl font-semibold">Tu cuenta no registra turnos</h1>
      <p className="mt-2 text-suave">Solo el personal que se paga por horas marca entrada y salida.</p>
    </main>
  );
}
