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
      className={`rounded-[10px] px-3.5 py-2 text-[15px] whitespace-nowrap ${
        activo ? "bg-relleno font-semibold text-tinta" : "font-medium text-suave hover:text-tinta"
      }`}
    >
      {texto}
    </Link>
  );
}
