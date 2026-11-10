import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "../datos";
import { FormularioNuevo } from "../formularios";

export const metadata: Metadata = { title: "Nuevo empleado" };

export default async function PaginaNuevoEmpleado() {
  await exigirAdmin();
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Link href="/empleados" className="text-sm text-suave hover:text-tinta">
        ← Empleados
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold tracking-tight">Nuevo empleado</h1>
      <FormularioNuevo />
    </main>
  );
}
