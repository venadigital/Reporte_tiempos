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
      <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-medium text-suave hover:text-tinta">
        Salir
      </button>
    </form>
  );

  if (!perfil.activo) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
        <h1 className="text-xl font-semibold">Tu cuenta está desactivada</h1>
        <p className="mt-2 mb-6 text-suave">Habla con el administrador para que la active de nuevo.</p>
        {salir}
      </main>
    );
  }

  const entradas = menu(perfil);

  return (
    <>
      <header className="border-b border-linea bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-2.5">
          <nav aria-label="Principal" className="flex flex-1 items-center gap-1 overflow-x-auto">
            {entradas.map((e) => (
              <EnlaceMenu key={e.href} href={e.href} texto={e.texto} />
            ))}
          </nav>
          <span className="hidden text-sm text-suave sm:inline">{perfil.nombre}</span>
          {salir}
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
