"use client";

import { useState, useTransition } from "react";
import { Camara } from "@/components/camara";
import { llevaFoto, type Accion } from "@/lib/turnos";
import { marcar } from "./actions";
import { PantallaTurno, type AvisoTurno, type VistaTurno } from "./pantalla-turno";

type Props = {
  vista: VistaTurno;
  nombre: string;
  fecha: string;
  saludo: string;
  textoFoto: string;
};

export function MarcarTurno({ vista, nombre, fecha, saludo, textoFoto }: Props) {
  const [camara, setCamara] = useState<Accion | null>(null);
  const [aviso, setAviso] = useState<AvisoTurno | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(accion: Accion, foto?: Blob) {
    const datos = new FormData();
    datos.set("accion", accion);
    if (foto) datos.set("foto", new File([foto], "foto.jpg", { type: "image/jpeg" }));

    iniciar(async () => {
      try {
        setAviso(await marcar(datos));
      } catch {
        setAviso({ ok: false, mensaje: "No hay conexión. Revisa tu internet e intenta de nuevo." });
      }
      setCamara(null);
    });
  }

  function alTocar(accion: Accion) {
    setAviso(null);
    // Entrada y salida abren la cámara; el almuerzo son dos toques, sin foto.
    if (llevaFoto(accion)) setCamara(accion);
    else enviar(accion);
  }

  return (
    <>
      <PantallaTurno
        vista={vista}
        nombre={nombre}
        fecha={fecha}
        saludo={saludo}
        aviso={aviso}
        ocupado={enviando}
        onAccion={alTocar}
      />
      {camara && (
        <Camara
          titulo={camara === "entrada" ? "Foto de entrada" : "Foto de salida"}
          pie={textoFoto}
          enviando={enviando}
          onFoto={(foto) => enviar(camara, foto)}
          onCancelar={() => setCamara(null)}
        />
      )}
    </>
  );
}
