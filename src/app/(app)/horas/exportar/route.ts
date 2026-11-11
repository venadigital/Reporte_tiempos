import type { NextRequest } from "next/server";
import { obtenerPerfil } from "@/lib/auth/sesion";
import { veReporte } from "@/lib/auth/permisos";
import { diaISO } from "@/lib/fecha";
import { leerPeriodo } from "@/lib/periodo";
import { construirLibro, nombreArchivo } from "@/lib/turnos-excel";
import { cargarReporte } from "../datos";

/** GET /horas/exportar?periodo=mes|q1|q2&ym=AAAA-MM → el Excel del periodo. */
export async function GET(request: NextRequest) {
  // Lo descargan los mismos que ven el reporte
  const perfil = await obtenerPerfil();
  if (!perfil?.activo || !veReporte(perfil.role)) {
    return new Response("No tienes permiso para descargar el reporte.", { status: 403 });
  }

  const parametros = request.nextUrl.searchParams;
  const periodo = leerPeriodo(
    { periodo: parametros.get("periodo") ?? undefined, ym: parametros.get("ym") ?? undefined },
    diaISO(new Date()),
  );

  // Si una consulta falla, la descarga responde error. Nunca un Excel con ceros:
  // se vería igual que un periodo sin turnos y alguien pagaría con él.
  const reporte = await cargarReporte(periodo);
  if (!reporte) {
    return new Response("No se pudo generar el reporte. Intenta de nuevo.", { status: 500 });
  }

  const libro = construirLibro({
    periodo,
    hasta: reporte.hasta,
    personas: reporte.personas,
    filas: reporte.filas,
    turnos: reporte.turnos,
    recargos: reporte.recargos,
    ahora: reporte.ahora,
    zona: reporte.config.zona_horaria,
    maxHoras: reporte.config.turno_max_horas,
    sinAlmuerzoMin: reporte.config.aviso_sin_almuerzo_min,
  });

  return new Response(await libro.xlsx.writeBuffer(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo(periodo)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
