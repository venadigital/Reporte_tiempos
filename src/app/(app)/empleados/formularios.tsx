"use client";

import { useActionState, useState } from "react";
import { CLAVE_MIN, ROLES, type Empleado } from "@/lib/empleados";
import type { Rol } from "@/lib/auth/permisos";
import { asignarPin, borrarPin, cambiarClave, crearEmpleado, guardarEmpleado, type Resultado } from "./actions";

const campo =
  "h-12 w-full rounded-xl border border-linea bg-white px-4 text-base outline-none focus:border-tinta disabled:bg-neutral-100";
const etiqueta = "flex flex-col gap-1.5 text-sm font-medium";
const boton = "h-12 rounded-xl bg-tinta px-5 text-base font-semibold text-white disabled:opacity-60";
const botonSuave = "h-12 rounded-xl border border-linea bg-white px-5 text-base font-medium disabled:opacity-60";

export function Aviso({ resultado }: { resultado: Resultado }) {
  if (!resultado) return null;
  return (
    <p
      role={resultado.ok ? "status" : "alert"}
      className={`rounded-xl px-4 py-3 text-sm ${
        resultado.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"
      }`}
    >
      {resultado.mensaje}
    </p>
  );
}

/** Nombre, cargo, rol e interruptor: los comparten el alta y la ficha. */
function CamposDatos({ inicial, conEstado }: { inicial?: Empleado; conEstado: boolean }) {
  const [rol, setRol] = useState<Rol>(inicial?.role ?? "empleado");
  const esQuiosco = rol === "quiosco";

  return (
    <>
      <label className={etiqueta}>
        Nombre completo
        <input name="nombre" required defaultValue={inicial?.nombre} autoComplete="off" className={campo} />
      </label>
      <label className={etiqueta}>
        Cargo
        <input
          name="cargo"
          defaultValue={inicial?.cargo ?? ""}
          placeholder="Recepción, vigilancia…"
          autoComplete="off"
          className={campo}
        />
        <span className="font-normal text-suave">Sale en el reporte de horas como la actividad que desarrolla.</span>
      </label>
      <label className={etiqueta}>
        Rol
        <select name="role" value={rol} onChange={(e) => setRol(e.target.value as Rol)} className={campo}>
          {ROLES.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.nombre}
            </option>
          ))}
        </select>
        <span className="font-normal text-suave">{ROLES.find((r) => r.valor === rol)?.descripcion}</span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-linea bg-white p-4">
        <input
          type="checkbox"
          name="marca_turno"
          defaultChecked={inicial?.marca_turno ?? false}
          disabled={esQuiosco}
          className="mt-1 h-5 w-5"
        />
        <span>
          <span className="block font-medium">Registra turnos</span>
          <span className="block text-sm text-suave">
            {esQuiosco
              ? "El quiosco es un equipo: no marca turnos."
              : "Marca entrada y salida, y aparece en el reporte de horas. Es una condición del contrato, no del rol."}
          </span>
        </span>
      </label>

      {conEstado && (
        <label className="flex items-start gap-3 rounded-xl border border-linea bg-white p-4">
          <input type="checkbox" name="activo" defaultChecked={inicial?.activo ?? true} className="mt-1 h-5 w-5" />
          <span>
            <span className="block font-medium">Cuenta activa</span>
            <span className="block text-sm text-suave">
              Al desactivarla deja de marcar y de ver cualquier pantalla. Sus turnos se conservan.
            </span>
          </span>
        </label>
      )}
    </>
  );
}

export function FormularioNuevo() {
  const [resultado, accion, enviando] = useActionState(crearEmpleado, null);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <CamposDatos conEstado={false} />
      <label className={etiqueta}>
        Correo
        <input name="correo" type="email" required autoComplete="off" inputMode="email" className={campo} />
        <span className="font-normal text-suave">Con este correo entra a la aplicación.</span>
      </label>
      <label className={etiqueta}>
        Contraseña inicial
        <input name="clave" type="password" required minLength={CLAVE_MIN} autoComplete="new-password" className={campo} />
        <span className="font-normal text-suave">Mínimo {CLAVE_MIN} caracteres. Entrégasela a la persona.</span>
      </label>
      <Aviso resultado={resultado} />
      <button type="submit" disabled={enviando} className={boton}>
        {enviando ? "Creando…" : "Crear empleado"}
      </button>
    </form>
  );
}

export function FormularioDatos({ empleado }: { empleado: Empleado }) {
  const [resultado, accion, enviando] = useActionState(guardarEmpleado, null);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={empleado.id} />
      <CamposDatos inicial={empleado} conEstado />
      <Aviso resultado={resultado} />
      <button type="submit" disabled={enviando} className={boton}>
        {enviando ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export function FormularioPin({ empleado }: { empleado: Empleado }) {
  const [asignado, asignar, asignando] = useActionState(asignarPin, null);
  const [borrado, borrar, borrando] = useActionState(borrarPin, null);
  return (
    <div className="flex flex-col gap-4">
      <form action={asignar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="id" value={empleado.id} />
        <label className={`${etiqueta} flex-1`}>
          {empleado.tiene_pin ? "Asignar otro PIN" : "PIN de 4 dígitos"}
          <input
            name="pin"
            required
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="off"
            placeholder="0000"
            className={`${campo} font-mono tracking-[0.4em]`}
          />
        </label>
        <button type="submit" disabled={asignando} className={boton}>
          {asignando ? "Guardando…" : "Asignar PIN"}
        </button>
      </form>
      <Aviso resultado={asignado} />

      {empleado.tiene_pin && (
        <form action={borrar}>
          <input type="hidden" name="id" value={empleado.id} />
          <button type="submit" disabled={borrando} className={botonSuave}>
            {borrando ? "Quitando…" : "Quitar PIN"}
          </button>
        </form>
      )}
      <Aviso resultado={borrado} />
    </div>
  );
}

export function FormularioClave({ empleado }: { empleado: Empleado }) {
  const [resultado, accion, enviando] = useActionState(cambiarClave, null);
  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={empleado.id} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className={`${etiqueta} flex-1`}>
          Nueva contraseña
          <input name="clave" type="password" required minLength={CLAVE_MIN} autoComplete="new-password" className={campo} />
        </label>
        <button type="submit" disabled={enviando} className={botonSuave}>
          {enviando ? "Cambiando…" : "Cambiar contraseña"}
        </button>
      </div>
      <Aviso resultado={resultado} />
    </form>
  );
}
