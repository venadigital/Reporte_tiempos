import { redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { administraEmpleados, inicioPorRol } from "@/lib/auth/permisos";
import { crearCliente } from "@/lib/supabase/server";
import type { Empleado } from "@/lib/empleados";

/** Guardia de las páginas de empleados: solo el administrador principal. */
export async function exigirAdmin() {
  const perfil = await exigirPerfil();
  if (!administraEmpleados(perfil.role)) redirect(inicioPorRol(perfil));
  return perfil;
}

/** Devuelve null si la consulta falla: la página lo dice en vez de mostrar una lista vacía. */
export async function listarEmpleados(): Promise<Empleado[] | null> {
  const supabase = await crearCliente();
  const { data, error } = await supabase.rpc("empleados_listar");
  return error ? null : ((data ?? []) as Empleado[]);
}
