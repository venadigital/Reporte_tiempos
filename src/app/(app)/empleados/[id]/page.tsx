import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { estadoPin } from "@/lib/empleados";
import { exigirAdmin, listarEmpleados } from "../datos";
import { FormularioClave, FormularioDatos, FormularioPin } from "../formularios";

export const metadata: Metadata = { title: "Ficha del empleado" };

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-linea py-8">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {nota && <p className="mt-1 mb-5 text-sm text-suave">{nota}</p>}
      <div className={nota ? "" : "mt-5"}>{children}</div>
    </section>
  );
}

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
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          No se pudo cargar la ficha. Recarga la página.
        </p>
      </main>
    );
  }
  const empleado = empleados.find((e) => e.id === id);
  if (!empleado) notFound();

  const esQuiosco = empleado.role === "quiosco";

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Link href="/empleados" className="text-sm text-suave hover:text-tinta">
        ← Empleados
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{empleado.nombre}</h1>
      <p className="mb-6 text-suave">{empleado.correo}</p>

      {creado && (
        <p role="status" className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Empleado creado. Entrégale su correo y su contraseña.
        </p>
      )}

      <Seccion titulo="Datos">
        <FormularioDatos empleado={empleado} />
      </Seccion>

      {!esQuiosco && (
        <Seccion
          titulo={`PIN del quiosco · ${estadoPin(empleado)}`}
          nota="Sirve solo para marcar en el computador compartido. Se guarda cifrado y no se puede volver a ver: si se olvida, asigna otro. Sin PIN la persona sigue marcando desde su celular."
        >
          <FormularioPin empleado={empleado} />
        </Seccion>
      )}

      <Seccion titulo="Acceso" nota={`Entra con ${empleado.correo}. Si olvidó la contraseña, asígnale una nueva.`}>
        <FormularioClave empleado={empleado} />
      </Seccion>
    </main>
  );
}
