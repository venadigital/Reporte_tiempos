// Vista pura de "Mi turno": recibe todo por propiedades y no sabe de servidor ni
// de cámara. Tiene UN solo trabajo: marcar. No muestra horas del día, de la semana
// ni turnos pasados.

import type { Accion } from "@/lib/turnos";
import { Aviso, IconoCamara, IconoReloj, botonPrincipal, botonSuave, sobretitulo, tituloGrande } from "@/components/ui";

/** Una marcación lista para pintar: "Entraste {prefijo}" + el número grande. */
export type Momento = { prefijo: string; hora: string; periodo: string };

export type VistaTurno =
  | { tipo: "sin_turno"; pendiente: string | null }
  | { tipo: "en_turno"; entrada: Momento }
  | { tipo: "en_almuerzo"; salio: Momento };

export type AvisoTurno = { ok: boolean; mensaje: string };

type Props = {
  vista: VistaTurno;
  nombre: string;
  fecha: string;
  saludo: string;
  aviso: AvisoTurno | null;
  ocupado: boolean;
  onAccion: (accion: Accion) => void;
};

const grande = "h-[58px] rounded-[18px] text-lg";
const nota = "text-center text-[13px] leading-[18px] text-suave";

function HoraGrande({ momento, className }: { momento: Momento; className: string }) {
  return (
    <p className={`text-[56px] leading-[60px] font-bold tracking-[-1.5px] tabular-nums ${className}`}>
      {momento.hora} <span className="text-[26px] font-semibold tracking-normal">{momento.periodo}</span>
    </p>
  );
}

export function PantallaTurno({ vista, nombre, fecha, saludo, aviso, ocupado, onAccion }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pt-8 pb-9">
      <header className="flex flex-col gap-1 px-1">
        <p className={sobretitulo}>{fecha}</p>
        <h1 className={tituloGrande}>
          {saludo}, {nombre}
        </h1>
      </header>

      <Aviso resultado={aviso} />

      {vista.tipo === "sin_turno" && (
        <>
          {vista.pendiente && (
            <p className="rounded-2xl bg-aviso-fondo px-4 py-3.5 text-[15px] leading-5 text-aviso-texto">
              Tu turno que empezó {vista.pendiente} quedó sin cerrar. Está pendiente de revisión: el
              administrador le pone la hora de salida. Ya puedes iniciar el turno de hoy.
            </p>
          )}

          <section className="flex flex-col gap-3.5 rounded-[22px] bg-white p-[22px]">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-suave">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#b4b4bc]" />
              Sin turno abierto
            </p>
            <p className="text-[28px] leading-[34px] font-bold tracking-[-0.4px]">Aún no has marcado hoy</p>
            <p className="text-base leading-[22px] text-suave">
              Marca al llegar, al salir a almorzar, al regresar y al irte.
            </p>
          </section>

          <section className="divide-y divide-linea rounded-[22px] bg-white px-[18px] py-1.5 text-[15px] leading-5">
            <p className="flex items-center gap-3.5 py-3">
              <IconoCamara className="h-[22px] w-[22px] shrink-0 text-accion" />
              La entrada y la salida llevan una foto de tu cara.
            </p>
            <p className="flex items-center gap-3.5 py-3">
              <IconoReloj className="h-[22px] w-[22px] shrink-0 text-accion" />
              La hora la registra el sistema, no tu celular.
            </p>
          </section>

          <div className="mt-auto flex flex-col gap-3">
            <button type="button" className={`${botonPrincipal} ${grande}`} disabled={ocupado} onClick={() => onAccion("entrada")}>
              <IconoCamara />
              Iniciar turno
            </button>
            <p className={nota}>Se abre la cámara para tu foto de entrada.</p>
          </div>
        </>
      )}

      {vista.tipo === "en_turno" && (
        <>
          <section className="flex flex-col gap-1.5 rounded-[22px] bg-turno-fondo p-[22px]">
            <p className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-turno-texto">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-turno" />
              Turno abierto
            </p>
            <p className="text-base leading-[22px] text-turno-tinta/85">Entraste {vista.entrada.prefijo}</p>
            <HoraGrande momento={vista.entrada} className="text-turno-tinta" />
          </section>

          <div className="mt-auto flex flex-col gap-3">
            <button type="button" className={`${botonPrincipal} ${grande}`} disabled={ocupado} onClick={() => onAccion("salida")}>
              <IconoCamara />
              Cerrar turno
            </button>
            <button type="button" className={`${botonSuave} ${grande}`} disabled={ocupado} onClick={() => onAccion("pausa_inicio")}>
              Salgo a almorzar
            </button>
            <p className={nota}>Al cerrar se abre la cámara para tu foto de salida.</p>
          </div>
        </>
      )}

      {vista.tipo === "en_almuerzo" && (
        <>
          {/* La tarjeta se apaga: es la señal de que ese tiempo no cuenta. */}
          <section className="flex flex-col gap-1.5 rounded-[22px] bg-pausa-fondo p-[22px] text-pausa-texto">
            <p className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
              <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <rect x="5" y="4" width="5" height="16" rx="1.5" />
                <rect x="14" y="4" width="5" height="16" rx="1.5" />
              </svg>
              Turno en pausa
            </p>
            <p className="text-base leading-[22px]">Saliste a almorzar {vista.salio.prefijo}</p>
            <HoraGrande momento={vista.salio} className="text-pausa-tinta" />
            <p className="mt-2 text-sm leading-5">Este tiempo no cuenta como trabajado.</p>
          </section>

          <div className="mt-auto flex flex-col gap-3">
            <button type="button" className={`${botonPrincipal} ${grande}`} disabled={ocupado} onClick={() => onAccion("pausa_fin")}>
              Regresé del almuerzo
            </button>
            <p className={`${nota} px-2`}>
              Primero marca tu regreso. No se puede cerrar el turno con el almuerzo abierto: no sabríamos
              cuánto descontar.
            </p>
          </div>
        </>
      )}
    </main>
  );
}

export function PantallaNoMarca() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-2 px-6 py-8">
      <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.4px]">Tu cuenta no registra turnos</h1>
      <p className="text-base leading-[22px] text-suave">Solo el personal que se paga por horas marca entrada y salida.</p>
    </main>
  );
}
