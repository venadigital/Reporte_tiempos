import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reporte de tiempos",
    short_name: "Turnos",
    description: "Marcación de turnos y reporte de horas del personal.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f2",
    theme_color: "#f5f5f2",
    lang: "es",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
