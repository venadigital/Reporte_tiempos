"use client";

import { useActionState } from "react";
import { Aviso, Grupo, botonPrincipal, fila, type Resultado } from "@/components/ui";
import { horaEnPunto, minutosAHoras, type ConfiguracionEditable } from "@/lib/configuracion-reglas";
import { guardarConfiguracion } from "./actions";

const numero = "w-16 border-0 bg-transparent py-3 text-right text-base text-tinta tabular-nums outline-none";
const unidad = "w-16 text-suave";

function Campo({ etiqueta, nombre, valor, unidadTexto, paso = "1" }: { etiqueta: string; nombre: string; valor: string; unidadTexto: string; paso?: string }) {
  return (
    <label className={fila}>
      <span className="flex-1">{etiqueta}</span>
      <input name={nombre} type="number" inputMode="decimal" step={paso} min="0" required defaultValue={valor} className={numero} />
      <span aria-hidden className={unidad}>{unidadTexto}</span>
    </label>
  );
}

export function FormularioConfiguracion({ inicial }: { inicial: ConfiguracionEditable }) {
  const [resultado, accion, enviando] = useActionState<Resultado, FormData>(guardarConfiguracion, null);

  return (
    <form action={accion} className="flex flex-col gap-[22px]">
      <Grupo
        titulo="Jornada"
        nota="Lo que pase de la jornada diaria es extra. Las horas se calculan al consultar: cambiar estos dos valores cambia el reporte de todos los periodos, también los que ya se pagaron."
      >
        <Campo etiqueta="Jornada diaria" nombre="jornada" valor={minutosAHoras(inicial.jornada_diaria_min)} unidadTexto="horas" paso="0.5" />
        <label className={fila}>
          <span className="flex-1">Todo es extra desde</span>
          <select
            name="cierre"
            defaultValue={inicial.hora_cierre_operacion ?? ""}
            className="min-h-11 cursor-pointer border-0 bg-transparent text-right text-base text-suave outline-none"
          >
            <option value="">No aplica</option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {horaEnPunto(h)}
              </option>
            ))}
          </select>
        </label>
      </Grupo>

      <Grupo
        titulo="Marcación"
        nota="Pasado el máximo, un turno abierto ya no se puede cerrar desde el celular: queda sin cerrar para que lo corrija el administrador. El aviso sale cuando alguien trabaja ese tiempo seguido sin marcar almuerzo. Las fotos se borran solas al vencer; el turno se conserva."
      >
        <Campo etiqueta="Máximo de un turno" nombre="turno_max" valor={String(inicial.turno_max_horas)} unidadTexto="horas" />
        <Campo etiqueta="Aviso sin almuerzo" nombre="sin_almuerzo" valor={minutosAHoras(inicial.aviso_sin_almuerzo_min)} unidadTexto="horas" paso="0.5" />
        <Campo etiqueta="Guardar las fotos" nombre="fotos" valor={String(inicial.fotos_dias)} unidadTexto="días" />
      </Grupo>

      <Grupo titulo="PIN del quiosco" nota="Al llegar a ese número de intentos fallidos seguidos, el PIN de esa persona se bloquea ese tiempo.">
        <Campo etiqueta="Intentos" nombre="pin_intentos" valor={String(inicial.pin_intentos_max)} unidadTexto="intentos" />
        <Campo etiqueta="Bloqueo" nombre="pin_bloqueo" valor={String(inicial.pin_bloqueo_min)} unidadTexto="minutos" />
      </Grupo>

      <Aviso resultado={resultado} />
      <button type="submit" disabled={enviando} className={botonPrincipal}>
        {enviando ? "Guardando…" : "Guardar configuración"}
      </button>
    </form>
  );
}
