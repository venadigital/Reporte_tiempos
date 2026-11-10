// Crea el primer administrador principal. Se corre UNA vez, en tu computador:
//
//   node scripts/crear-admin.mjs
//
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local.
// Los demás empleados se crean después desde la pantalla "Empleados".

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

function leerEnv(archivo) {
  const env = {};
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

let env;
try {
  env = leerEnv(new URL("../.env.local", import.meta.url));
} catch {
  console.error("No encontré .env.local. Cópialo de .env.example y llena las llaves.");
  process.exit(1);
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const llave = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !llave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  console.error("La llave de servicio está en Supabase > Project Settings > API keys.");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const nombre = (await rl.question("Nombre completo: ")).trim();
const correo = (await rl.question("Correo: ")).trim().toLowerCase();
const clave = await rl.question("Contraseña (mínimo 8 caracteres; se verá mientras la escribes): ");
const marca = (await rl.question("¿Esta persona también marca turnos? (s/n): ")).trim().toLowerCase() === "s";
rl.close();

if (!nombre || !correo.includes("@") || clave.length < 8) {
  console.error("Datos incompletos: hacen falta nombre, un correo válido y una contraseña de 8 caracteres o más.");
  process.exit(1);
}

const supabase = createClient(url, llave, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await supabase.auth.admin.createUser({
  email: correo,
  password: clave,
  email_confirm: true,
  user_metadata: { nombre },
});
if (error || !data.user) {
  console.error("No se pudo crear la cuenta:", error?.message ?? "error desconocido");
  process.exit(1);
}

const { error: errorPerfil } = await supabase
  .from("profiles")
  .update({ nombre, role: "admin", marca_turno: marca })
  .eq("id", data.user.id);
if (errorPerfil) {
  console.error("La cuenta se creó, pero no se pudo volver administrador:", errorPerfil.message);
  process.exit(1);
}

console.log(`Listo. ${nombre} ya es administrador principal. Entra con ${correo}.`);
