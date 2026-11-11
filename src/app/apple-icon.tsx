import { ImageResponse } from "next/og";
import { DibujoIcono } from "@/lib/icono";

// El ícono que usa iPhone al agregar la app a la pantalla de inicio.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function IconoApple() {
  return new ImageResponse(<DibujoIcono lado={size.width} />, { ...size });
}
