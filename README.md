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
- [ ] Quiosco
- [ ] Reporte, detalle y correcciones
- [ ] Borrado automático de fotos
- [ ] Excel

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
