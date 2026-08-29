# SPEC 01 — Cuatro fantasmas con comportamiento propio

> **Estado:** Aprobado
> **Depende on:** —
> **Fecha:** 2026-08-29
> **Objetivo:** Los 4 fantasmas clásicos del arcade (agresivo, emboscador, flanqueador y cobarde) con salida escalonada de la caseta y alternancia dispersión/persecución.

## Alcance

**In:**

- Ampliar `GHOST_STARTS` (src/js/maze.js) de 2 a 4 fantasmas con esquina de dispersión y retardo de salida.
- IA por tipo en `decideGhost` (src/js/game.js): targeting clásico del arcade.
- Temporizador global de modos: 7s dispersión → 20s persecución, repetitivo.
- Salida escalonada de la caseta: un fantasma cada 1.5s.
- Reinicio completo (posiciones, salidas y ciclo de modos) al morir Pac-Man con vidas restantes.
- Color por `kind` en `render.js` (rojo, rosa, cian, naranja).

**Fuera de alcance (para futuras specs):**

- Power-pellets y modo asustado (fantasmas comestibles, volver a la caseta al ser comidos).
- Velocidades distintas por fantasma o por nivel.
- Frutas, bonos de puntuación y dificultad creciente por nivel.

## Modelo de datos

```js
// src/js/maze.js — GHOST_STARTS pasa de 2 a 4 entradas
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'aggressive', corner: { x: 25, y: 1 }, releaseDelay: 0   },
  { x: 13, y: 14, kind: 'ambusher',   corner: { x: 2,  y: 1 }, releaseDelay: 90  },
  { x: 14, y: 14, kind: 'flanker',    corner: { x: 26, y: 29 }, releaseDelay: 180 },
  { x: 15, y: 14, kind: 'coward',     corner: { x: 1,  y: 29 }, releaseDelay: 270 },
];
// releaseDelay en frames (60 fps ≈ 1.5s entre salidas).
// corner: celda objetivo en dispersión (no necesita ser alcanzable).

// src/js/game.js — estado nuevo en createGame()
game.ghostMode = { mode: 'scatter', frame: 0 }; // frame < SCATTER_FRAMES | CHASE_FRAMES

// cada fantasma gana campos:
{
  x, y, dir, speed, kind,
  corner,        // { x, y } esquina de dispersión
  released: false,   // ¿ya salió de la caseta?
  releaseDelay: 0,   // frames restantes de espera
}

const SCATTER_FRAMES = 420; // 7s a 60fps
const CHASE_FRAMES = 1200;  // 20s a 60fps
```

Convenciones: coordenadas de celda con origen arriba-izquierda; los contadores de tiempo van en frames asumiendo ~60fps de `requestAnimationFrame` (igual que las velocidades actuales).

### Objetivos por tipo (targeting clásico)

- `aggressive` (Blinky, rojo): objetivo = celda de Pac-Man.
- `ambusher` (Pinky, rosa): objetivo = 4 celdas delante de Pac-Man en su dirección actual.
- `flanker` (Inky, cian): pivote = 2 celdas delante de Pac-Man; objetivo = pivote + 2·(pivote − posición del fantasma `aggressive`).
- `coward` (Clyde, naranja): si distancia Manhattan a Pac-Man > 8, objetivo = Pac-Man; si ≤ 8, objetivo = su `corner`.
- En dispersión: objetivo = `corner` del propio fantasma (los 4 usan su esquina).

La selección de dirección es la ya existente: entre las direcciones válidas que no impliquen giro de 180°, la que minimiza distancia Manhattan al objetivo.

## Plan de implementación

1. `src/js/maze.js`: sustituir `GHOST_STARTS` por las 4 entradas nuevas (kinds descriptivos, `corner`, `releaseDelay`).
2. `src/js/game.js` — `createGame()`: propagar `corner`, `released`, `releaseDelay` a cada fantasma y añadir `game.ghostMode`.
3. `src/js/game.js` — `moveGhost()`: si `!released`, el fantasma no se mueve; descontar `releaseDelay`; al llegar a 0, dirigirse hacia arriba saliendo por la puerta (cols 13-14) y marcar `released` al salir de la caseta. Prueba manual: los 4 salen escalonados cada ~1.5s.
4. `src/js/game.js` — `update()`: avanzar `ghostMode.frame` y alternar `scatter`/`chase` según `SCATTER_FRAMES`/`CHASE_FRAMES` (ciclo repetitivo).
5. `src/js/game.js` — `decideGhost()`: refactorizar el objetivo por `kind` (los 4 tipos + dispersión) reutilizando la selección voraz actual. El `flanker` localiza al `aggressive` vía `game.ghosts`. Prueba manual: cada fantasma se comporta distinto.
6. `src/js/game.js` — `resetPositions()`: reiniciar también `released`, `releaseDelay` y `game.ghostMode`.
7. `src/js/render.js`: `GHOST_COLORS` pasa de array por índice a mapa por `kind` (`aggressive`→`#ff0000`, `ambusher`→`#ffb8ff`, `flanker`→`#00ffff`, `coward`→`#ffb852`).
8. Partida manual completa: verificar ciclo de modos, muerte con reinicio y victoria.

## Criterios de aceptación

- [ ] Hay 4 fantasmas visibles con colores rojo, rosa, cian y naranja.
- [ ] Al iniciar (y tras cada muerte) los fantasmas salen de la caseta escalonados, uno cada ~1.5s.
- [ ] Durante los primeros 7s los fantasmas se dirigen cada uno a su esquina.
- [ ] A partir del segundo 7 los 4 persiguen durante 20s, y el ciclo se repite de forma perceptible.
- [ ] El fantasma rojo traza ruta directa hacia Pac-Man en persecución.
- [ ] El fantasma rosa se adelanta al camino de Pac-Man (apunta delante de él).
- [ ] El fantasma cian flanquea: su objetivo depende de la posición del rojo.
- [ ] El fantasma naranja rompe la persecución y vuelve a su esquina al acercarse a Pac-Man (≤8 celdas).
- [ ] Al morir Pac-Man con vidas restantes, se reinician posiciones, salidas escalonadas y ciclo de modos.
- [ ] Ganar (comer todos los dots) y perder (0 vidas) funcionan como antes.
- [ ] No hay errores en la consola durante una partida completa.

## Decisiones

- **Sí:** los 4 comportamientos clásicos del arcade. Bien documentados y genuinamente distintos entre sí.
- **Sí:** `kind` con nombres descriptivos en inglés (`aggressive`, `ambusher`, `flanker`, `coward`). Elección del usuario; los nombres del arcade quedan como referencia en comentarios.
- **Sí:** ciclo fijo repetitivo 7s/20s. Simple de razonar; las fases decrecientes del arcade aportan poco aquí.
- **Sí:** salida escalonada cada 1.5s (elección del usuario; 0s/1.5s/3s/4.5s).
- **Sí:** misma velocidad (`GHOST_SPEED`) para los 4; la diferencia está solo en el comportamiento.
- **Sí:** reinicio completo tras muerte (posiciones + salidas + ciclo de modos).
- **Sí:** timers en frames a ~60fps, coherente con las velocidades existentes por frame.
- **No:** power-pellets y modo asustado. Tocaría `MAZE`, puntuación y estados de fantasma; merece su propia spec.
- **No:** el bug de desbordamiento de Pinky del arcade original (apuntar "arriba" cuando Pac-Man mira arriba). Se usa el vector limpio de 4 celdas.
- **No:** velocidades distintas por fantasma ni dificultad progresiva.

## Lo que **no** está en esta spec

- Power-pellets y fantasmas comestibles.
- Velocidades por fantasma o por nivel.
- Frutas, puntuaciones extra y dificultad creciente.

Cada uno de esos puntos, si llega, va en su propia spec.
