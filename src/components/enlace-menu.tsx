"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function EnlaceMenu({ href, texto }: { href: string; texto: string }) {
  const ruta = usePathname();
  const activo = ruta === href || ruta.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
        activo ? "bg-tinta text-white" : "text-suave hover:text-tinta"
      }`}
    >
      {texto}
    </Link>
  );
}
