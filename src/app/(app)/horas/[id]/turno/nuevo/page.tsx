import type { Metadata } from "next";
import Link from "next/link";
import { paraCampo } from "@/lib/fecha";
import { Flecha, tituloGrande } from "@/components/ui";
import { FormularioTurno } from "../../../formulario-turno";
import { prepararCorreccion } from "../guardia";

export const metadata: Metadata = { title: "Agregar turno" };

export default async function PaginaTurnoNuevo({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string; ym?: string }>;
}) {
  const [{ id }, consultaUrl] = await Promise.all([params, searchParams]);
  const { periodo, qs, config, persona } = await prepararCorreccion(id, consultaUrl);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-[22px] px-5 pt-4 pb-10">
      <Link href={`/horas/${id}?${qs}`} className="flex h-11 items-center gap-0.5 self-start text-[17px] text-accion">
        <Flecha atras className="h-5 w-5" />
        {persona.nombre}
      </Link>
      <header className="flex flex-col gap-1 px-1">
        <h1 className={tituloGrande}>Agregar turno</h1>
        <p className="text-base leading-[22px] text-suave">
          Para un turno que nunca se marcó. No lleva foto y queda como corregido a mano.
        </p>
      </header>
      <FormularioTurno
        perfilId={id}
        periodo={periodo}
        inicial={{ entrada: "", salida: "", pausas: [] }}
        ahora={paraCampo(new Date(), config.zona_horaria)}
      />
    </main>
  );
}
