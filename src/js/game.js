// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

const SCATTER_FRAMES = 420; // 7s a 60fps
const CHASE_FRAMES = 1200;  // 20s a 60fps

const FRIGHTENED_FRAMES = 360;       // 6s a 60fps
const FRIGHTENED_FLASH_FRAMES = 120; // ultimos 2s parpadean
const FRIGHTENED_SPEED = 0.06;       // ~60% de GHOST_SPEED
const EYES_SPEED = 0.2;              // 2x GHOST_SPEED
const PELLET_POINTS = 50;
const GHOST_POINTS = [ 200, 400, 800, 1600 ];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghostMode: { mode: 'scatter', frame: 0 },
    frightened: { active: false, frame: 0, eatenCount: 0 },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      corner: g.corner,
      released: false,
      releaseDelay: g.releaseDelay,
      frightened: false, // asustado y comestible
      eaten: false,      // comido: son solo ojos volviendo a la pen
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
// La puerta (3) bloquea a todos: la salida de la pen es scriptada
// (moveGhostInPen), asi que ningun fantasma vuelve a entrar por decision propia.
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

// Activar el modo asustado: reinicia timer y cadena, y los fantasmas ya
// fuera de la pen (que no sean ojos) se asustan e invierten su direccion.
function activateFrightened( game ) {
  game.frightened = { active: true, frame: 0, eatenCount: 0 };
  game.ghosts.forEach( ( g ) => {
    if ( g.released && !g.eaten ) {
      g.frightened = true;
      g.dir = OPPOSITE[ g.dir ];
    }
  } );
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer power pellet: activa el modo asustado.
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += PELLET_POINTS;
      game.dotsRemaining--;
      activateFrightened( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Celda objetivo del fantasma segun su kind y el modo global.
//   aggressive: la celda de Pac-Man (persecucion directa).
//   ambusher:   4 celdas delante de Pac-Man en su direccion.
//   flanker:    pivote 2 celdas delante de Pac-Man reflejado respecto al aggressive.
//   coward:     Pac-Man si esta lejos (>8), su esquina si esta cerca.
// En scatter todos apuntan a su corner.
function ghostTarget( game, g ) {
  if ( game.ghostMode.mode === 'scatter' ) return g.corner;

  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const pd = DIRS[ p.dir ] || DIRS.left;

  if ( g.kind === 'ambusher' ) {
    return { x: px + pd.x * 4, y: py + pd.y * 4 };
  }
  if ( g.kind === 'flanker' ) {
    const pivotX = px + pd.x * 2;
    const pivotY = py + pd.y * 2;
    const aggressive = game.ghosts.find( ( gg ) => gg.kind === 'aggressive' );
    const ax = aggressive ? Math.round( aggressive.x ) : px;
    const ay = aggressive ? Math.round( aggressive.y ) : py;
    return { x: pivotX * 2 - ax, y: pivotY * 2 - ay };
  }
  if ( g.kind === 'coward' ) {
    const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
    return dist <= 8 ? g.corner : { x: px, y: py };
  }
  // aggressive (y cualquier kind desconocido): la celda de Pac-Man.
  return { x: px, y: py };
}

// Direccion valida (sin giro de 180) que minimiza distancia Manhattan al
// target. Callejon sin salida: permitir el giro de 180.
function chooseDirToward( grid, g, target ) {
  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  g.dir = chooseDirToward( game.grid, g, ghostTarget( game, g ) );
}

// Asustado: direccion aleatoria entre las validas sin giro de 180.
function decideFrightened( grid, g ) {
  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];
  g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
}

// Dentro de la pen: esperar el releaseDelay y salir por la puerta (cols 13-14).
// La salida es scriptada (no usa decideGhost): alinear con la columna 13-14,
// subir hasta la fila 11 y ahi marcar released.
function moveGhostInPen( g ) {
  if ( g.releaseDelay > 0 ) {
    g.releaseDelay--;
    return;
  }
  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.y <= 11 ) {
      g.released = true;
      g.dir = 'left';
      return;
    }
    if ( g.x === 13 || g.x === 14 ) g.dir = 'up';
    else g.dir = g.x < 13 ? 'right' : 'left';
  }
  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
}

// Ojos (fantasma comido): targeting voraz hacia la entrada de la puerta
// (13,11) y descenso scriptado por la puerta (cols 13-14) hasta la pen
// (13,14), donde revive y la salida scriptada existente lo saca de nuevo.
// La puerta solo es transitable aqui porque el descenso no usa canMove.
const DOOR_ENTRY = { x: 13, y: 11 };

function moveGhostEyes( game, g ) {
  const grid = game.grid;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.y >= 14 ) {
      // Dentro de la pen: revive y vuelve a salir.
      g.eaten = false;
      g.frightened = false;
      g.released = false;
      g.releaseDelay = 0;
      g.dir = 'up';
      return;
    }
    if ( ( g.x === 13 || g.x === 14 ) && g.y >= 11 ) {
      g.dir = 'down'; // descenso scriptado por la puerta
    } else {
      g.dir = chooseDirToward( grid, g, DOOR_ENTRY );
    }
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * EYES_SPEED;
  g.y += d.y * EYES_SPEED;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( !g.released ) {
    moveGhostInPen( g );
    return;
  }

  if ( g.eaten ) {
    moveGhostEyes( game, g );
    return;
  }

  const speed = g.frightened ? FRIGHTENED_SPEED : g.speed;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.frightened ) decideFrightened( grid, g );
    else decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghostMode = { mode: 'scatter', frame: 0 };
  game.frightened = { active: false, frame: 0, eatenCount: 0 };
  game.ghosts.forEach( ( g, i ) => {
    const start = GHOST_STARTS[ i ];
    g.x = start.x;
    g.y = start.y;
    g.dir = 'up';
    g.corner = start.corner;
    g.released = false;
    g.releaseDelay = start.releaseDelay;
    g.frightened = false;
    g.eaten = false;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );

  // Modo asustado: el ciclo scatter/chase se congela mientras dure el efecto.
  if ( game.frightened.active ) {
    game.frightened.frame++;
    if ( game.frightened.frame >= FRIGHTENED_FRAMES ) {
      game.frightened = { active: false, frame: 0, eatenCount: 0 };
      game.ghosts.forEach( ( g ) => {
        g.frightened = false;
      } );
    }
  } else {
    // Ciclo global de modos: scatter 7s -> chase 20s -> repetir.
    const m = game.ghostMode;
    m.frame++;
    const limit = m.mode === 'scatter' ? SCATTER_FRAMES : CHASE_FRAMES;
    if ( m.frame >= limit ) {
      m.mode = m.mode === 'scatter' ? 'chase' : 'scatter';
      m.frame = 0;
    }
  }

  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( !collides( game.pacman, g ) ) continue;
    if ( g.eaten ) continue; // los ojos ni matan ni son comestibles
    if ( g.frightened ) {
      // Comerselo: puntos de la cadena y se convierte en ojos.
      const pts = GHOST_POINTS[ Math.min( game.frightened.eatenCount, GHOST_POINTS.length - 1 ) ];
      game.score += pts;
      game.frightened.eatenCount++;
      g.eaten = true;
      g.frightened = false;
      continue;
    }
    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.FRIGHTENED_FRAMES = FRIGHTENED_FRAMES;
window.FRIGHTENED_FLASH_FRAMES = FRIGHTENED_FLASH_FRAMES;
