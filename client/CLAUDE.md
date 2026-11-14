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
  adjective, which opens the spell window aimed at that target. `Hud.lock` stops spelling once
  you are dead, spectating or the round is over. Bottom left (`#corner`): ground and tile.
- Messages are terse (`terse` in `main.ts`): routine success is not toasted. The top-left HUD
  shows only rows you have; knocked out, it says KNOCKED OUT and whom the camera follows.
- Esc closes what is open (screen, aim, inspect), else opens the menu (`#menu`) with the controls.
- The spell window is only the input: a letter you do not hold (counting copies; for
  `give name abc` only the given letters) is not added, and the window shakes red.
- Letter tiles: one per copy, or one with a count above `COPIES_SHOWN` (4).
- `src/events.ts` event chips at the top middle (`#events`): weather, night and zones you stand in,
  with time left; a click opens `#eventcard` (shared `eventCard`: what it changes, who, what ends it).
- `src/minimap.ts` the minimap, only while the loadout lists `senses` (a MAP); `sensed` fills it.
- Opening or closing the spell window, and window blur, reset Phaser's keys: a key released
  while the window had focus was never seen, and the player walked on or stopped answering.
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
- `src/fx.ts` HTML effects: letter popups from `got` (a big tile with its reason tag that flies to
  the letter bar, which bounces), damage numbers from `hits`, the red screen edge when you are hit,
  and the red note when gathering finds nothing. In `main.ts`: `onHits` (flash, shake, lunge,
  tracer, health bar for a few seconds, a mark over whoever hit you), `overlays` (the camera zoomed
  so the screen holds your sight, fog past it, the gathering ring, `promptAt` hints over the
  letters: G: dig, E: claim).
- The spell window shows a compact preview (`#preview`: what it makes, two or three key effects)
  and the alphabet guide (shared `LETTER_GUIDE`), lighting letters you hold.
- Every item in the HUD, loadout and inventory shows what it does (shared `heldText`; effects in
  force `effectText`) and a click opens its card (`Hud.inspectWord`).
- `src/threats.ts` arrows at the screen's edge for `threats` off screen (✈ air, ⚔ ground, distance);
  aircraft in view get a shadow and speed streaks (`airborne`).
- Areas' name tags say owner and kind and sit on the edge nearest you; a click on a tag, or a
  right-click inside an area, opens its card (`Zones.tagAt`, `Events.show`).
- A click on something nobody owns (a RUIN) walks there and claims it (`claiming`, `take` { id });
  Shift-click attacks it. A gathering miss shows small (`missed`), a find's popup its `detail`.
- Knocked out, the HUD card has Start new round: `playAgain` (start.ts) reloads into a fresh room
  with the same choice, past the start screen. A room lost for good (server restart) does the same.
- `src/tips.ts` teaching tips (shared `tips.ts`): rotating word cards on the start screen, one
  line (`#tip`) in the spell window while it is empty, and Word ideas with a reroll in the Esc
  menu, where Show tips turns them off (`lastword.tips` in localStorage).
