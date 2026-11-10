"use server";

import { redirect } from "next/navigation";
import { crearCliente } from "@/lib/supabase/server";

export type EstadoLogin = { error: string | null };

export async function iniciarSesion(_previo: EstadoLogin, datos: FormData): Promise<EstadoLogin> {
  const correo = String(datos.get("correo") ?? "").trim();
  const clave = String(datos.get("clave") ?? "");
  if (!correo || !clave) return { error: "Escribe tu correo y tu contraseña." };

  const supabase = await crearCliente();
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  // Un solo mensaje para los dos casos: no se revela si el correo existe.
  if (error) return { error: "Correo o contraseña incorrectos." };

  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await crearCliente();
  await supabase.auth.signOut();
  redirect("/login");
}
