import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Aviso, Interruptor, iniciales } from "@/components/ui";

describe("piezas compartidas", () => {
  it("las iniciales salen del primer y el último nombre", () => {
    expect(iniciales("Camila Rojas")).toBe("CR");
    expect(iniciales("  camila andrea rojas ")).toBe("CR");
    expect(iniciales("Quiosco")).toBe("Q");
    expect(iniciales("")).toBe("?");
  });

  it("el interruptor es una casilla real: se alcanza con el teclado y viaja en el formulario", () => {
    render(<Interruptor name="marca_turno" etiqueta="Registra turnos" defaultChecked />);
    const casilla = screen.getByRole("switch", { name: "Registra turnos" }) as HTMLInputElement;
    expect(casilla.type).toBe("checkbox");
    expect(casilla.name).toBe("marca_turno");
    expect(casilla.checked).toBe(true);
  });

  it("la confirmación se anuncia y el error es una alerta; sin resultado no pinta nada", () => {
    const { rerender, container } = render(<Aviso resultado={{ ok: true, mensaje: "Cambios guardados." }} />);
    expect(screen.getByRole("status").textContent).toBe("Cambios guardados.");
    rerender(<Aviso resultado={{ ok: false, mensaje: "El nombre es obligatorio." }} />);
    expect(screen.getByRole("alert").textContent).toBe("El nombre es obligatorio.");
    rerender(<Aviso resultado={null} />);
    expect(container.textContent).toBe("");
  });
});
