import { ImageResponse } from "next/og";
import { DibujoIcono } from "@/lib/icono";

// Íconos PNG del manifiesto, para instalar la app en Android y en computador.
const LADOS = [192, 512];

export function generateStaticParams() {
  return LADOS.map((lado) => ({ lado: String(lado) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ lado: string }> }) {
  const lado = Number((await params).lado);
  if (!LADOS.includes(lado)) return new Response("No encontrado", { status: 404 });
  return new ImageResponse(<DibujoIcono lado={lado} />, { width: lado, height: lado });
}
