"use client";

import { useRef } from "react";

/**
 * Miniatura de la foto de una marcación; al tocarla se abre grande.
 * Las fotos privadas NO pasan por el optimizador de imágenes: se pintan con una
 * etiqueta de imagen simple y el enlace firmado, que vence.
 */
export function FotoTurno({ url, titulo, detalle, leyenda }: { url: string; titulo: string; detalle: string; leyenda: string }) {
  const dialogo = useRef<HTMLDialogElement | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        aria-label={`Ver la ${titulo.toLowerCase()}`}
        className="h-11 w-11 overflow-hidden rounded-[10px] bg-pausa-fondo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
      </button>
      <dialog
        ref={dialogo}
        aria-label={titulo}
        onClick={(e) => e.target === dialogo.current && dialogo.current?.close()}
        className="m-auto w-[min(92vw,480px)] rounded-[28px] bg-white p-0 text-tinta backdrop:bg-black/60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`${titulo}. ${detalle}`} className="aspect-square w-full object-cover" />
        <div className="flex flex-col gap-2 p-5">
          <p className="text-[17px] font-semibold">{titulo}</p>
          <p className="text-[15px] text-suave">{detalle}</p>
          <p className="text-[13px] leading-[18px] text-suave">{leyenda}</p>
          <form method="dialog" className="mt-2">
            <button className="flex h-12 w-full items-center justify-center rounded-2xl bg-accion-suave text-[17px] font-semibold text-accion">
              Cerrar
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
