"use client";

import { useActionState, useState } from "react";
import { CLAVE_MIN, ROLES, estadoPin, type Empleado } from "@/lib/empleados";
import type { Rol } from "@/lib/auth/permisos";
import { Aviso, Grupo, Interruptor, botonPrincipal, campoFila, fila, filaBoton } from "@/components/ui";
import { asignarPin, borrarPin, cambiarClave, crearEmpleado, guardarEmpleado } from "./actions";

/** Nombre, cargo, rol e interruptores: los comparten el alta y la ficha. */
function CamposDatos({ inicial, conEstado }: { inicial?: Empleado; conEstado: boolean }) {
  const [rol, setRol] = useState<Rol>(inicial?.role ?? "empleado");
  const esQuiosco = rol === "quiosco";

  return (
    <>
      <Grupo titulo="Datos" nota={ROLES.find((r) => r.valor === rol)?.descripcion}>
        <label className={fila}>
          <span className="w-20">Nombre</span>
          <input name="nombre" required defaultValue={inicial?.nombre} autoComplete="off" className={campoFila} />
        </label>
        <label className={fila}>
          <span className="w-20">Cargo</span>
          <input
            name="cargo"
            defaultValue={inicial?.cargo ?? ""}
            placeholder="Recepción, vigilancia…"
            autoComplete="off"
            className={campoFila}
          />
        </label>
        <label className={fila}>
          <span className="flex-1">Rol</span>
          <select
            name="role"
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            className="min-h-11 cursor-pointer border-0 bg-transparent text-right text-base text-suave outline-none"
          >
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>
      </Grupo>

      <Grupo
        nota={
          esQuiosco
            ? "El quiosco es un equipo: no marca turnos."
            : "Quien registra turnos marca entrada y salida y aparece en el reporte de horas. Es una condición del contrato, no del rol." +
              (conEstado ? " Al desactivar la cuenta deja de marcar; sus turnos se conservan." : "")
        }
      >
        <Interruptor
          name="marca_turno"
          etiqueta="Registra turnos"
          defaultChecked={inicial?.marca_turno ?? false}
          disabled={esQuiosco}
        />
        {conEstado && <Interruptor name="activo" etiqueta="Cuenta activa" defaultChecked={inicial?.activo ?? true} />}
      </Grupo>
    </>
  );
}

export function FormularioNuevo() {
  const [resultado, accion, enviando] = useActionState(crearEmpleado, null);
  return (
    <form action={accion} className="flex flex-col gap-[22px]">
      <CamposDatos conEstado={false} />
      <Grupo titulo="Acceso" nota={`Con este correo entra a la aplicación. La contraseña debe tener al menos ${CLAVE_MIN} caracteres; entrégasela a la persona.`}>
        <label className={fila}>
          <span className="w-20">Correo</span>
          <input name="correo" type="email" required autoComplete="off" inputMode="email" className={campoFila} />
        </label>
        <label className={fila}>
          <span className="whitespace-nowrap">Contraseña inicial</span>
          <input name="clave" type="password" required minLength={CLAVE_MIN} autoComplete="new-password" className={campoFila} />
        </label>
      </Grupo>
      <Aviso resultado={resultado} />
      <button type="submit" disabled={enviando} className={botonPrincipal}>
        {enviando ? "Creando…" : "Crear empleado"}
      </button>
    </form>
  );
}

export function FormularioDatos({ empleado }: { empleado: Empleado }) {
  const [resultado, accion, enviando] = useActionState(guardarEmpleado, null);
  return (
    <form action={accion} className="flex flex-col gap-[22px]">
      <input type="hidden" name="id" value={empleado.id} />
      <CamposDatos inicial={empleado} conEstado />
      <Aviso resultado={resultado} />
      <button type="submit" disabled={enviando} className={botonPrincipal}>
        {enviando ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export function FormularioPin({ empleado }: { empleado: Empleado }) {
  const [asignado, asignar, asignando] = useActionState(asignarPin, null);
  const [borrado, borrar, borrando] = useActionState(borrarPin, null);
  const tono = !empleado.tiene_pin ? "text-suave" : empleado.pin_bloqueado ? "text-aviso-texto" : "text-turno-texto";

  return (
    <div className="flex flex-col gap-3">
      <Grupo
        titulo="PIN del quiosco"
        nota="Sirve solo para el computador compartido. Se guarda cifrado y no se puede volver a ver: si se olvida, asigna otro. Sin PIN la persona sigue marcando desde su celular."
      >
        <p className={fila}>
          <span className="flex-1">Estado</span>
          <span className={`font-medium ${tono}`}>{estadoPin(empleado)}</span>
        </p>
        <form action={asignar} className="divide-y divide-linea">
          <input type="hidden" name="id" value={empleado.id} />
          <label className={fila}>
            <span className="flex-1">{empleado.tiene_pin ? "Asignar otro PIN" : "PIN de 4 dígitos"}</span>
            <input
              name="pin"
              required
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="off"
              placeholder="0000"
              className="w-24 border-0 bg-transparent py-3 text-right text-lg tracking-[6px] text-tinta outline-none placeholder:text-suave/60"
            />
          </label>
          <button type="submit" disabled={asignando} className={`${filaBoton} text-accion`}>
            {asignando ? "Guardando…" : empleado.tiene_pin ? "Guardar el nuevo PIN" : "Asignar PIN"}
          </button>
        </form>
        {empleado.tiene_pin && (
          <form action={borrar}>
            <input type="hidden" name="id" value={empleado.id} />
            <button type="submit" disabled={borrando} className={`${filaBoton} text-error-texto`}>
              {borrando ? "Quitando…" : "Quitar PIN"}
            </button>
          </form>
        )}
      </Grupo>
      <Aviso resultado={asignado} />
      <Aviso resultado={borrado} />
    </div>
  );
}

export function FormularioClave({ empleado }: { empleado: Empleado }) {
  const [resultado, accion, enviando] = useActionState(cambiarClave, null);
  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={empleado.id} />
      <Grupo titulo="Acceso" nota="Si la persona olvidó su contraseña, asígnale una nueva y entrégasela.">
        <label className={fila}>
          <span className="whitespace-nowrap">Nueva contraseña</span>
          <input
            name="clave"
            type="password"
            required
            minLength={CLAVE_MIN}
            autoComplete="new-password"
            placeholder={`Mínimo ${CLAVE_MIN}`}
            className={campoFila}
          />
        </label>
        <button type="submit" disabled={enviando} className={`${filaBoton} text-accion`}>
          {enviando ? "Cambiando…" : "Cambiar contraseña"}
        </button>
      </Grupo>
      <Aviso resultado={resultado} />
    </form>
  );
}
