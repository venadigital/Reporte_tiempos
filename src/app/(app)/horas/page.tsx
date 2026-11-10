import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { inicioPorRol, veReporte } from "@/lib/auth/permisos";

export const metadata: Metadata = { title: "Horas del personal" };

export default async function PaginaHoras() {
  const perfil = await exigirPerfil();
  if (!veReporte(perfil.role)) redirect(inicioPorRol(perfil));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Horas del personal</h1>
      <p className="mt-2 text-suave">El reporte está en construcción.</p>
    </main>
  );
}
