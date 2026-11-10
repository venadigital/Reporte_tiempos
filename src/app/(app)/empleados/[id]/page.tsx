import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso, Flecha, tituloGrande } from "@/components/ui";
import { exigirAdmin, listarEmpleados } from "../datos";
import { FormularioClave, FormularioDatos, FormularioPin } from "../formularios";

export const metadata: Metadata = { title: "Ficha del empleado" };

export default async function PaginaFicha({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  await exigirAdmin();
  const [{ id }, { creado }, empleados] = await Promise.all([params, searchParams, listarEmpleados()]);

  if (empleados === null) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-8">
        <Aviso resultado={{ ok: false, mensaje: "No se pudo cargar la ficha. Recarga la página." }} />
      </main>
    );
  }
  const empleado = empleados.find((e) => e.id === id);
  if (!empleado) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-[22px] px-5 pt-4 pb-10">
      <Link href="/empleados" className="flex h-11 items-center gap-0.5 self-start text-[17px] text-accion">
        <Flecha atras className="h-5 w-5" />
        Empleados
      </Link>

      <header className="flex flex-col gap-0.5 px-1">
        <h1 className={tituloGrande}>{empleado.nombre}</h1>
        <p className="text-base text-suave">{empleado.correo}</p>
      </header>

      {creado && <Aviso resultado={{ ok: true, mensaje: "Empleado creado. Entrégale su correo y su contraseña." }} />}

      <FormularioDatos empleado={empleado} />
      {empleado.role !== "quiosco" && <FormularioPin empleado={empleado} />}
      <FormularioClave empleado={empleado} />
    </main>
  );
}
