import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerPerfil } from "@/lib/auth/sesion";
import { inicioPorRol } from "@/lib/auth/permisos";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin() {
  const perfil = await obtenerPerfil();
  if (perfil?.activo) redirect(inicioPorRol(perfil));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Reporte de tiempos</h1>
      <p className="mt-1 mb-8 text-suave">Entra con el correo y la contraseña que te entregaron.</p>
      <FormularioLogin />
    </main>
  );
}
