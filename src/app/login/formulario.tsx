"use client";

import { useActionState } from "react";
import { iniciarSesion, type EstadoLogin } from "./actions";

const inicial: EstadoLogin = { error: null };

export function FormularioLogin() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, inicial);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Correo
        <input
          name="correo"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          className="h-12 rounded-xl border border-linea bg-white px-4 text-base font-normal outline-none focus:border-tinta"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Contraseña
        <input
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-xl border border-linea bg-white px-4 text-base font-normal outline-none focus:border-tinta"
        />
      </label>

      {estado.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-2 h-12 rounded-xl bg-tinta text-base font-semibold text-white disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
