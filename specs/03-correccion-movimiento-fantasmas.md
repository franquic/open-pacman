# SPEC 03 — Corrección del movimiento de fantasmas (paredes y ojos)

> **Estado:** Aprovado
> **Depende on:** SPEC 02
> **Fecha:** 2026-08-29
> **Objetivo:** Arreglar que los fantasmas asustados y los ojos atraviesen paredes y que los ojos nunca vuelvan a la caseta, restaurando el invariante de alineación con la rejilla.

## Por qué existe esta spec

El movimiento de `game.js` depende de un invariante implícito: **los actores solo deciden dirección y comprueban muros (`canMove`) cuando están alineados en el centro exacto de una celda** (`aligned()`). SPEC 02 lo rompió de dos formas:

1. `FRIGHTENED_SPEED = 0.06` no divide 1 (1 ÷ 0.06 ≈ 16,67): un fantasma asustado solo se alinea cada ~50 frames (3 celdas) y entre alineaciones ni decide ni comprueba muros → cruza paredes.
2. Las transiciones de estado conservan el resto fraccionario de la posición (p. ej. `x = 10.02`): a velocidad 0.2 (ojos) o 0.1 (fin del efecto) ese resto nunca vuelve a 0 → el actor no vuelve a alinearse nunca, no decide dirección, atraviesa paredes en línea recta y los ojos jamás cumplen la condición de revivir (`aligned && y >= 14`).

Las velocidades 0.1, 0.125 y 0.2 sí dividen 1; por eso Pac-Man y los fantasmas normales funcionan.

## Alcance

**In:**

- `FRIGHTENED_SPEED` 0.06 → 0.05 en `src/js/game.js` (1 celda cada 20 frames exactos).
- Snap a la rejilla (`Math.round`) en las transiciones de estado de cada fantasma: al expirar el efecto asustado y al ser comido (asustado → ojos).
- Ojos: vuelta a la caseta garantizada mediante mapa de distancias BFS desde la entrada de la puerta (13,11), en sustitución del greedy `chooseDirToward`.
- Salvaguarda defensiva: comprobación de muro en cada frame en `movePacman` y `moveGhost`; si el avance invadiría una celda-pared, el actor frena en el centro de su celda actual.
- Solo cambia `src/js/game.js`. `maze.js`, `render.js` y `main.js` quedan intactos.

**Fuera de alcance (para futuras specs):**

- Refactor del movimiento a "celda a celda" (decidir al llegar, llegar exacto al centro).
- Evitar el solape entre fantasmas: en el arcade clásico se cruzan sin colisionar; se mantiene así.
- Ajustes de velocidad o dificultad más allá del fix del modo asustado.

## Modelo de datos

```js
// src/js/game.js — constante modificada
const FRIGHTENED_SPEED = 0.05; // antes 0.06; 1 celda cada 20 frames exactos

// src/js/game.js — nuevo mapa de distancias (solo lectura, calculado una vez)
// EYES_DIST[y][x] = pasos de camino mas corto desde (x,y) hasta la entrada
// de la puerta DOOR_ENTRY (13,11). BFS sobre celdas transitables con la
// puerta (valor 3) como muro. Calculo perezoso (lazy) la primera vez que
// un fantasma es comido; no se muta jamas.
```

Esta spec no añade campos nuevos a los fantasmas ni a `game`: reutiliza el modelo de SPEC 02.

### Comportamiento detallado

- **Snap en transiciones:** al expirar `frightened.active` y al comer un fantasma, ese fantasma hace `x = Math.round(x); y = Math.round(y)` antes de cambiar de modo. Salto visual máximo de media celda al comer un fantasma: aceptable y solo en ese instante.
- **Ojos con BFS:** en cada celda alineada, `moveGhostEyes` elige entre las direcciones válidas (sin muro) la que minimice `EYES_DIST`. Desde cualquier punto del laberinto los ojos llegan a (13,11); ahí entra el descenso scriptado existente por la puerta (cols 13-14) hasta (13,14), donde revive como hoy. La puerta solo es transitable en ese descenso, como hasta ahora.
- **Salvaguarda por frame:** antes de aplicar el desplazamiento en `movePacman` y `moveGhost`, si la celda siguiente en la dirección actual es muro y el paso cruzaría el centro de la celda actual, el actor se detiene en ese centro. Es red de seguridad: con velocidades que dividen 1 no debería activarse nunca.
- El solape entre fantasmas en pasillos se mantiene (comportamiento clásico): no es bug ni se previene.

## Plan de implementación

1. `src/js/game.js`: `FRIGHTENED_SPEED = 0.05`. Prueba manual: comer un pellet y verificar que los fantasmas asustados siguen los pasillos 6s sin cortar paredes.
2. `src/js/game.js` — `update()`: snap a la rejilla al expirar el efecto y al comer un fantasma. Prueba: tras el efecto los fantasmas siguen decidiendo en cruces; los ojos parten de un centro de celda.
3. `src/js/game.js`: función que calcula `EYES_DIST` (BFS desde (13,11)) con caché lazy; `moveGhostEyes` usa el mapa en vez de `chooseDirToward`. Prueba: comer un fantasma en la esquina más lejana y ver que los ojos llegan a la caseta y reviven.
4. `src/js/game.js`: salvaguarda por frame en `movePacman` y `moveGhost`. Prueba: partida normal sin cambios perceptibles de feel.
5. Partida manual completa: pellets, cadena 200/400/800/1600, ojos que reviven, muerte con efecto activo, ganar y perder.

## Criterios de aceptación

- [ ] Tras comer un power pellet, ningún fantasma asustado atraviesa paredes ni sale de los pasillos durante los 6s.
- [ ] Al terminar el efecto, los fantasmas siguen respetando los muros y decidiendo en los cruces (no quedan "rotos" en línea recta).
- [ ] Un fantasma comido se convierte en ojos que llegan a la caseta desde cualquier punto del laberinto, entran por la puerta y reviven.
- [ ] Los ojos no atraviesan paredes ni quedan atrapados orbitando un bloque.
- [ ] Los ojos ni matan a Pac-Man ni son comestibles, como en SPEC 02.
- [ ] Sin regresiones: túnel, salidas escalonadas, ciclo scatter/chase, cadena de puntos y reinicio tras muerte funcionan como antes.
- [ ] El solape ocasional entre fantasmas en pasillos sigue existiendo (comportamiento clásico aceptado).
- [ ] Una partida completa (ganar y perder) no muestra errores en consola.

## Decisiones

- **Sí:** parche quirúrgico en vez de refactor celda-a-celda. Cambios mínimos y localizados; el refactor merece spec propia si algún día se hace.
- **Sí:** 0.05 (50% de velocidad) para el modo asustado. Divide 1 exacto (20 frames por celda) y se percibe claramente más lento que 0.1. Descartado 0.0625 (62.5%, también válido) por simplicidad decimal.
- **Sí:** BFS para los ojos. El greedy sin giro de 180° puede orbitar un bloque indefinidamente; el mapa de distancias garantiza la llegada desde cualquier celda y su coste es trivial (28x31).
- **Sí:** snap a la rejilla en transiciones de estado. Es lo que evita que el resto fraccionario contamine modos con velocidades distintas.
- **Sí:** salvaguarda por frame. Evita que una futura velocidad mal elegida (como el 0.06) reproduzca esta clase de bug de forma silenciosa.
- **Sí:** mantener el solape entre fantasmas. Comportamiento del arcade; lo anómalo era verlos apilados sobre paredes, síntoma del bug de alineación.
- **No:** refactor celda-a-celda del movimiento. Fuera de alcance.
- **No:** lógica anti-solape entre fantasmas. No es del arcade y añade complejidad.

## Lo que **no** está en esta spec

- Refactor celda-a-celda del movimiento.
- Anti-solape entre fantasmas.
- Ajustes de velocidad/dificultad más allá del fix.

Cada uno de esos puntos, si llega, va en su propia spec.
