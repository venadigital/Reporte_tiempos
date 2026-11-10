"use client";

// La cámara va en componentes separados de la pantalla de marcar para poder
// probarlos: dentro del componente grande solo se alcanzan tocando un botón, y un
// error aquí no lo vería nadie hasta que alguien fuera a marcar de verdad.

import { useEffect, useRef, useState, type RefObject } from "react";
import { FOTO_CALIDAD, FOTO_LADO_PX } from "@/lib/turnos";
import { botonPrincipal, botonSuave } from "@/components/ui";

export type FalloCamara = "bloqueada" | "sin_camara" | "ocupada" | "insegura" | "otro";

/** Traduce el error del navegador a uno de los casos que se le explican a la persona. */
export function clasificarFallo(error: unknown): FalloCamara {
  const nombre = (error as { name?: string } | null)?.name ?? "";
  switch (nombre) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "bloqueada";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "sin_camara";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "ocupada";
    default:
      return "otro";
  }
}

/** El navegador solo presta la cámara en conexiones seguras (https o localhost). */
export function camaraDisponible(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext !== false &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/** Recorte cuadrado desde el centro del video. */
export function recorteCuadrado(ancho: number, alto: number) {
  const lado = Math.min(ancho, alto);
  return { sx: Math.round((ancho - lado) / 2), sy: Math.round((alto - lado) / 2), lado };
}

export const TEXTOS_FALLO: Record<FalloCamara, { titulo: string; detalle: string; pasos?: string[] }> = {
  bloqueada: {
    titulo: "La cámara está bloqueada",
    detalle: "Sin la foto no se puede marcar: es la prueba de que fuiste tú.",
    pasos: [
      "Toca el candado de la barra de direcciones.",
      "Activa el permiso de Cámara.",
      "Vuelve aquí y toca «Intentar de nuevo».",
    ],
  },
  sin_camara: {
    titulo: "No encontramos la cámara",
    detalle: "Este aparato no tiene cámara disponible, o está desconectada.",
  },
  ocupada: {
    titulo: "La cámara está ocupada",
    detalle: "Otra aplicación la está usando. Ciérrala y vuelve a intentar.",
  },
  insegura: {
    titulo: "La cámara no está disponible aquí",
    detalle: "El navegador solo la permite en conexiones seguras (https).",
  },
  otro: {
    titulo: "No se pudo abrir la cámara",
    detalle: "Vuelve a intentar. Si sigue igual, marca en el computador compartido.",
  },
};

export const PIE_FALLO =
  "¿Sigue sin funcionar? Marca en el computador compartido con tu PIN. Cuenta igual.";

export function CamaraError({
  fallo,
  onReintentar,
  onCerrar,
}: {
  fallo: FalloCamara;
  onReintentar: () => void;
  onCerrar: () => void;
}) {
  const texto = TEXTOS_FALLO[fallo];
  return (
    <div role="alert" className="m-auto flex w-full max-w-sm flex-col gap-4 rounded-[28px] bg-white p-6 text-tinta">
      <h2 className="text-[22px] leading-7 font-bold tracking-[-0.3px]">{texto.titulo}</h2>
      <p className="text-base leading-[22px] text-suave">{texto.detalle}</p>
      {texto.pasos && (
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] leading-5">
          {texto.pasos.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
      )}
      <div className="mt-2 flex flex-col gap-2.5">
        <button type="button" onClick={onReintentar} className={botonPrincipal}>
          Intentar de nuevo
        </button>
        <button type="button" onClick={onCerrar} className={botonSuave}>
          Volver
        </button>
      </div>
      <p className="border-t border-linea pt-4 text-[13px] leading-[18px] text-suave">{PIE_FALLO}</p>
    </div>
  );
}

export function CamaraVisor({
  videoRef,
  titulo,
  lista,
  enviando,
  pie,
  onCapturar,
  onCancelar,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  titulo: string;
  lista: boolean;
  enviando: boolean;
  pie: string;
  onCapturar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-7 text-white">
      <header className="grid h-11 grid-cols-[1fr_auto_1fr] items-center">
        <button
          type="button"
          onClick={onCancelar}
          disabled={enviando}
          className="h-11 justify-self-start text-[17px] text-[#8ab8ff] disabled:opacity-40"
        >
          Cancelar
        </button>
        <h2 className="text-[17px] font-semibold">{titulo}</h2>
      </header>

      <div className="relative aspect-square w-full overflow-hidden rounded-[28px] bg-[#1c1c1e]">
        {/* El visor va espejado, como un espejo; la foto se guarda sin espejo. */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Vista de la cámara"
          className="h-full w-full -scale-x-100 object-cover"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[20%] inset-y-[10%] rounded-[50%] border-2 border-dashed border-white/85"
        />
        {!lista && (
          <p className="absolute inset-0 flex items-center justify-center bg-black/60 text-[15px]">Abriendo la cámara…</p>
        )}
      </div>

      <p className="text-center text-xl leading-[26px] font-semibold">Centra tu cara en el óvalo</p>

      <div className="mt-auto flex flex-col items-center gap-5">
        <button
          type="button"
          onClick={onCapturar}
          disabled={!lista || enviando}
          aria-label="Tomar la foto"
          className="flex h-[84px] w-[84px] items-center justify-center rounded-full border-4 border-white transition-transform active:scale-95 disabled:opacity-40"
        >
          <span className="h-[66px] w-[66px] rounded-full bg-white" />
        </button>
        <p className="px-3 text-center text-[13px] leading-[18px] text-[#c7c7cc]" aria-live="polite">
          {enviando ? "Registrando…" : pie}
        </p>
      </div>
    </div>
  );
}

/** Abre la cámara frontal, toma una foto cuadrada y la entrega como JPEG. */
export function Camara({
  titulo,
  pie,
  enviando,
  onFoto,
  onCancelar,
}: {
  titulo: string;
  pie: string;
  enviando: boolean;
  onFoto: (foto: Blob) => void;
  onCancelar: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [intento, setIntento] = useState(0);
  const [fase, setFase] = useState<"abriendo" | "lista" | FalloCamara>(() =>
    camaraDisponible() ? "abriendo" : "insegura",
  );

  useEffect(() => {
    if (!camaraDisponible()) return;
    let cancelado = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(async (stream) => {
        if (cancelado) {
          stream.getTracks().forEach((pista) => pista.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          try {
            await video.play();
          } catch {
            // Con autoPlay el video arranca solo; un play() rechazado no es un fallo de cámara.
          }
        }
        if (!cancelado) setFase("lista");
      })
      .catch((error) => {
        if (!cancelado) setFase(clasificarFallo(error));
      });

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((pista) => pista.stop());
      streamRef.current = null;
    };
  }, [intento]);

  function capturar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const { sx, sy, lado } = recorteCuadrado(video.videoWidth, video.videoHeight);
    const lienzo = document.createElement("canvas");
    lienzo.width = FOTO_LADO_PX;
    lienzo.height = FOTO_LADO_PX;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return;
    // Sin espejo: lo que se guarda es la imagen real.
    ctx.drawImage(video, sx, sy, lado, lado, 0, 0, FOTO_LADO_PX, FOTO_LADO_PX);
    lienzo.toBlob((foto) => foto && onFoto(foto), "image/jpeg", FOTO_CALIDAD);
  }

  function reintentar() {
    setFase(camaraDisponible() ? "abriendo" : "insegura");
    setIntento((n) => n + 1);
  }

  const fallo = fase !== "abriendo" && fase !== "lista" ? fase : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-black px-5 pt-6 pb-9"
    >
      {fallo ? (
        <CamaraError fallo={fallo} onReintentar={reintentar} onCerrar={onCancelar} />
      ) : (
        <CamaraVisor
          videoRef={videoRef}
          titulo={titulo}
          lista={fase === "lista"}
          enviando={enviando}
          pie={pie}
          onCapturar={capturar}
          onCancelar={onCancelar}
        />
      )}
    </div>
  );
}
