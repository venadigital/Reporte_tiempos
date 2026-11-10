// Lista ÚNICA de quién puede qué en la aplicación. De aquí beben el menú, las
// páginas y las acciones. La base de datos tiene su propia copia (private.ve_reporte
// y private.exige_admin) y es la que manda: esto solo decide qué se muestra.

export type Rol = "admin" | "coordinador" | "empleado" | "quiosco";

export type Perfil = {
  id: string;
  nombre: string;
  cargo: string | null;
  role: Rol;
  activo: boolean;
  marca_turno: boolean;
};

export const veReporte = (rol: Rol) => rol === "admin" || rol === "coordinador";
export const corrige = (rol: Rol) => rol === "admin";
export const administraEmpleados = (rol: Rol) => rol === "admin";
export const usaQuiosco = (rol: Rol) => rol === "quiosco" || rol === "admin";

/**
 * Pantalla de inicio por rol. Un rol que no ve ningún módulo necesita la suya:
 * si todos cayeran en la misma, quedaría rebotando sin poder entrar a ninguna parte.
 */
export function inicioPorRol(perfil: Pick<Perfil, "role" | "marca_turno">): string {
  if (perfil.role === "quiosco") return "/quiosco";
  if (veReporte(perfil.role)) return "/horas";
  return "/turnos";
}

export type EntradaMenu = { href: string; texto: string };

export function menu(perfil: Pick<Perfil, "role" | "marca_turno">): EntradaMenu[] {
  const entradas: EntradaMenu[] = [];
  if (perfil.role !== "quiosco" && perfil.marca_turno) {
    entradas.push({ href: "/turnos", texto: "Mi turno" });
  }
  if (veReporte(perfil.role)) {
    entradas.push({ href: "/horas", texto: "Horas del personal" });
  }
  if (administraEmpleados(perfil.role)) {
    entradas.push({ href: "/empleados", texto: "Empleados" });
  }
  return entradas;
}
