import { redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { menu } from "@/lib/auth/permisos";
import { cerrarSesion } from "@/app/login/actions";
import { EnlaceMenu } from "@/components/enlace-menu";

export default async function MarcoApp({ children }: { children: React.ReactNode }) {
  const perfil = await exigirPerfil();

  // El quiosco es un aparato de una sola función: no abre nada más.
  if (perfil.activo && perfil.role === "quiosco") redirect("/quiosco");

  const salir = (
    <form action={cerrarSesion}>
      <button type="submit" className="min-h-11 px-1 text-[15px] font-medium text-accion hover:text-accion-fuerte">
        Salir
      </button>
    </form>
  );

  if (!perfil.activo) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-2 px-6 py-12">
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.4px]">Tu cuenta está desactivada</h1>
        <p className="mb-4 text-base text-suave">Habla con el administrador para que la active de nuevo.</p>
        {salir}
      </main>
    );
  }

  const entradas = menu(perfil);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-linea bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1120px] items-center gap-x-5 gap-y-2 px-4 py-1.5 sm:px-6">
          <nav aria-label="Principal" className="flex flex-1 items-center gap-1 overflow-x-auto">
            {entradas.map((e) => (
              <EnlaceMenu key={e.href} href={e.href} texto={e.texto} />
            ))}
          </nav>
          <span className="hidden text-[15px] text-suave sm:inline">{perfil.nombre}</span>
          {salir}
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
