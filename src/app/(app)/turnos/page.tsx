import type { Metadata } from "next";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearCliente } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { fechaLarga, horaConDia, primerNombre, saludo } from "@/lib/fecha";
import { derivarEstado, textoFoto, type TurnoAbierto } from "@/lib/turnos";
import { MarcarTurno } from "./marcar-turno";
import { PantallaNoMarca, type VistaTurno } from "./pantalla-turno";

export const metadata: Metadata = { title: "Mi turno" };

export default async function PaginaTurnos() {
  const perfil = await exigirPerfil();
  if (!perfil.marca_turno) return <PantallaNoMarca />;

  const [config, supabase] = await Promise.all([obtenerConfiguracion(), crearCliente()]);

  // Lo único que la base le deja leer al empleado: su turno abierto.
  const { data: abiertos } = await supabase
    .from("turno")
    .select("id, inicio_el, pendiente_revision")
    .eq("perfil_id", perfil.id)
    .is("fin_el", null)
    .returns<TurnoAbierto[]>();

  const ids = (abiertos ?? []).map((t) => t.id);
  const { data: pausas } = ids.length
    ? await supabase
        .from("turno_pausa")
        .select("turno_id, inicio_el")
        .in("turno_id", ids)
        .is("fin_el", null)
        .returns<{ turno_id: number; inicio_el: string }[]>()
    : { data: [] };

  const ahora = new Date();
  const zona = config.zona_horaria;
  const estado = derivarEstado({
    marcaTurno: true,
    abiertos: abiertos ?? [],
    pausaAbierta: pausas?.[0] ?? null,
    ahora,
    maxHoras: config.turno_max_horas,
  });

  // Las horas viajan ya escritas: así el servidor y el navegador pintan lo mismo.
  let vista: VistaTurno;
  switch (estado.tipo) {
    case "en_turno":
      vista = { tipo: "en_turno", entrada: horaConDia(estado.inicioEl, ahora, zona) };
      break;
    case "en_almuerzo":
      vista = { tipo: "en_almuerzo", salio: horaConDia(estado.pausaInicioEl, ahora, zona) };
      break;
    default:
      vista = {
        tipo: "sin_turno",
        pendiente:
          estado.tipo === "sin_turno" && estado.pendienteDesde
            ? horaConDia(estado.pendienteDesde, ahora, zona)
            : null,
      };
  }

  return (
    <MarcarTurno
      vista={vista}
      nombre={primerNombre(perfil.nombre)}
      fecha={fechaLarga(ahora, zona)}
      saludo={saludo(ahora, zona)}
      textoFoto={textoFoto(config.fotos_dias)}
    />
  );
}
