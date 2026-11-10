"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearCliente } from "@/lib/supabase/server";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { obtenerPerfil } from "@/lib/auth/sesion";
import { administraEmpleados } from "@/lib/auth/permisos";
import { validarClave, validarCorreo, validarDatos, validarPin } from "@/lib/empleados";

export type Resultado = { ok: boolean; mensaje: string } | null;

const fallo = (mensaje: string): Resultado => ({ ok: false, mensaje });
const SIN_PERMISO = "Solo el administrador principal puede hacer esto.";
const SIN_LLAVE =
  "Falta configurar la llave de servicio (SUPABASE_SERVICE_ROLE_KEY) en el servidor. Sin ella no se pueden crear cuentas ni cambiar contraseñas.";

/**
 * El guardia de la página NO protege la acción: cada acción comprueba por su
 * cuenta que quien llama es el administrador principal. La base lo vuelve a
 * comprobar en cada función.
 */
async function esAdmin(): Promise<boolean> {
  const perfil = await obtenerPerfil();
  return !!perfil?.activo && administraEmpleados(perfil.role);
}

/** Los mensajes de las reglas de la base ya están escritos para la persona. */
function mensajeDeLaBase(error: { code?: string; message: string }): string {
  const deNegocio = error.code === "P0001" || error.code === "P0002" || error.code === "42501";
  return deNegocio ? error.message : "No se pudo guardar. Intenta de nuevo.";
}

function leerDatos(datos: FormData) {
  return {
    nombre: String(datos.get("nombre") ?? "").trim(),
    cargo: String(datos.get("cargo") ?? "").trim(),
    role: String(datos.get("role") ?? ""),
    activo: datos.get("activo") === "on",
    marcaTurno: datos.get("marca_turno") === "on",
  };
}

export async function crearEmpleado(_previo: Resultado, datos: FormData): Promise<Resultado> {
  if (!(await esAdmin())) return fallo(SIN_PERMISO);

  const d = leerDatos(datos);
  const correo = String(datos.get("correo") ?? "").trim().toLowerCase();
  const clave = String(datos.get("clave") ?? "");
  const error = validarDatos(d) ?? validarCorreo(correo) ?? validarClave(clave);
  if (error) return fallo(error);

  const servicio = crearClienteServicio();
  if (!servicio) return fallo(SIN_LLAVE);

  // 1. La cuenta. El perfil nace solo (disparador), siempre como "empleado".
  const { data: cuenta, error: errorCuenta } = await servicio.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,
    user_metadata: { nombre: d.nombre },
  });
  if (errorCuenta || !cuenta.user) {
    if (errorCuenta?.code === "email_exists") return fallo("Ya existe una cuenta con ese correo.");
    if (errorCuenta?.code === "weak_password") return fallo("Esa contraseña es muy débil. Usa una más larga.");
    return fallo("No se pudo crear la cuenta. Intenta de nuevo.");
  }

  // 2. Rol, cargo e interruptor, con la sesión del administrador: queda en la bitácora.
  const supabase = await crearCliente();
  const { error: errorFicha } = await supabase.rpc("empleado_actualizar", {
    p_perfil: cuenta.user.id,
    p_nombre: d.nombre,
    p_cargo: d.cargo,
    p_role: d.role,
    p_activo: true,
    p_marca_turno: d.marcaTurno,
  });

  revalidatePath("/empleados");
  if (errorFicha) {
    return fallo(`La cuenta se creó, pero no se guardaron su rol ni su cargo: ${mensajeDeLaBase(errorFicha)}`);
  }
  redirect(`/empleados/${cuenta.user.id}?creado=1`);
}

export async function guardarEmpleado(_previo: Resultado, datos: FormData): Promise<Resultado> {
  if (!(await esAdmin())) return fallo(SIN_PERMISO);

  const id = String(datos.get("id") ?? "");
  const d = leerDatos(datos);
  const error = validarDatos(d);
  if (error) return fallo(error);

  const supabase = await crearCliente();
  const { error: errorFicha } = await supabase.rpc("empleado_actualizar", {
    p_perfil: id,
    p_nombre: d.nombre,
    p_cargo: d.cargo,
    p_role: d.role,
    p_activo: d.activo,
    p_marca_turno: d.marcaTurno,
  });
  if (errorFicha) return fallo(mensajeDeLaBase(errorFicha));

  revalidatePath("/empleados");
  revalidatePath(`/empleados/${id}`);
  return { ok: true, mensaje: "Cambios guardados." };
}

export async function asignarPin(_previo: Resultado, datos: FormData): Promise<Resultado> {
  if (!(await esAdmin())) return fallo(SIN_PERMISO);

  const id = String(datos.get("id") ?? "");
  const pin = String(datos.get("pin") ?? "");
  const error = validarPin(pin);
  if (error) return fallo(error);

  const supabase = await crearCliente();
  const { error: errorPin } = await supabase.rpc("turno_pin_asignar", { p_perfil: id, p_pin: pin });
  if (errorPin) return fallo(mensajeDeLaBase(errorPin));

  revalidatePath("/empleados");
  revalidatePath(`/empleados/${id}`);
  return { ok: true, mensaje: "PIN asignado. Entrégaselo a la persona: no se puede volver a ver." };
}

export async function borrarPin(_previo: Resultado, datos: FormData): Promise<Resultado> {
  if (!(await esAdmin())) return fallo(SIN_PERMISO);

  const id = String(datos.get("id") ?? "");
  const supabase = await crearCliente();
  const { error } = await supabase.rpc("turno_pin_borrar", { p_perfil: id });
  if (error) return fallo(mensajeDeLaBase(error));

  revalidatePath("/empleados");
  revalidatePath(`/empleados/${id}`);
  return { ok: true, mensaje: "PIN quitado. La persona sigue marcando desde su celular." };
}

export async function cambiarClave(_previo: Resultado, datos: FormData): Promise<Resultado> {
  if (!(await esAdmin())) return fallo(SIN_PERMISO);

  const id = String(datos.get("id") ?? "");
  const clave = String(datos.get("clave") ?? "");
  const error = validarClave(clave);
  if (error) return fallo(error);

  const servicio = crearClienteServicio();
  if (!servicio) return fallo(SIN_LLAVE);

  const { error: errorClave } = await servicio.auth.admin.updateUserById(id, { password: clave });
  if (errorClave) {
    if (errorClave.code === "weak_password") return fallo("Esa contraseña es muy débil. Usa una más larga.");
    return fallo("No se pudo cambiar la contraseña. Intenta de nuevo.");
  }
  return { ok: true, mensaje: "Contraseña cambiada. Entrégasela a la persona." };
}
