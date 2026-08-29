# SPEC 02 — Power pellets y modo asustado

> **Estado:** Aprobado
> **Depende on:** SPEC 01
> **Fecha:** 2026-08-29
> **Objetivo:** Los 4 power pellets clásicos convierten a los fantasmas en comestibles durante ~6s, con cadena de puntos 200/400/800/1600 y fantasmas comidos que vuelven como ojos a la caseta.

## Alcance

**In:**

- 4 power pellets en `MAZE` (src/js/maze.js): nuevo carácter `o` → valor 4, en (1,3), (26,3), (1,23), (26,23).
- Comer un pellet: 50 puntos, activa modo asustado 6s (360 frames) e invierte la dirección de todos los fantasmas activos.
- Fantasmas asustados: azul, movimiento aleatorio en cruces y velocidad reducida (~60% de `GHOST_SPEED`).
- Comer fantasmas: cadena 200/400/800/1600 que se reinicia con cada pellet.
- Fantasma comido: se dibuja como ojos, vuelve a la caseta rápido, entra y revive saliendo de nuevo.
- Parpadeo azul↔blanco los últimos ~2s del efecto.
- El temporizador scatter/chase se pausa mientras dura el efecto.
- Los pellets cuentan en `dotsRemaining` (hay que comérselos para ganar).

**Fuera de alcance (para futuras specs):**

- Duración decreciente por nivel o dificultad progresiva.
- Popup flotante con la puntuación al comer un fantasma.
- Frutas y bonos de puntuación.

## Modelo de datos

```js
// src/js/maze.js — MAZE_STR: 4 celdas pasan de '.' a 'o'
// (1,3), (26,3), (1,23), (26,23) — simétricas sobre el eje central.
// parseTile: if ( ch === 'o' ) return 4;

// src/js/game.js — constantes nuevas
const FRIGHTENED_FRAMES = 360;       // 6s a 60fps
const FRIGHTENED_FLASH_FRAMES = 120; // últimos 2s parpadean
const FRIGHTENED_SPEED = 0.06;       // ~60% de GHOST_SPEED
const EYES_SPEED = 0.2;              // 2x GHOST_SPEED
const PELLET_POINTS = 50;
const GHOST_POINTS = [ 200, 400, 800, 1600 ];

// estado nuevo en createGame()
game.frightened = { active: false, frame: 0, eatenCount: 0 };

// cada fantasma gana campos:
{
  frightened: false, // asustado y comestible
  eaten: false,      // comido: son solo ojos volviendo a la pen
}
```

Convenciones: mismas que SPEC 01 — coordenadas de celda origen arriba-izquierda, tiempos en frames a ~60fps.

### Comportamiento detallado

- **Al comer pellet:** `score += 50`, `dotsRemaining--`, `frightened = { active: true, frame: 0, eatenCount: 0 }`; todo fantasma con `released && !eaten` pasa a `frightened = true` e invierte su `dir`. Un pellet extra con el efecto activo reinicia `frame` y `eatenCount`.
- **Durante el efecto:** `ghostMode.frame` no avanza (ciclo congelado). Los fantasmas asustados eligen dirección al azar entre las válidas sin giro de 180° (reutilizando el filtro de `decideGhost`) y avanzan a `FRIGHTENED_SPEED`.
- **Fin del efecto:** `frightened.active = false` y todos los `frightened` a `false`.
- **Fantasma comido:** `eaten = true`, `frightened = false`, velocidad `EYES_SPEED`; targeting voraz hacia la entrada de la puerta (13,11); al llegar, descenso scriptado por la puerta (cols 13-14, transitable solo para ojos) hasta (13,14) y ahí revive: `eaten = false`, `released = false`, `releaseDelay = 0` (la salida scriptada existente lo saca de nuevo).
- **Colisiones en `update()`:** fantasma `eaten` → se ignora; fantasma `frightened` → se lo come Pac-Man (cadena de puntos); resto → muerte como hoy. `resetPositions()` reinicia también `game.frightened` y los flags `frightened`/`eaten` de cada fantasma.

## Plan de implementación

1. `src/js/maze.js`: `parseTile` acepta `o`→4 y las 4 celdas de `MAZE_STR` pasan de `.` a `o`.
2. `src/js/game.js` — `createGame()`: contar dots con `v === 2 || v === 4` en `dotsRemaining`; añadir `game.frightened` y los campos `frightened`/`eaten` a cada fantasma. Prueba manual: el juego arranca igual, con 4 círculos grandes visibles.
3. `src/js/game.js` — `movePacman()`: comer pellet (v===4) aplica 50 puntos, descuento y activación del modo asustado con inversión de direcciones.
4. `src/js/game.js` — `update()`: congelar `ghostMode.frame` mientras `frightened.active`; cuenta atrás de `frightened.frame` y limpieza de flags al expirar.
5. `src/js/game.js` — `moveGhost()`/`decideGhost()`: rama asustada (aleatoria + lenta) y rama ojos (targeting a (13,11), entrada scriptada, revive en (13,14)).
6. `src/js/game.js` — `update()`: colisiones diferenciadas (ojos ignorados, asustado comido con cadena, resto muerte); `resetPositions()` ampliado.
7. `src/js/render.js`: `drawDots` dibuja valor 4 como círculo grande (~radio 6); `drawGhost` con cuerpo azul `#2121de` si `frightened` (parpadeo a blanco en los últimos 120 frames) y solo ojos si `eaten`.
8. Partida manual completa: comer los 4 pellets, cazar la cadena completa, dejar que un fantasma reviva, morir con el efecto activo y ganar.

## Criterios de aceptación

- [ ] Hay 4 power pellets visibles (círculos grandes) en (1,3), (26,3), (1,23) y (26,23).
- [ ] Comer un pellet suma 50 puntos y los fantasmas activos se vuelven azules, lentos y caóticos durante ~6s.
- [ ] Al comer un pellet los fantasmas activos invierten su dirección.
- [ ] Comer 4 fantasmas en un mismo efecto suma 200+400+800+1600; la cadena se reinicia con cada pellet.
- [ ] El fantasma comido se dibuja como ojos, entra en la caseta, revive y vuelve a salir por la puerta.
- [ ] Los ojos ni matan a Pac-Man ni son comestibles.
- [ ] Los últimos ~2s del efecto los fantasmas parpadean azul↔blanco.
- [ ] El ciclo scatter/chase se congela durante el efecto y reanuda donde estaba.
- [ ] Un pellet extra con efecto activo reinicia el contador a 6s y la cadena a 200.
- [ ] No se puede ganar sin comer los 4 pellets.
- [ ] Morir con el efecto activo reinicia modos, cadena y fantasmas como en SPEC 01.
- [ ] Una partida completa (ganar y perder) no muestra errores en consola.

## Decisiones

- **Sí:** duración fija 6s. No hay niveles; el decaimiento del arcade no aporta hoy.
- **Sí:** aleatorio + 60% de velocidad en modo asustado. Comportamiento clásico y genuinamente distinto de scatter/chase.
- **Sí:** cadena 200/400/800/1600 con reinicio por pellet. Clásico del arcade.
- **Sí:** ojos que vuelven caminando a la caseta y reviven. Contra teletransporte: más fiel y reutiliza la salida scriptada existente.
- **Sí:** parpadeo los últimos 2s, inversión de dirección al comer pellet y pausa del ciclo scatter/chase. Las tres del arcade.
- **Sí:** los pellets cuentan para ganar. Coherente con "comer todos los dots".
- **Sí:** pellet = 50 puntos. Valor clásico.
- **No:** popup flotante de puntuación al comer fantasma. No existe feedback flotante en el juego; el HUD ya muestra el score.
- **No:** duración decreciente por nivel ni dificultad progresiva. Fuera de alcance.

## Lo que **no** está en esta spec

- Duración por nivel / dificultad creciente.
- Popups de puntuación.
- Frutas y bonos.

Cada uno de esos puntos, si llega, va en su propia spec.
