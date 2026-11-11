import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { COLUMNAS_VACIAS, type Aviso } from "@/lib/horas";
import { PorRevisar, SelectorPeriodo, TablaHoras, type FilaTabla } from "@/app/(app)/horas/vistas";
import { Composicion, SemanaASemana, TablaTurnos, type TurnoVista } from "@/app/(app)/horas/vistas-detalle";

vi.mock("next/link", () => ({
  default: ({ href, children, ...resto }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...resto}>{children}</a>
  ),
}));

const rotulos = { nocturno: "+35 %", extraDiurna: "+25 %", extraNocturna: "+75 %", dominical: "+90 %" };
const filas: FilaTabla[] = [
  { id: "a", nombre: "Camila Rojas", cargo: "Recepción", turnos: 11, columnas: { ...COLUMNAS_VACIAS, diurnas: 4620, extraDiurnas: 150, dominicales: 420, total: 5190 } },
  { id: "b", nombre: "Luisa Mora", cargo: "Coordinación", turnos: 10, columnas: { ...COLUMNAS_VACIAS, diurnas: 4200, total: 4200 } },
  { id: "c", nombre: "Iván Soto", cargo: null, turnos: 0, columnas: COLUMNAS_VACIAS },
];

describe("tabla de horas del personal", () => {
  it("muestra las cifras del cálculo columna por columna, con el recargo como rótulo", () => {
    render(<TablaHoras filas={filas} rotulos={rotulos} detalle={(id) => `/horas/${id}`} />);
    const camila = screen.getByRole("row", { name: /Camila Rojas/ });
    expect(within(camila).getAllByRole("cell").map((c) => c.textContent)).toEqual(
      ["77:00", "—", "2:30", "—", "7:00", "—", "86:30", "Detalle de Camila Rojas"],
    );
    expect(within(camila).getByText("Recepción · 11 turnos")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Dominicales.*\+90 %/ })).toBeTruthy();
    expect((within(camila).getByRole("link") as HTMLAnchorElement).getAttribute("href")).toBe("/horas/a");
  });

  it("quien no tiene horas aparece igual, en ceros: es información", () => {
    render(<TablaHoras filas={filas} rotulos={rotulos} detalle={(id) => `/horas/${id}`} />);
    const ivan = screen.getByRole("row", { name: /Iván Soto/ });
    expect(within(ivan).getByText("sin turnos")).toBeTruthy();
    expect(within(ivan).getAllByRole("cell").slice(0, 7).every((c) => c.textContent === "—")).toBe(true);
  });

  it("no hay fila de total general y las filas con extras van resaltadas", () => {
    render(<TablaHoras filas={filas} rotulos={rotulos} detalle={(id) => `/horas/${id}`} />);
    expect(screen.getAllByRole("row")).toHaveLength(1 + filas.length);
    expect(screen.queryByText(/total general/i)).toBeNull();
    expect(screen.getByRole("row", { name: /Camila Rojas/ }).className).toContain("bg-[#fff8ea]");
    expect(screen.getByRole("row", { name: /Luisa Mora/ }).className).not.toContain("bg-[#fff8ea]");
  });

  it("sin nadie que marque lo dice; no sale una tabla vacía", () => {
    render(<TablaHoras filas={[]} rotulos={rotulos} detalle={(id) => `/horas/${id}`} />);
    expect(screen.getByText(/Todavía no hay personas que registren turnos/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("por revisar", () => {
  const aviso: Aviso = {
    clave: "abierto-7", nivel: "rojo", perfilId: "a", nombre: "Andrés Pardo",
    texto: "no cerró el turno del lunes 9 de noviembre. No suma horas hasta que se corrija.",
    periodo: { tipo: "q1", ym: "2026-11" },
  };

  it("avisa con nombre y día, y lleva al detalle de la persona", () => {
    render(<PorRevisar avisos={[aviso]} enlace={(a) => `/horas/${a.perfilId}?ym=${a.periodo.ym}`} />);
    expect(screen.getByText("Por revisar · 1")).toBeTruthy();
    expect(screen.getByText("Andrés Pardo")).toBeTruthy();
    expect(screen.getByText(/no cerró el turno del lunes 9 de noviembre/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "Urgente" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ver/ }).getAttribute("href")).toBe("/horas/a?ym=2026-11");
  });

  it("si no hay nada que revisar, la tarjeta no aparece", () => {
    const { container } = render(<PorRevisar avisos={[]} />);
    expect(container.textContent).toBe("");
  });
});

describe("selector de periodo", () => {
  it("marca el periodo activo y cada opción conserva el mes", () => {
    render(<SelectorPeriodo periodo={{ tipo: "q2", ym: "2026-12" }} base="/horas" />);
    expect(screen.getByRole("link", { name: "Quincena 2" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "Mes completo" }).getAttribute("href")).toBe("/horas?periodo=mes&ym=2026-12");
    expect(screen.getByText("Diciembre 2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mes siguiente" }).getAttribute("href")).toBe("/horas?periodo=q2&ym=2027-01");
  });
});

describe("detalle de una persona", () => {
  const base: TurnoVista = {
    id: 1, dia: "Lun 2 nov", entrada: "10:02 p. m.", salida: "6:14 a. m.", estado: "cerrado",
    almuerzoMin: 30, almuerzoAbierto: false, trabajadasMin: 462, fotos: [], sinFotos: "Foto vencida",
    origen: "Quiosco", motivo: null,
  };
  const turnos: TurnoVista[] = [
    base,
    { ...base, id: 2, dia: "Lun 9 nov", salida: null, estado: "sin_cerrar", almuerzoMin: 0, trabajadasMin: null, origen: "Con su usuario" },
    { ...base, id: 3, dia: "Mar 10 nov", salida: null, estado: "en_curso", almuerzoMin: 0, trabajadasMin: null },
    { ...base, id: 4, dia: "Mié 11 nov", sinFotos: "Sin foto", origen: "Corregido a mano", motivo: "Se fue la luz" },
  ];
  const pinta = (enlace?: (id: number) => string) =>
    render(<TablaTurnos turnos={turnos} nombre="Jorge Niño" leyendaFoto="leyenda" enlaceCorregir={enlace} />);

  it("un turno cerrado muestra entrada, salida, almuerzo y horas", () => {
    pinta((id) => `/c/${id}`);
    const fila = screen.getByRole("row", { name: /Lun 2 nov/ });
    expect(fila.textContent).toContain("10:02 p. m. – 6:14 a. m.");
    expect(fila.textContent).toContain("0:30");
    expect(fila.textContent).toContain("7:42");
    expect(within(fila).getByRole("link").textContent).toContain("Corregir");
  });

  it("un turno sin cerrar no suma y pide ponerle la salida", () => {
    pinta((id) => `/c/${id}`);
    const fila = screen.getByRole("row", { name: /Lun 9 nov/ });
    expect(within(fila).getByText("sin cerrar")).toBeTruthy();
    expect(within(fila).getByText("No suma")).toBeTruthy();
    const enlace = within(fila).getByRole("link");
    expect(enlace.textContent).toContain("Poner salida");
    expect(enlace.getAttribute("href")).toBe("/c/2");
  });

  it("hoy sin salida es 'en curso', no 'sin cerrar'", () => {
    pinta((id) => `/c/${id}`);
    const fila = screen.getByRole("row", { name: /Mar 10 nov/ });
    expect(within(fila).getByText("en curso")).toBeTruthy();
    expect(within(fila).queryByText("No suma")).toBeNull();
  });

  it("un turno creado a mano dice 'sin foto' y trae el motivo", () => {
    pinta();
    const fila = screen.getByRole("row", { name: /Mié 11 nov/ });
    expect(within(fila).getByText("Sin foto")).toBeTruthy();
    expect(within(fila).getByText("Motivo: Se fue la luz")).toBeTruthy();
    expect(within(fila).getByText("Corregido a mano")).toBeTruthy();
  });

  it("al coordinador no le aparecen los botones de corregir", () => {
    pinta();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText("Corregir")).toBeNull();
    expect(screen.queryByText("Poner salida")).toBeNull();
  });

  it("un periodo sin turnos no falla y lo dice", () => {
    render(<TablaTurnos turnos={[]} nombre="Jorge Niño" leyendaFoto="leyenda" />);
    expect(screen.getByText("No hay turnos en este periodo.")).toBeTruthy();
  });

  it("la composición dice cuánto lleva cada recargo", () => {
    render(<Composicion columnas={{ ...COLUMNAS_VACIAS, nocturnas: 3240, extraNocturnas: 1490, total: 4730 }} />);
    expect(screen.getByRole("img", { name: "Nocturnas 54:00, Extra nocturnas 24:50" })).toBeTruthy();
    expect(screen.queryByText("Diurnas")).toBeNull();
  });

  it("semana a semana marca la que pasó el tope legal de extras", () => {
    render(
      <SemanaASemana
        topeExtraMin={720}
        semanas={[
          { semana: "2026-10-26", ordinarias: 480, extra: 0, total: 480 },
          { semana: "2026-11-02", ordinarias: 2520, extra: 1490, total: 4010 },
        ]}
      />,
    );
    expect(screen.getByText("26 oct – 1 nov")).toBeTruthy();
    expect(screen.getByText("8:00 ordinarias")).toBeTruthy();
    expect(screen.getByText("42:00 ordinarias + 24:50 extra")).toBeTruthy();
    expect(screen.getAllByText("Pasó el tope legal de extras: 12:00")).toHaveLength(1);
  });
});
