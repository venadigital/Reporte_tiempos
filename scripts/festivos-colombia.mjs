// Genera los festivos nacionales de Colombia como SQL para una migración.
// Uso:  node scripts/festivos-colombia.mjs 2026 2035 > supabase/migrations/<marca>_festivos.sql
//
// Reglas: Ley 51 de 1983 ("Ley Emiliani") y la fecha de Pascua.
// Las fechas quedan escritas una por una en la tabla para poder auditarlas
// contra cualquier calendario; no se calculan al vuelo.

const [desde, hasta] = process.argv.slice(2).map(Number);
if (!desde || !hasta || hasta < desde) {
  console.error("Uso: node scripts/festivos-colombia.mjs <año inicial> <año final>");
  process.exit(1);
}

const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const sumar = (fecha, dias) => new Date(fecha.getTime() + dias * 86_400_000);
const iso = (fecha) => fecha.toISOString().slice(0, 10);

// Domingo de Pascua (algoritmo gregoriano anónimo / Meeus)
function pascua(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, mes, dia);
}

// Ley Emiliani: si no cae en lunes, se corre al lunes siguiente
function alLunes(fecha) {
  const dow = fecha.getUTCDay(); // 0 = domingo … 1 = lunes
  return dow === 1 ? fecha : sumar(fecha, (8 - dow) % 7);
}

function festivos(y) {
  const p = pascua(y);
  return [
    // Fijos
    [utc(y, 1, 1), "Año Nuevo"],
    [utc(y, 5, 1), "Día del Trabajo"],
    [utc(y, 7, 20), "Día de la Independencia"],
    [utc(y, 8, 7), "Batalla de Boyacá"],
    [utc(y, 12, 8), "Inmaculada Concepción"],
    [utc(y, 12, 25), "Navidad"],
    // Se corren al lunes
    [alLunes(utc(y, 1, 6)), "Reyes Magos"],
    [alLunes(utc(y, 3, 19)), "San José"],
    [alLunes(utc(y, 6, 29)), "San Pedro y San Pablo"],
    [alLunes(utc(y, 8, 15)), "Asunción de la Virgen"],
    [alLunes(utc(y, 10, 12)), "Día de la Raza"],
    [alLunes(utc(y, 11, 1)), "Todos los Santos"],
    [alLunes(utc(y, 11, 11)), "Independencia de Cartagena"],
    // Dependen de la Pascua
    [sumar(p, -3), "Jueves Santo"],
    [sumar(p, -2), "Viernes Santo"],
    [sumar(p, 43), "Ascensión del Señor"],
    [sumar(p, 64), "Corpus Christi"],
    [sumar(p, 71), "Sagrado Corazón"],
  ];
}

// Dos festivos pueden caer el mismo día (2030: San Pedro y Sagrado Corazón): se fusionan
const porFecha = new Map();
for (let y = desde; y <= hasta; y++) {
  for (const [fecha, nombre] of festivos(y)) {
    const clave = iso(fecha);
    porFecha.set(clave, porFecha.has(clave) ? `${porFecha.get(clave)} / ${nombre}` : nombre);
  }
}

const filas = [...porFecha.entries()].sort(([a], [b]) => a.localeCompare(b));
const sql = (s) => s.replaceAll("'", "''");

console.log(`-- Festivos nacionales de Colombia, ${desde} a ${hasta}.`);
console.log("-- Generado con scripts/festivos-colombia.mjs. No editar a mano: volver a generar.");
console.log(`-- OJO: cuando se acabe ${hasta} el cálculo no falla; deja de reconocer los`);
console.log("-- festivos en silencio. Hay que volver a generar antes de esa fecha.");
console.log("insert into public.festivo (fecha, nombre) values");
console.log(filas.map(([f, n]) => `  ('${f}', '${sql(n)}')`).join(",\n"));
console.log("on conflict (fecha) do update set nombre = excluded.nombre;");
