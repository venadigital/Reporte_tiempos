"use client";

// El quiosco: lista → acción → PIN → cámara → listo. Un aparato de una sola función.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camara } from "@/components/camara";
import { llevaFoto, type Accion } from "@/lib/turnos";
import { INACTIVIDAD_MS, LISTO_MS, PIN_LARGO, REFRESCO_LISTA_MS, type PersonaVista } from "@/lib/quiosco";
import { marcarQuiosco, verificarPin } from "./actions";
import { ElegirAccion, Fallo, ListaPersonas, Listo, TecladoPin } from "./vistas";

type Paso = "lista" | "accion" | "pin" | "camara" | "listo" | "fallo";

const SIN_CONEXION = "No hay conexión. Revisa el internet del equipo e intenta de nuevo.";

export function Quiosco({ personas, zona, textoFoto }: { personas: PersonaVista[]; zona: string; textoFoto: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("lista");
  const [persona, setPersona] = useState<PersonaVista | null>(null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const volver = useCallback(() => {
    setPaso("lista");
    setPersona(null);
    setAccion(null);
    setPin(""); // nunca queda un PIN a medio escribir
    setError(null);
    setMensaje("");
    router.refresh();
  }, [router]);

  // Si alguien se va a mitad del proceso, la pantalla vuelve sola a la lista.
  useEffect(() => {
    if (paso === "lista" || ocupado) return;
    const id = setTimeout(volver, paso === "listo" ? LISTO_MS : INACTIVIDAD_MS);
    return () => clearTimeout(id);
  }, [paso, pin, error, ocupado, volver]);

  // La lista se mantiene al día aunque nadie la toque.
  useEffect(() => {
    if (paso !== "lista") return;
    const id = setInterval(() => router.refresh(), REFRESCO_LISTA_MS);
    return () => clearInterval(id);
  }, [paso, router]);

  function elegir(p: PersonaVista) {
    setPersona(p);
    setPin("");
    setError(null);
    // Si solo hay una acción posible, el paso de elegir se salta.
    if (p.acciones.length === 1) {
      setAccion(p.acciones[0]);
      setPaso("pin");
    } else {
      setPaso("accion");
    }
  }

  async function enviar(p: PersonaVista, a: Accion, pinEscrito: string, foto?: Blob) {
    const datos = new FormData();
    datos.set("perfil", p.id);
    datos.set("pin", pinEscrito);
    datos.set("accion", a);
    if (foto) datos.set("foto", new File([foto], "foto.jpg", { type: "image/jpeg" }));

    setOcupado(true);
    let resultado: { ok: boolean; mensaje: string };
    try {
      resultado = await marcarQuiosco(datos);
    } catch {
      resultado = { ok: false, mensaje: SIN_CONEXION };
    }
    setOcupado(false);
    setPin("");
    setMensaje(resultado.mensaje);
    setPaso(resultado.ok ? "listo" : "fallo");
  }

  async function teclear(digito: string) {
    if (ocupado || !persona || !accion || pin.length >= PIN_LARGO) return;
    const escrito = pin + digito;
    setPin(escrito);
    setError(null);
    if (escrito.length < PIN_LARGO) return;

    // Al cuarto dígito se verifica solo, ANTES de abrir la cámara.
    setOcupado(true);
    let resultado: { ok: boolean; mensaje: string };
    try {
      resultado = await verificarPin(persona.id, escrito);
    } catch {
      resultado = { ok: false, mensaje: SIN_CONEXION };
    }
    setOcupado(false);

    if (!resultado.ok) {
      setPin("");
      setError(resultado.mensaje);
    } else if (llevaFoto(accion)) {
      setPaso("camara");
    } else {
      await enviar(persona, accion, escrito);
    }
  }

  if (paso === "lista" || !persona) return <ListaPersonas personas={personas} zona={zona} onElegir={elegir} />;

  if (paso === "accion") {
    return (
      <ElegirAccion
        persona={persona}
        onAccion={(a) => {
          setAccion(a);
          setPaso("pin");
        }}
        onCancelar={volver}
      />
    );
  }

  if (paso === "listo") return <Listo persona={persona} mensaje={mensaje} />;
  if (paso === "fallo" || !accion) return <Fallo mensaje={mensaje} onVolver={volver} />;

  if (paso === "camara") {
    return (
      <Camara
        titulo={accion === "entrada" ? "Foto de entrada" : "Foto de salida"}
        pie={textoFoto}
        enviando={ocupado}
        onFoto={(foto) => enviar(persona, accion, pin, foto)}
        onCancelar={volver}
      />
    );
  }

  return (
    <TecladoPin
      persona={persona}
      accion={accion}
      pin={pin}
      error={error}
      ocupado={ocupado}
      onDigito={teclear}
      onBorrar={() => !ocupado && setPin((p) => p.slice(0, -1))}
      onCancelar={volver}
    />
  );
}
