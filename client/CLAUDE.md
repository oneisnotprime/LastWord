# client

Phaser 4 and Vite. Draws what the server says and sends the player's intents.

- Test: `npm test -w client`. Typecheck: `npm run typecheck -w client`.
- Run: `npm run dev:client`. Build: `npm run build -w client`.
- Check visible changes in a real browser with headless Playwright before calling them done.
- No game rules here. If the client needs to know an outcome, it asks `shared/` or the server.
- Desktop only: keyboard and mouse, or a controller. Do not add touch input or phone layouts.

## Map

- `styles.html` + `src/styles/` art style prototypes (keys 1-5, N for night); not used by the game.
- `src/main.ts` the Phaser scene: draws the map from the seed, markers for players and things,
  camera, movement input.
- `src/start.ts` the start screen shown before joining (Play with bots, or join friends); `net.ts` calls it.
- `src/net.ts` connection to the server: port 2567 under Vite (ports 5173 and 4173), else the
  page's own origin, since a deployed server serves the page. `VITE_SERVER` overrides both.
- `src/hud.ts` the HTML overlay: the top-left HUD card (health, armour and ride bars, hands,
  wears, rides, creatures, status chips, stores; players alive and round time), letter tiles at
  the bottom middle, the spell window (Enter opens it; while open every key goes to it, Enter
  casts, Esc cancels), the aiming banner, toasts, and the inventory (I) and loadout (L) screens,
  drawn from the server's private `loadout` message. Location and weather are on the loadout screen.
- Adjectives spelled alone (`readDescription`) and events that need a target (shared `aimOf`) put
  `main.ts` into aiming: a click on a thing, creature, person or yourself sends `describe`, or
  `pick` + `spell` + `pick(null)` for an event; Esc or right-click cancels.
- Right-click is only inspect: `inspectAt` shows the inspect card (shared `cardOf`) with Add
  adjective, which opens the spell window aimed at that target. The spell window shows a live
  preview (shared `inspectText`) and whether you hold the letters. `Hud.lock` stops spelling once
  you are dead, spectating or the round is over. Bottom left (`#corner`): ground and tile.
- `burst` draws the `described` effect: a gold burst and a rising tag listing what changed.
- `window.__lw` exposes the connection and map for browser checks.
- To check in a browser: start the server (`npm start -w server`), build and
  `npx vite preview` in `client/`, then drive it with Playwright.
- Art is Paper Diorama (style 4 of the prototypes), all drawn by code on canvases:
  - `src/art/terrain.ts` the map as torn paper sheets with cut-outs, in 16-tile chunks drawn by
    `terrain.worker.ts`; a terrain edit redraws only the chunks it touches.
  - `src/art/shapes.ts` what words look like: `WORDS` (a shape for one word) wins over
    `ARCHETYPES` (one per archetype) and `CLASSES`. Builders and units are in `build.ts`. Add a
    word's own shape there; `gallery.html` shows every shape (`?phrases=huge wolf,red car`).
  - `src/art/look.ts` phrase to look: colour from colour or material, size from mass, burning,
    frozen, invisible, hidden, count. `standee.ts` renders one; `paper.ts` cut-outs, tags, badges.
  - `src/paint.ts` caches canvases as textures; `src/zones.ts` areas as tissue paper with
    cut-outs; `src/sky.ts` night, weather and fields over the whole map.
  - Canvas textures are never resized or destroyed mid-game, and `maxTextures` is 1: Phaser 4.2
    otherwise drew some standees with another texture's pixels.
- Controller support is not built yet. Spelling on a controller will pick from held letters.
