"use client";

import { useActionState } from "react";
import { Aviso, botonPrincipal, campoFila, fila } from "@/components/ui";
import { iniciarSesion, type EstadoLogin } from "./actions";

const inicial: EstadoLogin = { error: null };

export function FormularioLogin() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, inicial);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="divide-y divide-linea overflow-hidden rounded-2xl bg-white">
        <label className={`${fila} min-h-14`}>
          <span className="w-24 font-medium">Correo</span>
          <input
            name="correo"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            className={`${campoFila} text-left`}
          />
        </label>
        <label className={`${fila} min-h-14`}>
          <span className="w-24 font-medium">Contraseña</span>
          <input
            name="clave"
            type="password"
            autoComplete="current-password"
            required
            className={`${campoFila} text-left`}
          />
        </label>
      </div>

      <Aviso resultado={estado.error ? { ok: false, mensaje: estado.error } : null} />

      <button type="submit" disabled={enviando} className={`${botonPrincipal} h-14`}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
