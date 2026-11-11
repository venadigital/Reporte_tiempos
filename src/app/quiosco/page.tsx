import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { inicioPorRol, usaQuiosco } from "@/lib/auth/permisos";
import { cerrarSesion } from "@/app/login/actions";
import { crearCliente } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { aVista, type PersonaQuiosco } from "@/lib/quiosco";
import { textoFoto } from "@/lib/turnos";
import { Quiosco } from "./quiosco";

export const metadata: Metadata = { title: "Quiosco" };

// Vive fuera del marco de la aplicación a propósito: sin menú ni encabezado.
// Es un aparato de una sola función.
export default async function PaginaQuiosco() {
  const perfil = await exigirPerfil();
  if (!usaQuiosco(perfil.role)) redirect(inicioPorRol(perfil));

  const salir = (
    <form action={cerrarSesion} className="flex justify-center pb-4">
      <button type="submit" className="min-h-11 px-3 text-sm text-suave">
        Cerrar la sesión de este equipo
      </button>
    </form>
  );

  if (!perfil.activo) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-2 px-6 py-12 text-center">
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.4px]">Esta cuenta está desactivada</h1>
        <p className="mb-4 text-base text-suave">Habla con el administrador.</p>
        {salir}
      </main>
    );
  }

  const [config, supabase] = await Promise.all([obtenerConfiguracion(), crearCliente()]);
  const { data, error } = await supabase.rpc("quiosco_estado");

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-2 px-6 py-12 text-center">
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.4px]">No se pudo cargar la lista</h1>
        <p className="mb-4 text-base text-suave">Revisa la conexión del equipo y recarga la página.</p>
        {salir}
      </main>
    );
  }

  const ahora = new Date();
  const personas = ((data ?? []) as PersonaQuiosco[]).map((p) => aVista(p, ahora, config.zona_horaria));

  return (
    <>
      <Quiosco personas={personas} zona={config.zona_horaria} textoFoto={textoFoto(config.fotos_dias)} />
      {salir}
    </>
  );
}
