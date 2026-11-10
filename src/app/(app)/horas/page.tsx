import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { inicioPorRol, veReporte } from "@/lib/auth/permisos";
import { tituloGrande } from "@/components/ui";

export const metadata: Metadata = { title: "Horas del personal" };

export default async function PaginaHoras() {
  const perfil = await exigirPerfil();
  if (!veReporte(perfil.role)) redirect(inicioPorRol(perfil));

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-1 px-4 py-9 sm:px-6">
      <h1 className={tituloGrande}>Horas del personal</h1>
      <p className="text-base text-suave">El reporte está en construcción.</p>
    </main>
  );
}
