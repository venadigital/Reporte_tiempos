import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerPerfil } from "@/lib/auth/sesion";
import { inicioPorRol } from "@/lib/auth/permisos";
import { IconoReloj } from "@/components/ui";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin() {
  const perfil = await obtenerPerfil();
  if (perfil?.activo) redirect(inicioPorRol(perfil));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8 px-6 pt-20 pb-10">
      <div className="flex flex-col items-center gap-5 pt-6">
        <div className="flex h-[84px] w-[84px] items-center justify-center rounded-[22px] bg-accion text-white shadow-[0_10px_24px_rgba(10,95,217,0.25)]">
          <IconoReloj className="h-11 w-11" />
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.4px]">Reporte de tiempos</h1>
          <p className="text-base leading-[22px] text-suave">Entra con el correo y la contraseña que te entregaron.</p>
        </div>
      </div>

      <FormularioLogin />

      <p className="mt-auto text-center text-[13px] leading-[18px] text-suave">
        ¿Olvidaste tu contraseña? Pídele una nueva al administrador.
      </p>
    </main>
  );
}
