import { redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { inicioPorRol } from "@/lib/auth/permisos";

// La raíz no muestra nada: manda a cada quien a su pantalla de inicio.
export default async function Inicio() {
  const perfil = await exigirPerfil();
  redirect(inicioPorRol(perfil));
}
