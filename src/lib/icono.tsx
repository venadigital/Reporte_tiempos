// El ícono de la app, dibujado con código para no guardar imágenes en el repositorio.
// Fondo de borde a borde: iPhone y Android recortan las esquinas por su cuenta, y el
// reloj queda dentro de la zona segura para los íconos "maskable".

export function DibujoIcono({ lado }: { lado: number }) {
  const reloj = Math.round(lado * 0.56);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a5fd9",
      }}
    >
      <svg width={reloj} height={reloj} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    </div>
  );
}
