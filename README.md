# TITAN · web

Versión web de TITAN (el diario de entrenamiento de la app Flutter), con la misma funcionalidad:
rutina semanal, biblioteca de ejercicios, sesiones en vivo o registradas después, biseries/triseries/circuitos,
temporizador de descanso, historial con récords y gráficas, XP, logros y los estilos Moderno y Retro 16-bit.

Angular 22: componentes standalone, zoneless, signals (OnPush por defecto), Signal Forms, control flow (`@if`/`@for`),
rutas lazy y Vitest. PWA con service worker.

## Cómo funciona

- **Offline-first.** Todo se guarda en IndexedDB y vive en memoria como signals; las vistas (historial, récords, XP,
  avance semanal) son `computed`. La app nunca espera a la red y, instalada como PWA, abre sin conexión.
- **Sincronización.** Con una cuenta, `SyncService` llama a `POST /sync` de
  [titan-back](https://github.com/jarolVidal9/titan-back): sube lo pendiente y baja lo nuevo desde un cursor.
  Gana la edición más reciente (`updatedAt`); los borrados viajan como tombstones.
- **Sin cuenta** también funciona: los datos quedan solo en ese navegador hasta que inicies sesión (entonces se suben).
- **Catálogos base** (grupos musculares, tipos de serie, días de la rutina) usan UIDs fijos (`mg-pecho`, `rt-normal`,
  `rd-1`…) para no duplicarse entre dispositivos.
- **Fotos**: se reducen a ~320 px y se guardan dentro del ejercicio, así también se sincronizan.

El formato de cada tabla está en `src/app/core/db/schema.ts`: es el contrato que debe seguir la app Flutter para
sincronizar con la misma cuenta.

## Desarrollo

```bash
npm install
npm start              # http://localhost:4200 (usa el backend en http://localhost:3000)
npm test               # Vitest
npm run build          # producción en dist/frontend/browser
```

La URL del backend está en `src/environments/environment.ts` (producción) y `environment.development.ts` (local).

## Despliegue en Render

New → Blueprint → este repo. `render.yaml` crea un sitio estático que reescribe todas las rutas a `index.html`.
En el backend, agrega la URL del sitio a `CORS_ORIGINS` (p. ej. `https://titan-front.onrender.com`).

## Estructura

```
src/app/
  core/db/        IndexedDB, base local con signals, esquema y datos base
  core/data/      repositorios (ejercicios, rutina, sesiones) y lógica (récords, XP, avance)
  core/sync/      sesión (token) y sincronización
  shared/         tarjeta, gráficas SVG, diálogos, encabezado…
  features/       pantallas: today, session, routine, library, history, settings, auth
```
