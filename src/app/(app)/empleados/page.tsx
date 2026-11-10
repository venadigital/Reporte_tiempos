import type { Metadata } from "next";
import Link from "next/link";
import { estadoPin, nombreRol } from "@/lib/empleados";
import { Flecha, botonCompacto, iniciales, tituloGrande } from "@/components/ui";
import { exigirAdmin, listarEmpleados } from "./datos";

export const metadata: Metadata = { title: "Empleados" };

function Etiqueta({ tono, children }: { tono: "verde" | "gris" | "ambar"; children: React.ReactNode }) {
  const color = {
    verde: "bg-turno-fondo text-turno-texto",
    gris: "bg-relleno text-pausa-tinta",
    ambar: "bg-aviso-fondo text-aviso-texto",
  }[tono];
  return <span className={`rounded-lg px-2.5 py-1 text-[13px] font-medium whitespace-nowrap ${color}`}>{children}</span>;
}

function IconoQuiosco() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="11" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  );
}

export default async function PaginaEmpleados() {
  await exigirAdmin();
  const empleados = await listarEmpleados();
  const marcan = empleados?.filter((e) => e.marca_turno && e.activo).length ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 py-9 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className={tituloGrande}>Empleados</h1>
          {empleados && empleados.length > 0 && (
            <p className="text-base text-suave">
              {empleados.length} {empleados.length === 1 ? "cuenta" : "cuentas"} · {marcan}{" "}
              {marcan === 1 ? "registra turnos" : "registran turnos"}
            </p>
          )}
        </div>
        <Link href="/empleados/nuevo" className={botonCompacto}>
          <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo empleado
        </Link>
      </div>

      {empleados === null ? (
        <p role="alert" className="rounded-2xl bg-error-fondo px-4 py-3.5 text-[15px] text-error-texto">
          No se pudo cargar la lista. Recarga la página.
        </p>
      ) : empleados.length === 0 ? (
        <p className="text-base text-suave">Todavía no hay empleados.</p>
      ) : (
        <ul className="divide-y divide-linea rounded-[20px] bg-white px-5">
          {empleados.map((e) => (
            <li key={e.id}>
              <Link
                href={`/empleados/${e.id}`}
                className={`flex flex-wrap items-center gap-x-4 gap-y-3 py-4 ${e.activo ? "" : "text-suave"}`}
              >
                <span
                  aria-hidden
                  className={`flex h-11 w-11 shrink-0 items-center justify-center text-[15px] font-bold ${
                    e.role === "quiosco"
                      ? "rounded-xl bg-relleno text-pausa-tinta"
                      : e.activo
                        ? "rounded-full bg-accion-suave text-accion"
                        : "rounded-full bg-relleno text-suave"
                  }`}
                >
                  {e.role === "quiosco" ? <IconoQuiosco /> : iniciales(e.nombre)}
                </span>
                <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                  <span className="truncate text-[17px] font-semibold">{e.nombre}</span>
                  <span className="truncate text-sm text-suave">{[e.cargo, e.correo].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Etiqueta tono="gris">{nombreRol(e.role)}</Etiqueta>
                  {e.marca_turno && <Etiqueta tono="verde">Registra turnos</Etiqueta>}
                  {e.marca_turno && <Etiqueta tono={e.pin_bloqueado ? "ambar" : "gris"}>{estadoPin(e)}</Etiqueta>}
                  {!e.activo && <Etiqueta tono="ambar">Inactivo</Etiqueta>}
                </span>
                <Flecha className="h-[18px] w-[18px] text-[#8e8e96]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
