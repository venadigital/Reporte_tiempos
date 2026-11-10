import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { inicioPorRol, usaQuiosco } from "@/lib/auth/permisos";
import { cerrarSesion } from "@/app/login/actions";
import { tituloGrande } from "@/components/ui";

export const metadata: Metadata = { title: "Quiosco" };

// Vive fuera del marco de la aplicación a propósito: sin menú ni encabezado.
export default async function PaginaQuiosco() {
  const perfil = await exigirPerfil();
  if (!usaQuiosco(perfil.role)) redirect(inicioPorRol(perfil));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-2 px-6 py-12">
      <h1 className={tituloGrande}>Quiosco</h1>
      <p className="mb-4 text-base text-suave">
        {perfil.activo
          ? "La pantalla compartida está en construcción."
          : "Esta cuenta está desactivada. Habla con el administrador."}
      </p>
      <form action={cerrarSesion}>
        <button type="submit" className="min-h-11 text-[15px] font-medium text-accion">
          Salir
        </button>
      </form>
    </main>
  );
}
