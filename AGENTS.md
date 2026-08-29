# AGENTS.md

Pac-Man clone in vanilla JS/HTML/CSS. No build, no bundler, no package manager, no tests — static files served from `src/`. To run, open `src/index.html` directly or serve `src/` with any static server.

## Conventions

- The project language is Spanish (code comments, UI text, specs). Keep it that way.
- No modules: all scripts are plain `<script>` tags sharing globals. Load order matters and is defined in `src/index.html`: `maze.js` → `game.js` → `render.js` → `main.js`. Any new file must be added there in dependency order.
- Dependency direction: `main.js` (loop/input/overlay) → `game.js` (state/rules) + `render.js` (canvas drawing); `game.js` reads globals from `maze.js` (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`).
- `MAZE` (maze.js) is the pristine maze definition; `game.grid` is the per-game copy used to track eaten dots. Render from `game.grid`, never mutate `MAZE`.
- Maze is a 28x31 grid encoded as strings in maze.js: `#` wall (1), `.` dot (2), ` ` walkable empty (0), `-` pen door (3). Symmetric about the vertical center axis; preserve symmetry when editing. The pen door blocks Pac-Man but not ghosts (`isWall` in game.js).
- Code style: spaces inside parens (`foo( x )`), single quotes, no semicolon omissions.

## Workflow

- This repo follows spec-driven development via the `/spec` and `/spec-impl` skills (see `.agents/skills/`). Specs live in `specs/NN-slug.md`; match the language and state wording of existing specs when adding new ones.
