import type { Metadata } from "next";
import Link from "next/link";
import { Flecha, tituloGrande } from "@/components/ui";
import { exigirAdmin } from "../datos";
import { FormularioNuevo } from "../formularios";

export const metadata: Metadata = { title: "Nuevo empleado" };

export default async function PaginaNuevoEmpleado() {
  await exigirAdmin();
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-[22px] px-5 pt-4 pb-10">
      <Link href="/empleados" className="flex h-11 items-center gap-0.5 self-start text-[17px] text-accion">
        <Flecha atras className="h-5 w-5" />
        Empleados
      </Link>
      <h1 className={`px-1 ${tituloGrande}`}>Nuevo empleado</h1>
      <FormularioNuevo />
    </main>
  );
}
