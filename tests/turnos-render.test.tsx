import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PantallaNoMarca, PantallaTurno, type VistaTurno } from "@/app/(app)/turnos/pantalla-turno";
import { MarcarTurno } from "@/app/(app)/turnos/marcar-turno";
import { marcar } from "@/app/(app)/turnos/actions";
import {
  Camara,
  CamaraError,
  CamaraVisor,
  PIE_FALLO,
  TEXTOS_FALLO,
  clasificarFallo,
  recorteCuadrado,
  type FalloCamara,
} from "@/components/camara";

vi.mock("@/app/(app)/turnos/actions", () => ({ marcar: vi.fn() }));

const ENTRADA = { prefijo: "a las", hora: "7:02", periodo: "a. m." };
const SALIO = { prefijo: "a las", hora: "12:31", periodo: "p. m." };
const comunes = { nombre: "Camila", fecha: "miércoles 26 de agosto", saludo: "Buenos días", aviso: null, ocupado: false };
const pinta = (vista: VistaTurno, onAccion = vi.fn()) => {
  render(<PantallaTurno {...comunes} vista={vista} onAccion={onAccion} />);
  return onAccion;
};
const boton = (nombre: RegExp | string) => screen.queryByRole("button", { name: nombre });

describe("Mi turno: cada estado se pinta bien", () => {
  it("sin turno: saludo, botón de iniciar y recordatorio", () => {
    const onAccion = pinta({ tipo: "sin_turno", pendiente: null });
    expect(screen.getByRole("heading", { name: "Buenos días, Camila" })).toBeTruthy();
    expect(screen.getByText("Se abre la cámara para tu foto de entrada.")).toBeTruthy();
    expect(screen.getByText("Marca al llegar, al salir a almorzar, al regresar y al irte.")).toBeTruthy();
    expect(boton("Cerrar turno")).toBeNull();
    fireEvent.click(boton("Iniciar turno")!);
    expect(onAccion).toHaveBeenCalledWith("entrada");
  });

  it("sin turno, con uno anterior sin cerrar: lo explica y deja iniciar el de hoy", () => {
    pinta({ tipo: "sin_turno", pendiente: "ayer a las 10:02 p. m." });
    expect(screen.getByText(/empezó ayer a las 10:02 p. m. quedó sin cerrar/)).toBeTruthy();
    expect(boton("Iniciar turno")).toBeTruthy();
  });

  it("en turno: dice desde cuándo y ofrece cerrar o almorzar", () => {
    const onAccion = pinta({ tipo: "en_turno", entrada: ENTRADA });
    expect(screen.getByText("Turno abierto")).toBeTruthy();
    expect(screen.getByText("Entraste a las")).toBeTruthy();
    expect(document.body.textContent).toContain("7:02 a. m.");
    expect(boton("Iniciar turno")).toBeNull();
    fireEvent.click(boton("Cerrar turno")!);
    fireEvent.click(boton("Salgo a almorzar")!);
    expect(onAccion.mock.calls.map((c) => c[0])).toEqual(["salida", "pausa_inicio"]);
  });

  it("turno de noche: dice que entró ayer", () => {
    pinta({ tipo: "en_turno", entrada: { prefijo: "ayer a las", hora: "10:02", periodo: "p. m." } });
    expect(screen.getByText("Entraste ayer a las")).toBeTruthy();
    expect(document.body.textContent).toContain("10:02 p. m.");
  });

  it("en almuerzo: SOLO regresar, y explica por qué no se puede cerrar", () => {
    const onAccion = pinta({ tipo: "en_almuerzo", salio: SALIO });
    expect(screen.getByText("Turno en pausa")).toBeTruthy();
    expect(screen.getByText("Saliste a almorzar a las")).toBeTruthy();
    expect(document.body.textContent).toContain("12:31 p. m.");
    expect(screen.getByText("Este tiempo no cuenta como trabajado.")).toBeTruthy();
    expect(screen.getByText(/No se puede cerrar el turno con el almuerzo abierto/)).toBeTruthy();
    expect(boton("Cerrar turno")).toBeNull();
    expect(boton("Salgo a almorzar")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(boton("Regresé del almuerzo")!);
    expect(onAccion).toHaveBeenCalledWith("pausa_fin");
  });

  it("la confirmación se anuncia; el error, como alerta", () => {
    const { rerender } = render(
      <PantallaTurno {...comunes} vista={{ tipo: "en_turno", entrada: ENTRADA }} onAccion={vi.fn()}
        aviso={{ ok: true, mensaje: "Turno iniciado a las 7:02 a. m." }} />,
    );
    expect(screen.getByRole("status").textContent).toBe("Turno iniciado a las 7:02 a. m.");
    rerender(
      <PantallaTurno {...comunes} vista={{ tipo: "en_turno", entrada: ENTRADA }} onAccion={vi.fn()}
        aviso={{ ok: false, mensaje: "Primero marca tu regreso del almuerzo." }} />,
    );
    expect(screen.getByRole("alert").textContent).toBe("Primero marca tu regreso del almuerzo.");
  });

  it("la pantalla del empleado nunca muestra horas acumuladas", () => {
    for (const vista of [
      { tipo: "sin_turno", pendiente: null },
      { tipo: "en_turno", entrada: ENTRADA },
      { tipo: "en_almuerzo", salio: SALIO },
    ] as VistaTurno[]) {
      const { container, unmount } = render(<PantallaTurno {...comunes} vista={vista} onAccion={vi.fn()} />);
      expect(container.textContent).not.toMatch(/horas|total|extra|semana|quincena|\d+:\d\d h/i);
      unmount();
    }
  });

  it("cuenta que no marca: lo dice y no ofrece botones", () => {
    render(<PantallaNoMarca />);
    expect(screen.getByRole("heading", { name: "Tu cuenta no registra turnos" })).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("Mi turno: marcar", () => {
  const props = { nombre: "Camila", fecha: "miércoles 26 de agosto", saludo: "Buenos días", textoFoto: "La foto se guarda 45 días." };
  beforeEach(() => {
    vi.mocked(marcar).mockClear();
  });

  it("el almuerzo son dos toques, sin cámara, y confirma con la hora", async () => {
    vi.mocked(marcar).mockResolvedValue({ ok: true, mensaje: "Salida a almorzar registrada a las 12:31 p. m." });
    render(<MarcarTurno {...props} vista={{ tipo: "en_turno", entrada: ENTRADA }} />);
    fireEvent.click(boton("Salgo a almorzar")!);

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("12:31 p. m."));
    expect(screen.queryByRole("dialog")).toBeNull();
    const datos = vi.mocked(marcar).mock.calls[0][0];
    expect(datos.get("accion")).toBe("pausa_inicio");
    // No viaja ninguna hora ni ninguna foto en el formulario
    expect([...datos.keys()]).toEqual(["accion"]);
  });

  it("la entrada abre la cámara y no marca hasta que haya foto", () => {
    render(<MarcarTurno {...props} vista={{ tipo: "sin_turno", pendiente: null }} />);
    fireEvent.click(boton("Iniciar turno")!);
    expect(screen.getByRole("dialog", { name: "Foto de entrada" })).toBeTruthy();
    expect(marcar).not.toHaveBeenCalled();
  });

  it("si la base rechaza la marcación, muestra su mensaje", async () => {
    vi.mocked(marcar).mockResolvedValue({ ok: false, mensaje: "No tienes un turno abierto." });
    render(<MarcarTurno {...props} vista={{ tipo: "en_turno", entrada: ENTRADA }} />);
    fireEvent.click(boton("Salgo a almorzar")!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("No tienes un turno abierto."));
  });

  it("sin conexión lo dice, no se queda colgada", async () => {
    vi.mocked(marcar).mockImplementation(() => Promise.reject(new Error("fetch failed")));
    render(<MarcarTurno {...props} vista={{ tipo: "en_turno", entrada: ENTRADA }} />);
    fireEvent.click(boton("Salgo a almorzar")!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/No hay conexión/));
  });
});

describe("cámara", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  const conCamara = (getUserMedia: unknown) =>
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  afterEach(() => {
    if (original) Object.defineProperty(navigator, "mediaDevices", original);
    else delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  });
  const error = (name: string) => Object.assign(new Error(name), { name });

  it("traduce el error del navegador a un caso que se le puede explicar a la persona", () => {
    expect(clasificarFallo(error("NotAllowedError"))).toBe("bloqueada");
    expect(clasificarFallo(error("NotFoundError"))).toBe("sin_camara");
    expect(clasificarFallo(error("NotReadableError"))).toBe("ocupada");
    expect(clasificarFallo(error("OtraCosa"))).toBe("otro");
    expect(clasificarFallo(null)).toBe("otro");
  });

  it("cada fallo se explica distinto; solo el bloqueo muestra los pasos", () => {
    const fallos: FalloCamara[] = ["bloqueada", "sin_camara", "ocupada", "insegura", "otro"];
    expect(new Set(fallos.map((f) => TEXTOS_FALLO[f].titulo)).size).toBe(5);
    for (const fallo of fallos) {
      const { unmount } = render(<CamaraError fallo={fallo} onReintentar={vi.fn()} onCerrar={vi.fn()} />);
      expect(screen.getByRole("heading", { name: TEXTOS_FALLO[fallo].titulo })).toBeTruthy();
      expect(screen.queryAllByRole("listitem").length > 0).toBe(fallo === "bloqueada");
      // Todos ofrecen la misma salida: el computador compartido
      expect(screen.getByText(PIE_FALLO)).toBeTruthy();
      unmount();
    }
  });

  it("el visor va espejado y no deja tomar la foto hasta que la cámara abre", () => {
    const onCapturar = vi.fn();
    const ref = { current: null };
    const { rerender } = render(
      <CamaraVisor titulo="Foto de entrada" videoRef={ref} lista={false} enviando={false} pie="pie" onCapturar={onCapturar} onCancelar={vi.fn()} />,
    );
    const disparador = () => screen.getByRole("button", { name: "Tomar la foto" }) as HTMLButtonElement;
    expect(disparador().disabled).toBe(true);
    expect(screen.getByLabelText("Vista de la cámara").className).toContain("-scale-x-100");

    rerender(<CamaraVisor titulo="Foto de entrada" videoRef={ref} lista enviando={false} pie="pie" onCapturar={onCapturar} onCancelar={vi.fn()} />);
    expect(disparador().disabled).toBe(false);
    fireEvent.click(disparador());
    expect(onCapturar).toHaveBeenCalledOnce();

    rerender(<CamaraVisor titulo="Foto de entrada" videoRef={ref} lista enviando pie="pie" onCapturar={onCapturar} onCancelar={vi.fn()} />);
    expect(disparador().disabled).toBe(true);
    expect(screen.getByText("Registrando…")).toBeTruthy();
  });

  it("recorta un cuadrado desde el centro del video", () => {
    expect(recorteCuadrado(1280, 720)).toEqual({ sx: 280, sy: 0, lado: 720 });
    expect(recorteCuadrado(480, 640)).toEqual({ sx: 0, sy: 80, lado: 480 });
  });

  it("sin conexión segura (o sin cámara en el navegador) lo explica", () => {
    delete (navigator as unknown as Record<string, unknown>).mediaDevices;
    render(<Camara titulo="Foto de entrada" pie="pie" enviando={false} onFoto={vi.fn()} onCancelar={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "La cámara no está disponible aquí" })).toBeTruthy();
  });

  it("permiso negado: dice que está bloqueada y permite reintentar", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(error("NotAllowedError"));
    conCamara(getUserMedia);
    render(<Camara titulo="Foto de entrada" pie="pie" enviando={false} onFoto={vi.fn()} onCancelar={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "La cámara está bloqueada" })).toBeTruthy();
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: "user" }, audio: false });

    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });

  it("al cerrar apaga la cámara", async () => {
    const stop = vi.fn();
    conCamara(vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }));
    const { unmount } = render(<Camara titulo="Foto de entrada" pie="pie" enviando={false} onFoto={vi.fn()} onCancelar={vi.fn()} />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Tomar la foto" }) as HTMLButtonElement).disabled).toBe(false));
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
