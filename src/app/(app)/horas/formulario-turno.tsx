"use client";

import { useActionState } from "react";
import { Aviso, Grupo, botonPrincipal, campoFila, fila, type Resultado } from "@/components/ui";
import type { Periodo } from "@/lib/periodo";
import { agregarTurno, corregirTurno, eliminarTurno } from "./actions";

const campoHora = `${campoFila} min-h-11 min-w-[13rem] [color-scheme:light]`;
const filaHora = `${fila} flex-wrap gap-y-0 py-1`;

type Inicial = { entrada: string; salida: string; pausas: { inicio: string; fin: string }[] };

function Ocultos({ perfilId, turnoId, periodo }: { perfilId: string; turnoId?: number; periodo: Periodo }) {
  return (
    <>
      <input type="hidden" name="perfil" value={perfilId} />
      {turnoId !== undefined && <input type="hidden" name="turno" value={turnoId} />}
      <input type="hidden" name="periodo" value={periodo.tipo} />
      <input type="hidden" name="ym" value={periodo.ym} />
    </>
  );
}

/** Entrada, salida, almuerzo y motivo. Sirve para corregir un turno y para agregar uno. */
export function FormularioTurno({
  perfilId,
  turnoId,
  periodo,
  inicial,
  ahora,
}: {
  perfilId: string;
  turnoId?: number; // sin él, agrega un turno nuevo
  periodo: Periodo;
  inicial: Inicial;
  ahora: string; // tope para los campos: no se corrige hacia el futuro
}) {
  const [resultado, accion, enviando] = useActionState<Resultado, FormData>(
    turnoId === undefined ? agregarTurno : corregirTurno,
    null,
  );
  // Los almuerzos que ya tiene, más un renglón vacío para agregar otro
  const pausas = [...inicial.pausas, { inicio: "", fin: "" }];

  return (
    <form action={accion} className="flex flex-col gap-[22px]">
      <Ocultos perfilId={perfilId} turnoId={turnoId} periodo={periodo} />

      <Grupo titulo="Turno" nota="Si la salida fue al día siguiente, cambia también la fecha.">
        <label className={filaHora}>
          <span className="w-20">Entrada</span>
          <input name="entrada" type="datetime-local" required max={ahora} defaultValue={inicial.entrada} className={campoHora} />
        </label>
        <label className={filaHora}>
          <span className="w-20">Salida</span>
          <input name="salida" type="datetime-local" required max={ahora} defaultValue={inicial.salida} className={campoHora} />
        </label>
      </Grupo>

      <Grupo titulo="Almuerzo" nota="Déjalo vacío si no hubo almuerzo. Debe caer dentro del turno; ese tiempo no cuenta como trabajado.">
        {pausas.flatMap((p, i) => [
          <label key={`i${i}`} className={filaHora}>
            <span className="w-28">{i === 0 ? "Salió" : `Salió (${i + 1})`}</span>
            <input name="pausa_inicio" type="datetime-local" max={ahora} defaultValue={p.inicio} className={campoHora} />
          </label>,
          <label key={`f${i}`} className={filaHora}>
            <span className="w-28">{i === 0 ? "Regresó" : `Regresó (${i + 1})`}</span>
            <input name="pausa_fin" type="datetime-local" max={ahora} defaultValue={p.fin} className={campoHora} />
          </label>,
        ])}
      </Grupo>

      <Grupo titulo="Motivo" nota="Obligatorio. Queda en la bitácora junto con quién hizo el cambio y qué decían las horas antes y después.">
        <label className={fila}>
          <span className="sr-only">Motivo de la corrección</span>
          <input name="motivo" required maxLength={300} placeholder="Por ejemplo: se le olvidó marcar la salida" autoComplete="off" className={`${campoFila} text-left`} />
        </label>
      </Grupo>

      <Aviso resultado={resultado} />
      <button type="submit" disabled={enviando} className={botonPrincipal}>
        {enviando ? "Guardando…" : turnoId === undefined ? "Agregar turno" : "Guardar corrección"}
      </button>
    </form>
  );
}

/** Borrar una marcación hecha por error: pide su propio motivo. */
export function FormularioBorrar({ perfilId, turnoId, periodo }: { perfilId: string; turnoId: number; periodo: Periodo }) {
  const [resultado, accion, enviando] = useActionState<Resultado, FormData>(eliminarTurno, null);
  return (
    <form action={accion} className="flex flex-col gap-3">
      <Ocultos perfilId={perfilId} turnoId={turnoId} periodo={periodo} />
      <Grupo titulo="Borrar este turno" nota="Solo para una marcación hecha por error. Se borran también su almuerzo y sus fotos; el borrado queda en la bitácora.">
        <label className={fila}>
          <span className="sr-only">Motivo para borrar el turno</span>
          <input name="motivo" required maxLength={300} placeholder="Motivo para borrarlo" autoComplete="off" className={`${campoFila} text-left`} />
        </label>
        <button type="submit" disabled={enviando} className="flex min-h-[52px] w-full items-center px-4 text-left text-base font-medium text-error-texto disabled:opacity-50">
          {enviando ? "Borrando…" : "Borrar turno"}
        </button>
      </Grupo>
      <Aviso resultado={resultado} />
    </form>
  );
}
