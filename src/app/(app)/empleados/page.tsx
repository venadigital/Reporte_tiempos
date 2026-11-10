import type { Metadata } from "next";
import Link from "next/link";
import { estadoPin, nombreRol } from "@/lib/empleados";
import { exigirAdmin, listarEmpleados } from "./datos";

export const metadata: Metadata = { title: "Empleados" };

function Etiqueta({ tono, children }: { tono: "verde" | "gris" | "ambar"; children: React.ReactNode }) {
  const color = {
    verde: "bg-emerald-50 text-emerald-800",
    gris: "bg-neutral-100 text-neutral-600",
    ambar: "bg-amber-50 text-amber-800",
  }[tono];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${color}`}>{children}</span>;
}

export default async function PaginaEmpleados() {
  await exigirAdmin();
  const empleados = await listarEmpleados();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Empleados</h1>
        <Link href="/empleados/nuevo" className="rounded-xl bg-tinta px-4 py-2.5 text-sm font-semibold text-white">
          Nuevo empleado
        </Link>
      </div>

      {empleados === null ? (
        <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          No se pudo cargar la lista. Recarga la página.
        </p>
      ) : empleados.length === 0 ? (
        <p className="mt-6 text-suave">Todavía no hay empleados.</p>
      ) : (
        <ul className="mt-6 divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white">
          {empleados.map((e) => (
            <li key={e.id}>
              <Link
                href={`/empleados/${e.id}`}
                className="flex flex-col gap-2 px-4 py-4 hover:bg-neutral-50 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-medium ${e.activo ? "" : "text-suave line-through"}`}>
                    {e.nombre}
                  </span>
                  <span className="block truncate text-sm text-suave">
                    {[e.cargo, e.correo].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Etiqueta tono="gris">{nombreRol(e.role)}</Etiqueta>
                  {e.marca_turno && <Etiqueta tono="verde">Registra turnos</Etiqueta>}
                  {e.marca_turno && (
                    <Etiqueta tono={e.pin_bloqueado ? "ambar" : "gris"}>{estadoPin(e)}</Etiqueta>
                  )}
                  {!e.activo && <Etiqueta tono="ambar">Inactivo</Etiqueta>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
