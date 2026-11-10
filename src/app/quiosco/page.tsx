import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { inicioPorRol, usaQuiosco } from "@/lib/auth/permisos";
import { cerrarSesion } from "@/app/login/actions";

export const metadata: Metadata = { title: "Quiosco" };

// Vive fuera del marco de la aplicación a propósito: sin menú ni encabezado.
export default async function PaginaQuiosco() {
  const perfil = await exigirPerfil();
  if (!usaQuiosco(perfil.role)) redirect(inicioPorRol(perfil));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Quiosco</h1>
      <p className="mt-2 mb-6 text-suave">
        {perfil.activo
          ? "La pantalla compartida está en construcción."
          : "Esta cuenta está desactivada. Habla con el administrador."}
      </p>
      <form action={cerrarSesion}>
        <button type="submit" className="text-sm font-medium text-suave underline">
          Salir
        </button>
      </form>
    </main>
  );
}
