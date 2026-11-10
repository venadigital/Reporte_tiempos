import { cache } from "react";
import { redirect } from "next/navigation";
import { crearCliente } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/auth/permisos";

/** Perfil de la sesión actual, o null si no hay sesión. Una sola consulta por petición. */
export const obtenerPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await crearCliente();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, nombre, cargo, role, activo, marca_turno")
    .eq("id", id)
    .maybeSingle();

  return (perfil as Perfil | null) ?? null;
});

/** Para páginas y acciones: exige sesión con perfil. Sin ella, al login. */
export async function exigirPerfil(): Promise<Perfil> {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/login");
  return perfil;
}
