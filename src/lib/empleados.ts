// Reglas de forma de la ficha del empleado. Las comparten el formulario y la
// acción del servidor; la base de datos vuelve a validar lo que le toca.

import type { Rol } from "@/lib/auth/permisos";

export const ROLES: { valor: Rol; nombre: string; descripcion: string }[] = [
  { valor: "empleado", nombre: "Empleado", descripcion: "Solo marca su turno." },
  { valor: "coordinador", nombre: "Coordinador", descripcion: "Ve el reporte y las fotos. No corrige." },
  { valor: "admin", nombre: "Administrador", descripcion: "Ve todo, corrige turnos y administra empleados." },
  { valor: "quiosco", nombre: "Quiosco", descripcion: "No es una persona: es el computador compartido." },
];

export const esRol = (v: unknown): v is Rol => ROLES.some((r) => r.valor === v);
export const nombreRol = (rol: Rol) => ROLES.find((r) => r.valor === rol)?.nombre ?? rol;

export const CLAVE_MIN = 8;

export type Empleado = {
  id: string;
  nombre: string;
  cargo: string | null;
  role: Rol;
  activo: boolean;
  marca_turno: boolean;
  correo: string;
  tiene_pin: boolean;
  pin_bloqueado: boolean;
  creado_el: string;
};

export function validarDatos(d: { nombre: string; role: unknown; marcaTurno: boolean }): string | null {
  if (!d.nombre.trim()) return "Escribe el nombre.";
  if (!esRol(d.role)) return "Elige un rol.";
  if (d.role === "quiosco" && d.marcaTurno) {
    return "La cuenta del quiosco no registra turnos: es un equipo, no una persona.";
  }
  return null;
}

export function validarCorreo(correo: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) ? null : "Escribe un correo válido.";
}

export function validarClave(clave: string): string | null {
  return clave.length >= CLAVE_MIN ? null : `La contraseña debe tener al menos ${CLAVE_MIN} caracteres.`;
}

export function validarPin(pin: string): string | null {
  return /^[0-9]{4}$/.test(pin) ? null : "El PIN debe tener exactamente 4 dígitos.";
}

/** Texto del estado del PIN para el listado y la ficha. Nunca el valor. */
export function estadoPin(e: Pick<Empleado, "tiene_pin" | "pin_bloqueado">): string {
  if (!e.tiene_pin) return "Sin PIN";
  return e.pin_bloqueado ? "PIN bloqueado" : "Tiene PIN";
}
