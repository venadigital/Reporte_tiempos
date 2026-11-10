import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { estadoPin, nombreRol, validarClave, validarCorreo, validarDatos, validarPin, type Empleado } from "@/lib/empleados";
import { FormularioDatos, FormularioNuevo, FormularioPin } from "@/app/(app)/empleados/formularios";

vi.mock("@/app/(app)/empleados/actions", () => ({
  crearEmpleado: vi.fn(),
  guardarEmpleado: vi.fn(),
  asignarPin: vi.fn(),
  borrarPin: vi.fn(),
  cambiarClave: vi.fn(),
}));

const empleado: Empleado = {
  id: "11111111-1111-1111-1111-111111111111",
  nombre: "Camila Rojas",
  cargo: "Recepción",
  role: "empleado",
  activo: true,
  marca_turno: true,
  correo: "camila@ejemplo.test",
  tiene_pin: false,
  pin_bloqueado: false,
  creado_el: "2026-11-10T12:00:00Z",
};

describe("reglas de forma de la ficha", () => {
  it("exige nombre y un rol conocido", () => {
    expect(validarDatos({ nombre: "  ", role: "empleado", marcaTurno: false })).toMatch(/nombre/);
    expect(validarDatos({ nombre: "Ana", role: "jefe", marcaTurno: false })).toMatch(/rol/);
    expect(validarDatos({ nombre: "Ana", role: "coordinador", marcaTurno: true })).toBeNull();
  });

  it("la cuenta del quiosco no registra turnos", () => {
    expect(validarDatos({ nombre: "Recepción", role: "quiosco", marcaTurno: true })).toMatch(/quiosco/);
    expect(validarDatos({ nombre: "Recepción", role: "quiosco", marcaTurno: false })).toBeNull();
  });

  it("el PIN son exactamente 4 dígitos", () => {
    expect(validarPin("1234")).toBeNull();
    expect(validarPin("0007")).toBeNull();
    for (const malo of ["123", "12345", "12a4", " 1234", ""]) expect(validarPin(malo)).toMatch(/4 dígitos/);
  });

  it("correo y contraseña", () => {
    expect(validarCorreo("camila@ejemplo.test")).toBeNull();
    expect(validarCorreo("camila@")).toMatch(/correo/);
    expect(validarClave("1234567")).toMatch(/8 caracteres/);
    expect(validarClave("12345678")).toBeNull();
  });

  it("el estado del PIN nunca dice el valor", () => {
    expect(estadoPin({ tiene_pin: false, pin_bloqueado: false })).toBe("Sin PIN");
    expect(estadoPin({ tiene_pin: true, pin_bloqueado: false })).toBe("Tiene PIN");
    expect(estadoPin({ tiene_pin: true, pin_bloqueado: true })).toBe("PIN bloqueado");
    expect(nombreRol("coordinador")).toBe("Coordinador");
  });
});

describe("formularios de empleados", () => {
  it("la ficha carga los datos guardados, con el interruptor y el estado", () => {
    render(<FormularioDatos empleado={empleado} />);
    expect((screen.getByLabelText(/Nombre completo/) as HTMLInputElement).value).toBe("Camila Rojas");
    expect((screen.getByLabelText(/Cargo/) as HTMLInputElement).value).toBe("Recepción");
    expect((screen.getByLabelText(/Rol/) as HTMLSelectElement).value).toBe("empleado");
    expect((screen.getByRole("checkbox", { name: /Registra turnos/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Cuenta activa/ }) as HTMLInputElement).checked).toBe(true);
  });

  it("al elegir el rol quiosco se bloquea el interruptor de turnos", () => {
    render(<FormularioDatos empleado={empleado} />);
    const interruptor = () => screen.getByRole("checkbox", { name: /Registra turnos/ }) as HTMLInputElement;
    expect(interruptor().disabled).toBe(false);
    fireEvent.change(screen.getByLabelText(/Rol/), { target: { value: "quiosco" } });
    expect(interruptor().disabled).toBe(true);
    expect(screen.getByText(/El quiosco es un equipo/)).toBeTruthy();
  });

  it("el alta pide correo y contraseña inicial, y no ofrece desactivar", () => {
    render(<FormularioNuevo />);
    expect(screen.getByLabelText(/Correo/)).toBeTruthy();
    expect((screen.getByLabelText(/Contraseña inicial/) as HTMLInputElement).type).toBe("password");
    expect(screen.queryByRole("checkbox", { name: /Cuenta activa/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Crear empleado" })).toBeTruthy();
  });

  it("sin PIN solo se puede asignar; con PIN también quitar", () => {
    const { unmount } = render(<FormularioPin empleado={empleado} />);
    expect(screen.getByLabelText(/PIN de 4 dígitos/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Quitar PIN" })).toBeNull();
    unmount();

    render(<FormularioPin empleado={{ ...empleado, tiene_pin: true }} />);
    const pin = screen.getByLabelText(/Asignar otro PIN/) as HTMLInputElement;
    expect(pin.maxLength).toBe(4);
    expect(pin.pattern).toBe("[0-9]{4}");
    expect(screen.getByRole("button", { name: "Quitar PIN" })).toBeTruthy();
  });
});
