import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { diaISO, horaCorta, paraCampo } from "@/lib/fecha";
import { ORIGEN, estadoTurno, type TurnoListado } from "@/lib/horas";
import { diaLargo } from "@/lib/periodo";
import { Flecha, tituloGrande } from "@/components/ui";
import { firmarFotos } from "../../../fotos";
import { FormularioBorrar, FormularioTurno } from "../../../formulario-turno";
import { prepararCorreccion } from "../guardia";

export const metadata: Metadata = { title: "Corregir turno" };

type Turno = Pick<
  TurnoListado,
  "inicio_el" | "fin_el" | "foto_inicio_path" | "foto_fin_path" | "origen" | "pendiente_revision" | "ajuste_motivo"
> & { id: number; perfil_id: string };

export default async function PaginaCorregir({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; turno: string }>;
  searchParams: Promise<{ periodo?: string; ym?: string }>;
}) {
  const [{ id, turno: turnoTexto }, consultaUrl] = await Promise.all([params, searchParams]);
  const { periodo, qs, config, supabase, persona } = await prepararCorreccion(id, consultaUrl);

  const turnoId = Number(turnoTexto);
  if (!Number.isInteger(turnoId) || turnoId <= 0) notFound();

  const [{ data: turno }, { data: pausas }] = await Promise.all([
    supabase
      .from("turno")
      .select("id, perfil_id, inicio_el, fin_el, foto_inicio_path, foto_fin_path, origen, pendiente_revision, ajuste_motivo")
      .eq("id", turnoId)
      .eq("perfil_id", id)
      .maybeSingle(),
    supabase.from("turno_pausa").select("inicio_el, fin_el").eq("turno_id", turnoId).order("inicio_el"),
  ]);
  if (!turno) notFound();

  const t = turno as Turno;
  const zona = config.zona_horaria;
  const ahora = new Date();
  const estado = estadoTurno(t, ahora, config.turno_max_horas);
  const fotos = await firmarFotos([t.foto_inicio_path, t.foto_fin_path]);

  const pruebas = [
    { titulo: "Entrada", ruta: t.foto_inicio_path, instante: t.inicio_el },
    { titulo: "Salida", ruta: t.foto_fin_path, instante: t.fin_el },
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-[22px] px-5 pt-4 pb-10">
      <Link href={`/horas/${id}?${qs}`} className="flex h-11 items-center gap-0.5 self-start text-[17px] text-accion">
        <Flecha atras className="h-5 w-5" />
        {persona.nombre}
      </Link>

      <header className="flex flex-col gap-1 px-1">
        <h1 className={tituloGrande}>{estado === "sin_cerrar" ? "Poner la salida" : "Corregir turno"}</h1>
        <p className="text-base leading-[22px] text-suave first-letter:uppercase">
          {diaLargo(diaISO(t.inicio_el, zona))} · {ORIGEN[t.origen].toLowerCase()}
        </p>
      </header>

      {estado === "sin_cerrar" && (
        <p className="rounded-2xl bg-error-fondo px-4 py-3.5 text-[15px] leading-5 text-error-texto">
          Este turno quedó sin cerrar y no suma horas. Escribe la hora real de salida: nunca se inventa.
        </p>
      )}
      {estado === "en_curso" && (
        <p className="rounded-2xl bg-aviso-fondo px-4 py-3.5 text-[15px] leading-5 text-aviso-texto">
          Este turno sigue en curso. Si guardas una salida, queda cerrado y la persona ya no podrá cerrarlo desde su celular.
        </p>
      )}

      {/* Primero la prueba: se corrige mirando las fotos, no de memoria. */}
      <section className="grid grid-cols-2 gap-3">
        {pruebas.map((p) => {
          const url = p.ruta ? fotos.get(p.ruta) : undefined;
          return (
            <figure key={p.titulo} className="flex flex-col gap-2">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[20px] bg-pausa-fondo text-center text-[13px] text-pausa-texto">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Foto de ${p.titulo.toLowerCase()} de ${persona.nombre}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="px-3">{t.origen === "ajuste" ? "Sin foto: se agregó a mano" : p.instante ? "Foto vencida" : "Sin foto todavía"}</span>
                )}
              </div>
              <figcaption className="px-1 text-sm">
                <span className="font-semibold">{p.titulo}</span>{" "}
                <span className="text-suave">{p.instante ? horaCorta(p.instante, zona) : "sin marcar"}</span>
              </figcaption>
            </figure>
          );
        })}
      </section>

      <FormularioTurno
        perfilId={id}
        turnoId={turnoId}
        periodo={periodo}
        inicial={{
          entrada: paraCampo(t.inicio_el, zona),
          salida: t.fin_el ? paraCampo(t.fin_el, zona) : "",
          // Solo los almuerzos cerrados; uno abierto se vuelve a escribir completo
          pausas: ((pausas ?? []) as { inicio_el: string; fin_el: string | null }[])
            .filter((p) => p.fin_el)
            .map((p) => ({ inicio: paraCampo(p.inicio_el, zona), fin: paraCampo(p.fin_el as string, zona) })),
        }}
        ahora={paraCampo(ahora, zona)}
      />

      <FormularioBorrar perfilId={id} turnoId={turnoId} periodo={periodo} />
    </main>
  );
}
