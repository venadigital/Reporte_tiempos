# Reporte de tiempos

Marcación de turnos (entrada, almuerzo, salida) con foto y reporte de horas clasificadas
según la ley laboral colombiana: diurnas, nocturnas, extras, dominicales y festivas.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind · Supabase (Postgres con RLS, Auth,
Storage) · Vercel. Web instalable (PWA): la misma app sirve en celular y en computador.

## Estado

- [x] Base de datos: perfiles y roles, bitácora, configuración, turnos, pausas, PIN, festivos
- [x] Reglas de marcación (celular y quiosco), correcciones y cálculo de horas, con pruebas
- [x] Inicio de sesión y pantalla de inicio por rol
- [x] Pantalla "Mi turno" con cámara
- [x] Empleados: alta de cuentas, ficha, interruptor y PIN
- [x] Quiosco: lista, PIN, cámara y confirmación en el computador compartido
- [x] Reporte de horas, detalle por persona con fotos y correcciones con bitácora
- [x] Borrado automático de fotos vencidas (tarea diaria)
- [x] Excel del periodo, con horas en decimales

## Las reglas que sostienen todo

1. La hora la pone el servidor, nunca el aparato.
2. Sin foto no hay entrada ni salida. El almuerzo no lleva foto.
3. Un solo turno abierto por persona.
4. No se puede cerrar el turno con el almuerzo abierto.
5. Un turno sin salida aporta cero horas. Nunca se inventa la hora de salida.
6. Un turno olvidado no se cierra días después: pasado el máximo configurado queda
   pendiente de revisión y lo corrige el administrador.
7. El empleado marca, pero no ve sus horas. Eso se cierra en la base, no en la pantalla.
8. Nadie escribe las tablas directamente: toda escritura pasa por funciones de la base.

## Roles

| Rol | Qué hace |
|---|---|
| `admin` | Ve todo, corrige turnos, edita empleados, asigna PIN |
| `coordinador` | Ve el reporte y las fotos, solo lectura |
| `empleado` | Solo marca su turno |
| `quiosco` | No es una persona: es el computador compartido |

Marcar turno no depende del rol sino del interruptor `profiles.marca_turno`.

## Configuración

Los parámetros viven en una sola fila de `public.configuracion`: jornada diaria, tope
semanal, franjas diurna y nocturna, regla opcional de cierre de operación, máximo de horas
de un turno abierto, días que se guardan las fotos e intentos del PIN.

Los turnos de noche se cuentan como una sola jornada: el tope diario se mide por el día en
que **empieza** el turno, no por día calendario.

## Diseño

Fondo gris claro con tarjetas blancas, tipografía del sistema, un solo color de acción
(azul) y verde, ámbar y rojo reservados para estados. Los colores viven como variables en
`src/app/globals.css` y las piezas compartidas (botones, listas agrupadas, interruptores,
avisos) en `src/components/ui.tsx`. En celular la acción principal va abajo, al alcance del
pulgar; los botones miden al menos 44 px y el texto cumple contraste 4,5:1.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # y llenar las llaves del proyecto de Supabase
npm run dev
npm test                     # pruebas de pantallas y reglas de la aplicación
```

## Primer administrador

Las cuentas las crea el administrador desde la pantalla **Empleados**. El primero se crea
una sola vez desde la terminal (pide nombre, correo y contraseña):

```bash
node scripts/crear-admin.mjs
```

Necesita `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` (Supabase → Project Settings → API
keys). Esa llave se salta todas las políticas: nunca va en el navegador ni en el repositorio.
En Supabase conviene desactivar el registro público (Authentication → Sign In / Providers).

## Fotos vencidas

La foto de una cara es un dato sensible: se borra sola a los días que diga
`configuracion.fotos_dias` (45). El turno se conserva siempre. Todos los días a las
2:40 a. m. de Colombia, `pg_cron` llama a la función de servidor
`supabase/functions/turnos-limpiar-fotos`, que borra primero los archivos y después limpia
las rutas. El secreto que autoriza esa llamada se genera en la migración y vive solo en el
Vault de Supabase.

En un proyecto nuevo hay que hacer dos cosas una sola vez: desplegar la función (sin
verificación de JWT: valida su propio secreto) y guardar la dirección del proyecto:

```sql
select vault.create_secret('https://<proyecto>.supabase.co', 'project_url');
```

## Base de datos

- `supabase/migrations/`: el esquema, en orden.
- `supabase/tests/`: pruebas en SQL (cálculo de horas, reglas y permisos, almacén de fotos). Cada archivo corre dentro de una transacción que se
  revierte (no deja datos) y devuelve una fila con cuántas pasaron y cuáles fallaron. Se
  ejecutan pegándolas en el editor SQL de Supabase o con `psql -f`.
- `scripts/festivos-colombia.mjs`: genera los festivos. Están cargados hasta 2035; cuando
  se acaben, el cálculo **no falla**: deja de reconocerlos en silencio. Hay que regenerar.

```bash
node scripts/festivos-colombia.mjs 2036 2045
```
