import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// En iPhone y Mac se usa la tipografía del sistema; Inter cubre los demás equipos.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Reporte de tiempos", template: "%s · Reporte de tiempos" },
  description: "Marcación de turnos y reporte de horas del personal.",
  appleWebApp: { capable: true, title: "Turnos", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f2f2f7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
