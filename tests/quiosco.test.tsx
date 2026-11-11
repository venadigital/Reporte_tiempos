import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  INACTIVIDAD_MS,
  LISTO_MS,
  accionesPosibles,
  aVista,
  esPin,
  esUuid,
  mensajeListo,
  textoEstado,
  type PersonaQuiosco,
} from "@/lib/quiosco";
import { Quiosco } from "@/app/quiosco/quiosco";
import { ListaPersonas, TecladoPin } from "@/app/quiosco/vistas";
import { marcarQuiosco, verificarPin } from "@/app/quiosco/actions";

vi.mock("@/app/quiosco/actions", () => ({ marcarQuiosco: vi.fn(), verificarPin: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const ahora = new Date("2026-08-26T20:00:00Z"); // miércoles 3:00 p. m. en Colombia
const fila = (extra: Partial<PersonaQuiosco>): PersonaQuiosco => ({
  perfil_id: "11111111-1111-1111-1111-111111111111",
  nombre: "Camila Rojas",
  en_turno: false,
  inicio_el: null,
  en_pausa: false,
  pausa_inicio_el: null,
  tiene_pin: true,
  ...extra,
});

const sinTurno = aVista(fila({}), ahora);
const enTurno = aVista(fila({ perfil_id: "22222222-2222-2222-2222-222222222222", nombre: "Andrés Pardo", en_turno: true, inicio_el: "2026-08-26T12:02:00Z" }), ahora);
const almorzando = aVista(
  fila({ perfil_id: "33333333-3333-3333-3333-333333333333", nombre: "Luisa Mora", en_turno: true, inicio_el: "2026-08-26T12:02:00Z", en_pausa: true, pausa_inicio_el: "2026-08-26T17:31:00Z" }),
  ahora,
);
const sinPin = aVista(fila({ perfil_id: "44444444-4444-4444-4444-444444444444", nombre: "Iván Soto", tiene_pin: false }), ahora);

describe("reglas de pantalla del quiosco", () => {
  it("en turno ofrece cerrar y almorzar; en almuerzo, solo regresar; sin turno, solo entrar", () => {
    expect(accionesPosibles("en_turno")).toEqual(["salida", "pausa_inicio"]);
    expect(accionesPosibles("almorzando")).toEqual(["pausa_fin"]);
    expect(accionesPosibles("sin_turno")).toEqual(["entrada"]);
  });

  it("el estado se dice con la hora de entrada, y con el día en los turnos de noche", () => {
    expect(sinTurno.textoEstado).toBe("Sin turno");
    expect(enTurno.textoEstado).toBe("En turno desde 7:02 a. m.");
    expect(almorzando.textoEstado).toBe("Almorzando");
    expect(textoEstado(fila({ en_turno: true, inicio_el: "2026-08-26T03:02:00Z" }), ahora)).toBe("En turno desde ayer 10:02 p. m.");
  });

  it("el listo dice la hora que quedó", () => {
    expect(mensajeListo("entrada", "2026-08-26T12:02:00Z")).toBe("Entrada registrada a las 7:02 a. m.");
    expect(mensajeListo("salida", "2026-08-26T22:02:00Z")).toBe("Salida registrada a las 5:02 p. m.");
    expect(mensajeListo("pausa_fin", "2026-08-26T18:30:00Z")).toContain("1:30 p. m.");
  });

  it("valida la forma del PIN y del identificador antes de ir a la base", () => {
    expect(esPin("0412")).toBe(true);
    for (const malo of ["412", "12345", "12a4", 1234, null]) expect(esPin(malo)).toBe(false);
    expect(esUuid(sinTurno.id)).toBe(true);
    expect(esUuid("../otra/carpeta")).toBe(false);
  });
});

describe("lista del quiosco", () => {
  it("muestra el nombre y el estado de cada persona, sin datos personales", () => {
    render(<ListaPersonas personas={[sinTurno, enTurno, almorzando]} zona="America/Bogota" onElegir={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Camila Rojas.*Sin turno/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Andrés Pardo.*En turno desde 7:02 a\. m\./ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Luisa Mora.*Almorzando/ })).toBeTruthy();
    expect(screen.getByText("Toca tu nombre para marcar")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/@|correo|cargo/i);
  });

  it("a quien no tiene PIN lo muestra inhabilitado y le dice qué hacer", () => {
    render(<ListaPersonas personas={[sinPin]} zona="America/Bogota" onElegir={vi.fn()} />);
    expect(screen.getByText("Sin PIN · marca desde tu celular")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Iván Soto/ })).toBeNull();
  });

  it("sin nadie con turnos activados lo dice; no sale en blanco", () => {
    render(<ListaPersonas personas={[]} zona="America/Bogota" onElegir={vi.fn()} />);
    expect(screen.getByText(/Todavía no hay personas que registren turnos/)).toBeTruthy();
  });
});

describe("teclado del PIN", () => {
  const base = { persona: sinTurno, accion: "entrada" as const, error: null, ocupado: false, onBorrar: vi.fn(), onCancelar: vi.fn() };

  it("los puntos se van llenando y nunca muestra el PIN", () => {
    render(<TecladoPin {...base} pin="12" onDigito={vi.fn()} />);
    expect(screen.getByRole("img", { name: "2 de 4 dígitos escritos" })).toBeTruthy();
    expect(screen.getByText(/iniciar tu turno/)).toBeTruthy();
    expect(screen.queryByText("12")).toBeNull();
  });

  it("se puede escribir con los botones y con el teclado físico", () => {
    const onDigito = vi.fn();
    const onBorrar = vi.fn();
    render(<TecladoPin {...base} pin="" onDigito={onDigito} onBorrar={onBorrar} />);
    fireEvent.click(screen.getByRole("button", { name: "7" }));
    fireEvent.keyDown(screen.getByRole("main"), { key: "3" });
    fireEvent.keyDown(screen.getByRole("main"), { key: "x" });
    fireEvent.keyDown(screen.getByRole("main"), { key: "Backspace" });
    expect(onDigito.mock.calls.map((c) => c[0])).toEqual(["7", "3"]);
    expect(onBorrar).toHaveBeenCalledOnce();
  });

  it("el error del PIN sale como alerta, con los intentos que quedan", () => {
    render(<TecladoPin {...base} pin="" error="PIN incorrecto. Te quedan 2 intentos." onDigito={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toBe("PIN incorrecto. Te quedan 2 intentos.");
  });
});

describe("recorrido del quiosco", () => {
  const props = { zona: "America/Bogota", textoFoto: "La foto se guarda 45 días." };
  const escribir = (pin: string) => [...pin].forEach((d) => fireEvent.click(screen.getByRole("button", { name: d })));

  beforeEach(() => {
    vi.mocked(verificarPin).mockReset();
    vi.mocked(marcarQuiosco).mockReset();
    refresh.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sin turno: se salta el paso de elegir, verifica el PIN al cuarto dígito y solo entonces abre la cámara", async () => {
    vi.mocked(verificarPin).mockResolvedValue({ ok: true, mensaje: "" });
    render(<Quiosco {...props} personas={[sinTurno, enTurno]} />);
    fireEvent.click(screen.getByRole("button", { name: /Camila Rojas/ }));

    expect(screen.getByRole("heading", { name: "Hola, Camila" })).toBeTruthy();
    expect(screen.queryByText("¿Qué vas a marcar?")).toBeNull();

    escribir("123");
    expect(verificarPin).not.toHaveBeenCalled();
    escribir("4");
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Foto de entrada" })).toBeTruthy());
    expect(verificarPin).toHaveBeenCalledWith(sinTurno.id, "1234");
    // El PIN bueno pasa la verificación y NO marca nada todavía
    expect(marcarQuiosco).not.toHaveBeenCalled();
  });

  it("en turno: deja elegir entre cerrar y almorzar", () => {
    render(<Quiosco {...props} personas={[enTurno]} />);
    fireEvent.click(screen.getByRole("button", { name: /Andrés Pardo/ }));
    expect(screen.getByText("¿Qué vas a marcar?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar turno" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salgo a almorzar" }));
    expect(screen.getByText(/salir a almorzar/)).toBeTruthy();
  });

  it("almuerzo: sin cámara; marca con el PIN y el listo dice la hora", async () => {
    vi.mocked(verificarPin).mockResolvedValue({ ok: true, mensaje: "" });
    vi.mocked(marcarQuiosco).mockResolvedValue({ ok: true, mensaje: "Regreso del almuerzo registrado a las 1:30 p. m." });
    render(<Quiosco {...props} personas={[almorzando]} />);
    fireEvent.click(screen.getByRole("button", { name: /Luisa Mora/ }));
    escribir("4321");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Listo, Luisa" })).toBeTruthy());
    expect(screen.getByText("Regreso del almuerzo registrado a las 1:30 p. m.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();

    // Marcar vuelve a mandar el PIN: la base lo valida otra vez. No viaja ninguna hora.
    const datos = vi.mocked(marcarQuiosco).mock.calls[0][0];
    expect(Object.fromEntries(datos)).toEqual({ perfil: almorzando.id, pin: "4321", accion: "pausa_fin" });
  });

  it("PIN equivocado: no marca, dice los intentos que quedan y borra lo escrito", async () => {
    vi.mocked(verificarPin).mockResolvedValue({ ok: false, mensaje: "PIN incorrecto. Te quedan 4 intentos." });
    render(<Quiosco {...props} personas={[sinTurno]} />);
    fireEvent.click(screen.getByRole("button", { name: /Camila Rojas/ }));
    escribir("0000");

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("PIN incorrecto. Te quedan 4 intentos."));
    expect(screen.getByRole("img", { name: "0 de 4 dígitos escritos" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(marcarQuiosco).not.toHaveBeenCalled();
  });

  it("si la base rechaza la marcación lo explica y deja volver a la lista", async () => {
    vi.mocked(verificarPin).mockResolvedValue({ ok: true, mensaje: "" });
    vi.mocked(marcarQuiosco).mockResolvedValue({ ok: false, mensaje: "No tienes una pausa abierta." });
    render(<Quiosco {...props} personas={[almorzando]} />);
    fireEvent.click(screen.getByRole("button", { name: /Luisa Mora/ }));
    escribir("4321");

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No tienes una pausa abierta."));
    fireEvent.click(screen.getByRole("button", { name: "Volver a la lista" }));
    expect(screen.getByText("Toca tu nombre para marcar")).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });

  it("si alguien se va a mitad del proceso, vuelve sola a la lista y no conserva el PIN", () => {
    vi.useFakeTimers();
    render(<Quiosco {...props} personas={[sinTurno]} />);
    fireEvent.click(screen.getByRole("button", { name: /Camila Rojas/ }));
    escribir("12");
    expect(screen.getByRole("img", { name: "2 de 4 dígitos escritos" })).toBeTruthy();

    act(() => vi.advanceTimersByTime(INACTIVIDAD_MS - 1));
    expect(screen.queryByText("Toca tu nombre para marcar")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Toca tu nombre para marcar")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Camila Rojas/ }));
    expect(screen.getByRole("img", { name: "0 de 4 dígitos escritos" })).toBeTruthy();
  });

  it("después del listo vuelve sola a la lista", async () => {
    vi.mocked(verificarPin).mockResolvedValue({ ok: true, mensaje: "" });
    vi.mocked(marcarQuiosco).mockResolvedValue({ ok: true, mensaje: "Regreso del almuerzo registrado a las 1:30 p. m." });
    render(<Quiosco {...props} personas={[almorzando]} />);
    fireEvent.click(screen.getByRole("button", { name: /Luisa Mora/ }));
    escribir("4321");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Listo, Luisa" })).toBeTruthy());

    await waitFor(() => expect(screen.getByText("Toca tu nombre para marcar")).toBeTruthy(), { timeout: LISTO_MS + 1500 });
    expect(refresh).toHaveBeenCalled();
  }, 10_000);

  it("sin conexión lo dice, no se queda colgada", async () => {
    vi.mocked(verificarPin).mockImplementation(() => Promise.reject(new Error("fetch failed")));
    render(<Quiosco {...props} personas={[sinTurno]} />);
    fireEvent.click(screen.getByRole("button", { name: /Camila Rojas/ }));
    escribir("1234");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/No hay conexión/));
  });
});
